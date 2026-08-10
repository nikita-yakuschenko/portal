import { randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type {
  CatalogProjectDetails,
  CrmSendResult,
  PartnerPricingMode,
  PartnerProjectExtraGroup
} from "@b2b/domain";

import { db } from "../../db/client.js";
import {
  auditLogs,
  catalogAssets,
  catalogProjectRooms,
  catalogProjects,
  catalogSyncRuns,
  contacts,
  crmConnections,
  dealerMaterials,
  dealEvents,
  deals,
  factoryProducts,
  partnerApplications,
  partnerInquiries,
  partnerProjectPrices,
  partners,
  partnerSites,
  passwordResetTokens,
  users
} from "../../db/schema.js";
import { projectSlug } from "../../lib/slug.js";
import { createCrmAdapters } from "../crm/adapters.js";
import { createResetToken, hashPassword, verifyPassword } from "../auth/passwords.js";
import { mapTildaProduct } from "../catalog/catalog-service.js";
import { buildProjectDetails, defaultOptionGroups } from "../catalog/project-details.js";
import type { TildaClient } from "../catalog/tilda-client.js";
import {
  buildFactoryOffer,
  findCatalogMatches,
  normalizeFactoryOffer,
  parsePriceListBuffer,
  type PriceImportReport,
  type PriceListImportFile
} from "../catalog/price-list-import.js";
import {
  mergeExtraOptionLibrary,
  normalizeExtraGroups,
  normalizeFactorySelectedOptions,
  normalizePricingMode,
  resolveDealerFactoryBase,
  resolvePartnerDisplayPrice
} from "../partners/partner-pricing.js";
import { partnerSiteService } from "../partners/partner-site-service.js";

type SessionUser = {
  id: string;
  partnerId: string | null;
  role: "company_admin" | "company_manager" | "partner_owner" | "partner_member";
  email: string;
  fullName: string;
};

/** Поля каталога, которые HQ может защитить от перезаписи синком Tilda */
const CATALOG_SYNC_OVERRIDE_FIELDS = [
  "name",
  "description",
  "technology",
  "area",
  "floors",
  "bedrooms",
  "bathrooms",
  "basePrice",
  "active"
] as const;

type CatalogSyncOverrideField = (typeof CATALOG_SYNC_OVERRIDE_FIELDS)[number];
type CatalogSyncOverrides = Partial<Record<CatalogSyncOverrideField, boolean>>;

function normalizeSyncOverrides(value: unknown): CatalogSyncOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const raw = value as Record<string, unknown>;
  const out: CatalogSyncOverrides = {};
  for (const field of CATALOG_SYNC_OVERRIDE_FIELDS) {
    if (raw[field] === true) {
      out[field] = true;
    }
  }
  return out;
}

function normalizeOptionalNumber(value: number | null): number | undefined {
  return value ?? undefined;
}

/** Поле credentials, по которому владелец узнаёт своё подключение */
const SECRET_KEY_BY_PROVIDER: Record<"amocrm" | "bitrix24", string> = {
  bitrix24: "webhookUrl",
  amocrm: "clientId"
};

/** Хвост секрета — достаточно, чтобы отличить своё подключение, и мало для доступа */
function maskSecret(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const tail = trimmed.slice(-4);
  return `…${tail}`;
}

function normalizeOptionalString(value: string | null): string | undefined {
  return value ?? undefined;
}

export class PortalService {
  private readonly crmAdapters = createCrmAdapters();

  constructor(private readonly tildaClient: TildaClient) {}

  async ensureCompanyAdmin(input: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<void> {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, input.email)
    });

    if (existing) {
      return;
    }

    await db.insert(users).values({
      id: randomUUID(),
      email: input.email,
      fullName: input.fullName,
      role: "company_admin",
      passwordHash: await hashPassword(input.password)
    });
  }

  // Локальный демо-партнёр для входа в /partner
  async ensureDemoPartner(input: {
    email: string;
    password: string;
    fullName: string;
    companyName: string;
    region: string;
  }): Promise<void> {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, input.email)
    });

    if (existing) {
      if (existing.partnerId) {
        await partnerSiteService.ensurePartnerSite(existing.partnerId);
      }
      return;
    }

    const partnerId = randomUUID();
    await db.insert(partners).values({
      id: partnerId,
      companyName: input.companyName,
      status: "active",
      region: input.region,
      email: input.email,
      phone: "+7 (000) 000-00-00"
    });

    await db.insert(users).values({
      id: randomUUID(),
      partnerId,
      email: input.email,
      fullName: input.fullName,
      role: "partner_owner",
      passwordHash: await hashPassword(input.password)
    });

    await partnerSiteService.ensurePartnerSite(partnerId);
  }

  /**
   * Прямое создание партнёра для входа (без заявки).
   * Минимум: email + password; остальное — заглушки, донастроишь в кабинете.
   */
  async createPartnerAccount(input: {
    email: string;
    password: string;
    fullName?: string | undefined;
    companyName?: string | undefined;
    region?: string | undefined;
    phone?: string | undefined;
    inn?: string | null | undefined;
    legalName?: string | null | undefined;
    resetPassword?: boolean | undefined;
  }): Promise<{
    partnerId: string;
    userId: string;
    email: string;
    created: boolean;
    passwordReset: boolean;
  }> {
    const email = input.email.trim().toLowerCase();
    const localPart = email.split("@")[0] || "partner";
    const fullName = (input.fullName?.trim() || localPart || "Партнёр").slice(0, 120);
    const companyName = (input.companyName?.trim() || `Дилер ${localPart}`).slice(0, 200);
    const region = (input.region?.trim() || "не указан").slice(0, 120);
    const phone = (input.phone?.trim() || "+7 (000) 000-00-00").slice(0, 64);
    const innRaw = input.inn?.trim() || null;
    if (innRaw && !/^\d{10}(\d{2})?$/.test(innRaw)) {
      throw new Error("ИНН должен содержать 10 или 12 цифр.");
    }
    const legalName = input.legalName?.trim() || null;

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (existing) {
      if (!input.resetPassword) {
        throw new Error(`Пользователь с email ${email} уже существует. Используй --reset-password чтобы сменить пароль.`);
      }

      if (!existing.partnerId) {
        throw new Error(`Email ${email} занят пользователем без партнёра (роль: ${existing.role}).`);
      }

      await db
        .update(users)
        .set({ passwordHash: await hashPassword(input.password), isActive: true })
        .where(eq(users.id, existing.id));

      await partnerSiteService.ensurePartnerSite(existing.partnerId);

      return {
        partnerId: existing.partnerId,
        userId: existing.id,
        email,
        created: false,
        passwordReset: true
      };
    }

    const partnerId = randomUUID();
    const userId = randomUUID();

    await db.insert(partners).values({
      id: partnerId,
      companyName,
      legalName,
      inn: innRaw,
      status: "active",
      region,
      email,
      phone
    });

    await db.insert(users).values({
      id: userId,
      partnerId,
      email,
      fullName,
      role: "partner_owner",
      passwordHash: await hashPassword(input.password)
    });

    await partnerSiteService.ensurePartnerSite(partnerId);

    const { messengerService } = await import("../messenger/messenger-service.js");
    await messengerService.ensureDm(partnerId, userId);

    return {
      partnerId,
      userId,
      email,
      created: true,
      passwordReset: false
    };
  }

  async submitPartnerApplication(input: {
    inn: string;
    companyName: string;
    contactName: string;
    email: string;
    region: string;
    interests: Array<"modular" | "panel_frame" | "farms">;
    message?: string;
  }) {
    const existing = await db.query.partnerApplications.findFirst({
      where: eq(partnerApplications.email, input.email)
    });

    if (existing) {
      throw new Error("Заявка с таким email уже есть.");
    }

    const application = {
      id: randomUUID(),
      inn: input.inn,
      companyName: input.companyName,
      contactName: input.contactName,
      email: input.email,
      phone: null,
      region: input.region,
      interests: JSON.stringify(input.interests),
      message: input.message,
      passwordHash: null,
      status: "new" as const
    };

    await db.insert(partnerApplications).values(application);
    return {
      id: application.id,
      status: application.status
    };
  }

  async listPartnerApplications() {
    return db.select().from(partnerApplications).orderBy(desc(partnerApplications.createdAt));
  }

  async reviewPartnerApplication(input: {
    applicationId: string;
    actorUserId: string;
    action: "approve" | "reject";
    comment?: string;
  }) {
    const application = await db.query.partnerApplications.findFirst({
      where: eq(partnerApplications.id, input.applicationId)
    });

    if (!application) {
      throw new Error("Application not found.");
    }

    if (application.status === "approved" || application.status === "rejected") {
      throw new Error("Application is already reviewed.");
    }

    if (input.action === "reject") {
      await db
        .update(partnerApplications)
        .set({
          status: "rejected",
          reviewComment: input.comment,
          reviewedAt: new Date()
        })
        .where(eq(partnerApplications.id, input.applicationId));

      await this.writeAuditLog(input.actorUserId, "application.rejected", "partner_application", input.applicationId, {
        comment: input.comment ?? ""
      });

      return { status: "rejected" as const };
    }

    const partnerId = randomUUID();
    const userId = randomUUID();
    const temporaryPassword = randomBytes(9).toString("base64url");

    await db.insert(partners).values({
      id: partnerId,
      companyName: application.companyName,
      legalName: application.companyName,
      inn: application.inn,
      status: "active",
      region: application.region,
      email: application.email,
      phone: application.phone ?? ""
    });

    await db.insert(users).values({
      id: userId,
      partnerId,
      email: application.email,
      fullName: application.contactName,
      role: "partner_owner",
      passwordHash: await hashPassword(temporaryPassword)
    });

    await db
      .update(partnerApplications)
      .set({
        status: "approved",
        reviewComment: input.comment,
        reviewedAt: new Date()
      })
      .where(eq(partnerApplications.id, input.applicationId));

    await this.writeAuditLog(input.actorUserId, "application.approved", "partner_application", input.applicationId, {
      partnerId
    });

    await partnerSiteService.ensurePartnerSite(partnerId);

    const { messengerService } = await import("../messenger/messenger-service.js");
    await messengerService.ensureDm(partnerId, userId);

    return {
      status: "approved" as const,
      partnerId,
      userId,
      temporaryPassword
    };
  }

  async login(email: string, password: string): Promise<SessionUser | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!user || !user.isActive) {
      return null;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      partnerId: user.partnerId,
      role: user.role,
      email: user.email,
      fullName: user.fullName
    };
  }

  async requestPasswordReset(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!user) {
      return null;
    }

    const { token, tokenHash } = createResetToken();

    await db.insert(passwordResetTokens).values({
      id: randomUUID(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60)
    });

    return { token };
  }

  async resetPassword(tokenHash: string, nextPassword: string) {
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.tokenHash, tokenHash)
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new Error("Reset token is invalid or expired.");
    }

    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(nextPassword)
      })
      .where(eq(users.id, resetToken.userId));

    await db
      .update(passwordResetTokens)
      .set({
        usedAt: new Date()
      })
      .where(eq(passwordResetTokens.id, resetToken.id));
  }

  async syncCatalogFromTilda(actorUserId: string) {
    const syncRunId = randomUUID();
    await db.insert(catalogSyncRuns).values({
      id: syncRunId,
      status: "running"
    });

    try {
      const products = await this.tildaClient.fetchProducts();
      let createdCount = 0;
      let updatedCount = 0;
      let assetsDiscovered = 0;

      for (const product of products) {
        const mapped = mapTildaProduct(product, new Date().toISOString());
        assetsDiscovered += mapped.assets.length;
        const area = mapped.area === undefined ? null : Math.round(mapped.area);
        const floors = mapped.floors === undefined ? null : mapped.floors;
        const bedrooms = mapped.bedrooms === undefined ? null : mapped.bedrooms;
        const bathrooms = mapped.bathrooms === undefined ? null : mapped.bathrooms;
        const basePrice = mapped.basePrice === undefined ? null : mapped.basePrice;

        const existing = await db.query.catalogProjects.findFirst({
          where: and(eq(catalogProjects.source, "tilda"), eq(catalogProjects.sourceUid, product.id))
        });

        if (existing) {
          const overrides = normalizeSyncOverrides(existing.syncOverrides);
          await db
            .update(catalogProjects)
            .set({
              ...(overrides.name
                ? {}
                : { name: mapped.name, slug: projectSlug(mapped.name) }),
              ...(overrides.description ? {} : { description: mapped.description }),
              ...(overrides.technology ? {} : { technology: mapped.technology }),
              details: mapped.details,
              ...(overrides.area ? {} : { area }),
              ...(overrides.floors ? {} : { floors }),
              ...(overrides.bedrooms ? {} : { bedrooms }),
              ...(overrides.bathrooms ? {} : { bathrooms }),
              ...(overrides.basePrice ? {} : { basePrice }),
              currency: mapped.currency,
              projectUrl: mapped.projectUrl,
              ...(overrides.active ? {} : { active: true }),
              sourcePayload: mapped.sourcePayload,
              lastSyncedAt: new Date(mapped.lastSyncedAt)
            })
            .where(eq(catalogProjects.id, existing.id));

          // Сохраняем ручные правки (тип / главный / скрыт) по URL при пересинхронизации
          const previousAssets = await db
            .select()
            .from(catalogAssets)
            .where(eq(catalogAssets.projectId, existing.id));
          const previousByUrl = new Map(previousAssets.map((asset) => [asset.sourceUrl, asset]));

          await db.delete(catalogAssets).where(eq(catalogAssets.projectId, existing.id));
          if (mapped.assets.length > 0) {
            await db.insert(catalogAssets).values(
              mapped.assets.map((asset) => {
                const previous = previousByUrl.get(asset.sourceUrl);
                return {
                  ...asset,
                  projectId: existing.id,
                  type: previous?.type ?? asset.type,
                  floorNumber: previous?.floorNumber ?? asset.floorNumber ?? null,
                  isPrimary: previous?.isPrimary ?? asset.isPrimary,
                  isHidden: previous?.isHidden ?? false
                };
              })
            );
          }

          updatedCount += 1;
        } else {
          await db.insert(catalogProjects).values({
            id: mapped.id,
            source: mapped.source,
            sourceUid: mapped.sourceUid,
            name: mapped.name,
            slug: mapped.slug,
            description: mapped.description,
            technology: mapped.technology,
            details: mapped.details,
            area,
            floors,
            bedrooms,
            bathrooms,
            basePrice,
            currency: mapped.currency,
            projectUrl: mapped.projectUrl,
            active: mapped.active,
            sourcePayload: mapped.sourcePayload,
            lastSyncedAt: new Date(mapped.lastSyncedAt)
          });
          if (mapped.assets.length > 0) {
            await db.insert(catalogAssets).values(mapped.assets);
          }
          createdCount += 1;
        }
      }

      await db
        .update(catalogSyncRuns)
        .set({
          status: "completed",
          createdCount,
          updatedCount,
          assetsDiscovered,
          finishedAt: new Date()
        })
        .where(eq(catalogSyncRuns.id, syncRunId));

      await this.writeAuditLog(actorUserId, "catalog.sync", "catalog_sync_run", syncRunId, {
        createdCount,
        updatedCount
      });

      return {
        id: syncRunId,
        createdCount,
        updatedCount,
        assetsDiscovered
      };
    } catch (error) {
      const errors = [error instanceof Error ? error.message : "Unknown sync error"];
      await db
        .update(catalogSyncRuns)
        .set({
          status: "failed",
          errors,
          finishedAt: new Date()
        })
        .where(eq(catalogSyncRuns.id, syncRunId));
      throw error;
    }
  }

  async listCatalogProjects() {
    const projects = await db.select().from(catalogProjects).orderBy(catalogProjects.name);

    if (projects.length === 0) {
      return [];
    }

    const assets = await db
      .select()
      .from(catalogAssets)
      .where(
        inArray(
          catalogAssets.projectId,
          projects.map((project) => project.id)
        )
      );

    return projects.map((project) => this.mapCatalogProject(project, assets));
  }

  /** Каталог для витрины дилера: заводской контент + розничные цены партнёра */
  async listPartnerStorefrontProjects(partnerId: string) {
    const [allProjects, priceRows] = await Promise.all([
      this.listCatalogProjects(),
      db.select().from(partnerProjectPrices).where(eq(partnerProjectPrices.partnerId, partnerId))
    ]);
    // Скрытые HQ (active=false) не попадают в витрину и каталог партнёра
    const projects = allProjects.filter((project) => project.active);

    const byProject = new Map(priceRows.map((row) => [row.projectId, row]));

    const mapped = projects.map((project) => {
      const row = byProject.get(project.id);
      const pricing = row
        ? {
            pricingMode: normalizePricingMode(row.pricingMode),
            markupPercent: row.markupPercent ?? undefined,
            publicPrice: row.publicPrice ?? undefined,
            priceOnRequest: row.priceOnRequest,
            isPublished: row.isPublished,
            extras: normalizeExtraGroups(row.extras)
          }
        : null;

      const selected = row ? normalizeFactorySelectedOptions(row.factorySelectedOptions) : [];
      const dealerFactoryBase = resolveDealerFactoryBase(
        project.basePrice,
        project.factoryOffer,
        selected
      );
      const display = resolvePartnerDisplayPrice(dealerFactoryBase, pricing);
      const visible = this.withVisibleAssets(project);
      // Список витрины: только обложка — иначе JSON и сеть раздуваются десятками фото
      const cover =
        visible.assets.find((asset) => asset.isPrimary) ?? visible.assets[0] ?? null;

      return {
        ...visible,
        assets: cover ? [cover] : [],
        factoryBasePrice: project.basePrice ?? null,
        dealerFactoryBase,
        basePrice: display.amount,
        priceOnRequest: display.onRequest,
        dealerPricing: pricing,
        dealerExtras: pricing?.extras ?? []
      };
    });

    return this.applyPartnerCatalogOrder(partnerId, mapped);
  }

  /** Полная карточка витрины по slug или id (все ассеты) */
  async getPartnerStorefrontProject(partnerId: string, key: string) {
    const project = await db.query.catalogProjects.findFirst({
      where: or(eq(catalogProjects.slug, key), eq(catalogProjects.id, key))
    });
    if (!project || !project.active) return null;

    const [assets, priceRows] = await Promise.all([
      db.select().from(catalogAssets).where(eq(catalogAssets.projectId, project.id)),
      db
        .select()
        .from(partnerProjectPrices)
        .where(
          and(
            eq(partnerProjectPrices.partnerId, partnerId),
            eq(partnerProjectPrices.projectId, project.id)
          )
        )
        .limit(1)
    ]);

    const mapped = this.mapCatalogProject(project, assets);
    const row = priceRows[0];
    const pricing = row
      ? {
          pricingMode: normalizePricingMode(row.pricingMode),
          markupPercent: row.markupPercent ?? undefined,
          publicPrice: row.publicPrice ?? undefined,
          priceOnRequest: row.priceOnRequest,
          isPublished: row.isPublished,
          extras: normalizeExtraGroups(row.extras)
        }
      : null;

    const selected = row ? normalizeFactorySelectedOptions(row.factorySelectedOptions) : [];
    const dealerFactoryBase = resolveDealerFactoryBase(
      mapped.basePrice,
      mapped.factoryOffer,
      selected
    );
    const display = resolvePartnerDisplayPrice(dealerFactoryBase, pricing);
    const visible = this.withVisibleAssets(mapped);

    return {
      ...visible,
      factoryBasePrice: mapped.basePrice ?? null,
      dealerFactoryBase,
      basePrice: display.amount,
      priceOnRequest: display.onRequest,
      dealerPricing: pricing,
      dealerExtras: pricing?.extras ?? []
    };
  }

  /** Порядок проектов партнёра для кабинета и витрины */
  async getPartnerCatalogOrder(partnerId: string): Promise<string[]> {
    const [partner] = await db
      .select({ catalogProjectOrder: partners.catalogProjectOrder })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);
    const raw = partner?.catalogProjectOrder;
    if (!Array.isArray(raw)) return [];
    return raw.filter((id): id is string => typeof id === "string");
  }

  async setPartnerCatalogOrder(partnerId: string, projectIds: string[]): Promise<string[]> {
    const catalog = await this.listCatalogProjects();
    const allowed = new Set(catalog.map((project) => project.id));
    const unique: string[] = [];
    for (const id of projectIds) {
      if (!allowed.has(id) || unique.includes(id)) continue;
      unique.push(id);
    }
    // Новые проекты каталога, которых ещё нет в порядке — в конец
    for (const project of catalog) {
      if (!unique.includes(project.id)) unique.push(project.id);
    }

    await db
      .update(partners)
      .set({ catalogProjectOrder: unique })
      .where(eq(partners.id, partnerId));

    return unique;
  }

  async applyPartnerCatalogOrder<T extends { id: string }>(
    partnerId: string,
    projects: T[]
  ): Promise<T[]> {
    const order = await this.getPartnerCatalogOrder(partnerId);
    if (order.length === 0) return projects;
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...projects].sort((a, b) => {
      const ai = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bi = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return 0;
    });
  }

  async listPartnerProjectPrices(partnerId: string) {
    const [projects, priceRows] = await Promise.all([
      this.listCatalogProjects(),
      db.select().from(partnerProjectPrices).where(eq(partnerProjectPrices.partnerId, partnerId))
    ]);
    const byProject = new Map(priceRows.map((row) => [row.projectId, row]));

    return projects.map((project) => {
      const row = byProject.get(project.id);
      const pricingMode = row
        ? normalizePricingMode(row.pricingMode)
        : ("on_request" as PartnerPricingMode);
      const extras = row ? normalizeExtraGroups(row.extras) : [];
      const factorySelectedOptions = row
        ? normalizeFactorySelectedOptions(row.factorySelectedOptions)
        : [];
      const offer = normalizeFactoryOffer(project.factoryOffer);
      const dealerFactoryBase = resolveDealerFactoryBase(
        project.basePrice,
        offer,
        factorySelectedOptions
      );
      const display = resolvePartnerDisplayPrice(
        dealerFactoryBase,
        row
          ? {
              pricingMode,
              markupPercent: row.markupPercent ?? undefined,
              publicPrice: row.publicPrice ?? undefined,
              priceOnRequest: row.priceOnRequest
            }
          : null
      );

      return {
        projectId: project.id,
        projectName: project.name,
        technology: project.technology,
        factoryBasePrice: project.basePrice ?? null,
        dealerFactoryBase,
        factorySelectedOptions,
        pricingMode,
        markupPercent: row?.markupPercent ?? null,
        publicPrice: row?.publicPrice ?? null,
        priceOnRequest: row?.priceOnRequest ?? true,
        isPublished: row?.isPublished ?? false,
        extras,
        displayPrice: display.amount,
        displayOnRequest: display.onRequest,
        primaryImage:
          project.assets.find((asset) => !asset.isHidden && asset.isPrimary)?.sourceUrl ??
          project.assets.find((asset) => !asset.isHidden)?.sourceUrl ??
          null
      };
    });
  }

  async upsertPartnerProjectPrice(input: {
    partnerId: string;
    projectId: string;
    pricingMode: PartnerPricingMode;
    markupPercent?: number;
    publicPrice?: number;
    isPublished?: boolean;
    /** Группы допов; id опциональны — normalizeExtraGroups проставит */
    extras?: PartnerProjectExtraGroup[];
    factorySelectedOptions?: string[];
  }) {
    const project = await db.query.catalogProjects.findFirst({
      where: eq(catalogProjects.id, input.projectId)
    });
    if (!project) {
      throw new Error("Проект не найден");
    }

    const pricingMode = normalizePricingMode(input.pricingMode);
    const priceOnRequest = pricingMode === "on_request";
    const markupPercent =
      pricingMode === "markup" && input.markupPercent != null
        ? Math.round(input.markupPercent)
        : null;
    const publicPrice =
      pricingMode === "exact" && input.publicPrice != null ? Math.round(input.publicPrice) : null;

    const existing = await db.query.partnerProjectPrices.findFirst({
      where: and(
        eq(partnerProjectPrices.partnerId, input.partnerId),
        eq(partnerProjectPrices.projectId, input.projectId)
      )
    });

    const extras =
      input.extras !== undefined
        ? normalizeExtraGroups(input.extras)
        : normalizeExtraGroups(existing?.extras);
    const factorySelectedOptions =
      input.factorySelectedOptions !== undefined
        ? normalizeFactorySelectedOptions(input.factorySelectedOptions)
        : normalizeFactorySelectedOptions(existing?.factorySelectedOptions);

    const payload = {
      pricingMode,
      markupPercent,
      publicPrice,
      priceOnRequest,
      isPublished: input.isPublished ?? existing?.isPublished ?? false,
      extras,
      factorySelectedOptions,
      updatedAt: new Date()
    };

    if (existing) {
      await db
        .update(partnerProjectPrices)
        .set(payload)
        .where(eq(partnerProjectPrices.id, existing.id));
    } else {
      await db.insert(partnerProjectPrices).values({
        id: randomUUID(),
        partnerId: input.partnerId,
        projectId: input.projectId,
        ...payload
      });
    }

    // Пополняем библиотеку разделов/опций партнёра для подсказок в других проектах
    await this.mergePartnerExtraOptionLibrary(input.partnerId, extras);

    const rows = await this.listPartnerProjectPrices(input.partnerId);
    return rows.find((row) => row.projectId === input.projectId) ?? null;
  }

  /** Библиотека разделов/опций партнёра (для подсказок при редактировании цен) */
  async getPartnerExtraOptionLibrary(partnerId: string): Promise<PartnerProjectExtraGroup[]> {
    const [partner] = await db
      .select({ extraOptionLibrary: partners.extraOptionLibrary })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);

    let library = normalizeExtraGroups(partner?.extraOptionLibrary);
    if (library.length > 0) return library;

    // Первый заход: собрать библиотеку из уже сохранённых цен проектов
    const priceRows = await db
      .select({ extras: partnerProjectPrices.extras })
      .from(partnerProjectPrices)
      .where(eq(partnerProjectPrices.partnerId, partnerId));

    library = [];
    for (const row of priceRows) {
      library = mergeExtraOptionLibrary(library, normalizeExtraGroups(row.extras));
    }
    if (library.length === 0) return [];

    await db
      .update(partners)
      .set({ extraOptionLibrary: library })
      .where(eq(partners.id, partnerId));

    return library;
  }

  async mergePartnerExtraOptionLibrary(
    partnerId: string,
    incoming: PartnerProjectExtraGroup[]
  ): Promise<PartnerProjectExtraGroup[]> {
    const [partner] = await db
      .select({ extraOptionLibrary: partners.extraOptionLibrary })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);

    const next = mergeExtraOptionLibrary(partner?.extraOptionLibrary, incoming);
    await db
      .update(partners)
      .set({ extraOptionLibrary: next })
      .where(eq(partners.id, partnerId));
    return next;
  }

  async getCatalogProject(projectId: string) {
    const project = await db.query.catalogProjects.findFirst({
      where: eq(catalogProjects.id, projectId)
    });

    if (!project) {
      return null;
    }

    const [assets, rooms] = await Promise.all([
      db.select().from(catalogAssets).where(eq(catalogAssets.projectId, project.id)),
      db.select().from(catalogProjectRooms).where(eq(catalogProjectRooms.projectId, project.id))
    ]);
    return this.mapCatalogProject(project, assets, rooms);
  }

  /** Правка карточки проекта в кабинете компании (описание, характеристики) */
  async updateCatalogProject(
    projectId: string,
    patch: {
      name?: string | undefined;
      description?: string | undefined;
      technology?: "modular" | "panel_frame" | undefined;
      area?: number | null | undefined;
      floors?: number | null | undefined;
      bedrooms?: number | null | undefined;
      bathrooms?: string | null | undefined;
      basePrice?: number | null | undefined;
      active?: boolean | undefined;
    }
  ) {
    const existing = await db.query.catalogProjects.findFirst({
      where: eq(catalogProjects.id, projectId)
    });
    if (!existing) {
      return null;
    }

    const syncOverrides = { ...normalizeSyncOverrides(existing.syncOverrides) };
    for (const field of CATALOG_SYNC_OVERRIDE_FIELDS) {
      if (patch[field] !== undefined) {
        syncOverrides[field] = true;
      }
    }

    await db
      .update(catalogProjects)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.technology !== undefined ? { technology: patch.technology } : {}),
        ...(patch.area !== undefined ? { area: patch.area } : {}),
        ...(patch.floors !== undefined ? { floors: patch.floors } : {}),
        ...(patch.bedrooms !== undefined ? { bedrooms: patch.bedrooms } : {}),
        ...(patch.bathrooms !== undefined ? { bathrooms: patch.bathrooms } : {}),
        ...(patch.basePrice !== undefined ? { basePrice: patch.basePrice } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        syncOverrides
      })
      .where(eq(catalogProjects.id, projectId));

    // Одноэтажный дом — этаж у планировок не нужен
    if (patch.floors !== undefined && (patch.floors == null || patch.floors <= 1)) {
      await db
        .update(catalogAssets)
        .set({ floorNumber: null })
        .where(eq(catalogAssets.projectId, projectId));
    }

    return this.getCatalogProject(projectId);
  }

  /** Ручная правка заводского прайса (домокомплект + сборка + допы) в кабинете HQ */
  async updateFactoryOffer(
    projectId: string,
    patch: {
      basePrice?: number | null | undefined;
      assembly: Array<{ id: string; name: string; price: number }>;
      extras: Array<{ id: string; name: string; price: number }>;
    }
  ) {
    const existing = await db.query.catalogProjects.findFirst({
      where: eq(catalogProjects.id, projectId)
    });
    if (!existing) {
      return null;
    }

    const prev = normalizeFactoryOffer(existing.factoryOffer);
    const nextOffer = normalizeFactoryOffer({
      importedAt: prev?.importedAt || new Date().toISOString(),
      sources: prev?.sources?.length ? prev.sources : ["manual"],
      assembly: patch.assembly,
      extras: patch.extras
    });
    if (!nextOffer) {
      return null;
    }

    const syncOverrides = { ...normalizeSyncOverrides(existing.syncOverrides) };
    const basePrice =
      patch.basePrice !== undefined ? patch.basePrice : existing.basePrice;
    if (patch.basePrice !== undefined) {
      syncOverrides.basePrice = true;
    }

    await db
      .update(catalogProjects)
      .set({
        factoryOffer: nextOffer,
        ...(patch.basePrice !== undefined ? { basePrice } : {}),
        syncOverrides
      })
      .where(eq(catalogProjects.id, projectId));

    return this.getCatalogProject(projectId);
  }

  /** Импорт заводских цен из Excel (модульные / ПКД). Каталог — источник истины по составу. */
  async importFactoryPricesFromExcel(files: PriceListImportFile[]): Promise<PriceImportReport> {
    const report: PriceImportReport = {
      updated: [],
      skippedUnmatched: [],
      ambiguous: [],
      errors: []
    };

    if (files.length === 0) {
      report.errors.push("Прикрепите хотя бы один файл прайса");
      return report;
    }

    const catalog = await db.select().from(catalogProjects);
    const importedAt = new Date().toISOString();
    const touched = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        excelName: string;
        basePrice: number | null;
        offer: ReturnType<typeof buildFactoryOffer>;
        syncOverrides: CatalogSyncOverrides;
      }
    >();

    for (const file of files) {
      let blocks;
      try {
        blocks = await parsePriceListBuffer(file.buffer);
      } catch (error) {
        report.errors.push(
          `${file.fileName}: ${error instanceof Error ? error.message : "не удалось прочитать файл"}`
        );
        continue;
      }

      if (blocks.length === 0) {
        report.errors.push(`${file.fileName}: не найдены блоки проектов`);
        continue;
      }

      const targets = catalog
        .filter((row) =>
          file.technology === "panel_frame"
            ? row.technology === "panel_frame"
            : row.technology !== "panel_frame"
        )
        .map((row) => ({
          id: row.id,
          name: row.name,
          technology: (row.technology === "panel_frame" ? "panel_frame" : "modular") as
            | "modular"
            | "panel_frame"
        }));

      for (const block of blocks) {
        const matches = findCatalogMatches(block.excelName, targets);
        if (matches.length === 0) {
          report.skippedUnmatched.push(block.excelName);
          continue;
        }
        if (matches.length > 1) {
          report.ambiguous.push({
            excelName: block.excelName,
            candidates: matches.map((m) => m.name)
          });
          continue;
        }

        const match = matches[0]!;
        const existing = catalog.find((row) => row.id === match.id);
        if (!existing) continue;

        const prev = touched.get(match.id);
        const sources = [
          ...new Set([...(prev?.offer.sources ?? []), file.fileName].filter(Boolean))
        ];
        const offer = buildFactoryOffer(block, sources, importedAt);
        // Если оба файла попали в один проект — не ожидается; последний выигрывает по полям
        const syncOverrides = {
          ...normalizeSyncOverrides(existing.syncOverrides),
          ...(prev?.syncOverrides ?? {}),
          basePrice: true
        };

        touched.set(match.id, {
          projectId: match.id,
          projectName: match.name,
          excelName: block.excelName,
          basePrice: block.basePrice,
          offer,
          syncOverrides
        });
      }
    }

    for (const row of touched.values()) {
      await db
        .update(catalogProjects)
        .set({
          ...(row.basePrice != null ? { basePrice: row.basePrice } : {}),
          factoryOffer: row.offer,
          syncOverrides: row.syncOverrides
        })
        .where(eq(catalogProjects.id, row.projectId));

      report.updated.push({
        projectId: row.projectId,
        projectName: row.projectName,
        excelName: row.excelName
      });
    }

    return report;
  }

  /** Сброс защиты полей от синка (все или выбранные) */
  async clearCatalogSyncOverrides(projectId: string, fields?: string[]) {
    const existing = await db.query.catalogProjects.findFirst({
      where: eq(catalogProjects.id, projectId)
    });
    if (!existing) {
      return null;
    }

    let syncOverrides: CatalogSyncOverrides = {};
    if (fields && fields.length > 0) {
      syncOverrides = { ...normalizeSyncOverrides(existing.syncOverrides) };
      for (const field of fields) {
        if ((CATALOG_SYNC_OVERRIDE_FIELDS as readonly string[]).includes(field)) {
          delete syncOverrides[field as CatalogSyncOverrideField];
        }
      }
    }

    await db
      .update(catalogProjects)
      .set({ syncOverrides })
      .where(eq(catalogProjects.id, projectId));

    return this.getCatalogProject(projectId);
  }

  /** Тип / этаж планировки / главный кадр / скрытие; при isPrimary сбрасываем остальные у проекта */
  async updateCatalogAsset(
    assetId: string,
    patch: {
      type?: "exterior" | "floor_plan" | "interior" | "unknown" | undefined;
      floorNumber?: number | null | undefined;
      isPrimary?: boolean | undefined;
      isHidden?: boolean | undefined;
    }
  ) {
    const [asset] = await db.select().from(catalogAssets).where(eq(catalogAssets.id, assetId)).limit(1);
    if (!asset) {
      return null;
    }

    if (patch.isPrimary === true) {
      await db
        .update(catalogAssets)
        .set({ isPrimary: false })
        .where(eq(catalogAssets.projectId, asset.projectId));
    }

    const nextType = patch.type !== undefined ? patch.type : asset.type;
    // Этаж только у планировок; при смене типа сбрасываем
    let nextFloorNumber =
      patch.floorNumber !== undefined ? patch.floorNumber : asset.floorNumber;
    if (nextType !== "floor_plan") {
      nextFloorNumber = null;
    }

    await db
      .update(catalogAssets)
      .set({
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        floorNumber: nextFloorNumber,
        ...(patch.isPrimary !== undefined ? { isPrimary: patch.isPrimary } : {}),
        ...(patch.isHidden !== undefined ? { isHidden: patch.isHidden } : {})
      })
      .where(eq(catalogAssets.id, assetId));

    return this.getCatalogProject(asset.projectId);
  }

  /** Новая строка экспликации помещений — HQ добавляет вручную, площадь правится тут же */
  async createProjectRoom(
    projectId: string,
    data: { floorNumber: number; name: string; area: number }
  ) {
    const project = await db.query.catalogProjects.findFirst({
      where: eq(catalogProjects.id, projectId)
    });
    if (!project) {
      return null;
    }

    const siblings = await db
      .select()
      .from(catalogProjectRooms)
      .where(
        and(
          eq(catalogProjectRooms.projectId, projectId),
          eq(catalogProjectRooms.floorNumber, data.floorNumber)
        )
      );
    const nextSortOrder = siblings.reduce((max, room) => Math.max(max, room.sortOrder), -1) + 1;

    await db.insert(catalogProjectRooms).values({
      id: randomUUID(),
      projectId,
      floorNumber: data.floorNumber,
      name: data.name,
      area: data.area,
      sortOrder: nextSortOrder,
      polygon: []
    });

    return this.getCatalogProject(projectId);
  }

  /** Правка строки экспликации: название/площадь/контур на схеме */
  async updateProjectRoom(
    roomId: string,
    patch: {
      name?: string | undefined;
      area?: number | undefined;
      polygon?: Array<{ x: number; y: number }> | undefined;
      sortOrder?: number | undefined;
    }
  ) {
    const [room] = await db
      .select()
      .from(catalogProjectRooms)
      .where(eq(catalogProjectRooms.id, roomId))
      .limit(1);
    if (!room) {
      return null;
    }

    await db
      .update(catalogProjectRooms)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.area !== undefined ? { area: patch.area } : {}),
        ...(patch.polygon !== undefined ? { polygon: patch.polygon } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {})
      })
      .where(eq(catalogProjectRooms.id, roomId));

    return this.getCatalogProject(room.projectId);
  }

  async deleteProjectRoom(roomId: string) {
    const [room] = await db
      .select()
      .from(catalogProjectRooms)
      .where(eq(catalogProjectRooms.id, roomId))
      .limit(1);
    if (!room) {
      return null;
    }

    await db.delete(catalogProjectRooms).where(eq(catalogProjectRooms.id, roomId));

    return this.getCatalogProject(room.projectId);
  }

  private mapCatalogProject(
    project: typeof catalogProjects.$inferSelect,
    assets: Array<typeof catalogAssets.$inferSelect>,
    rooms: Array<typeof catalogProjectRooms.$inferSelect> = []
  ) {
    const technology = (project.technology === "panel_frame" ? "panel_frame" : "modular") as
      | "modular"
      | "panel_frame";
    const storedDetails = project.details as CatalogProjectDetails | Record<string, unknown> | null;
    const hasDetails =
      storedDetails &&
      typeof storedDetails === "object" &&
      Array.isArray((storedDetails as CatalogProjectDetails).packages);

    const details = hasDetails
      ? {
          ...(storedDetails as CatalogProjectDetails),
          // Актуальный перечень опций по технологии (цены — по запросу / прайсу проекта)
          optionGroups: defaultOptionGroups(technology)
        }
      : buildProjectDetails({
          name: project.name,
          technology,
          characteristics: []
        });

    return {
      id: project.id,
      source: project.source,
      sourceUid: project.sourceUid,
      name: project.name,
      slug: project.slug,
      description: project.description,
      technology,
      details,
      area: normalizeOptionalNumber(project.area),
      floors: normalizeOptionalNumber(project.floors),
      bedrooms: normalizeOptionalNumber(project.bedrooms),
      bathrooms: normalizeOptionalString(project.bathrooms),
      basePrice: normalizeOptionalNumber(project.basePrice),
      factoryOffer: normalizeFactoryOffer(project.factoryOffer),
      currency: project.currency,
      projectUrl: project.projectUrl,
      active: project.active,
      syncOverrides: normalizeSyncOverrides(project.syncOverrides),
      sourcePayload: project.sourcePayload as Record<string, unknown>,
      lastSyncedAt: project.lastSyncedAt.toISOString(),
      assets: assets
        .filter((asset) => asset.projectId === project.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((asset) => ({
          id: asset.id,
          projectId: asset.projectId,
          sourceUrl: asset.sourceUrl,
          localPath: asset.localPath,
          type: asset.type as "exterior" | "floor_plan" | "interior" | "unknown",
          floorNumber: asset.floorNumber ?? null,
          sortOrder: asset.sortOrder,
          isPrimary: asset.isPrimary,
          isHidden: asset.isHidden
        })),
      rooms: rooms
        .filter((room) => room.projectId === project.id)
        .sort((a, b) => a.floorNumber - b.floorNumber || a.sortOrder - b.sortOrder)
        .map((room) => ({
          id: room.id,
          projectId: room.projectId,
          floorNumber: room.floorNumber,
          name: room.name,
          area: room.area,
          sortOrder: room.sortOrder,
          polygon: (room.polygon ?? []) as Array<{ x: number; y: number }>
        }))
    };
  }

  /** Витрина / кабинет партнёра: без скрытых ассетов */
  withVisibleAssets<T extends { assets: Array<{ isHidden?: boolean }> }>(project: T): T {
    return {
      ...project,
      assets: project.assets.filter((asset) => !asset.isHidden)
    };
  }

  async listCatalogSyncRuns() {
    return db.select().from(catalogSyncRuns).orderBy(desc(catalogSyncRuns.startedAt));
  }

  async listPartners() {
    return db.select().from(partners).orderBy(desc(partners.createdAt));
  }

  /** Карточка партнёра для HQ: профиль + снимок сайта */
  async getCompanyPartner(partnerId: string) {
    const partner = await db.query.partners.findFirst({
      where: eq(partners.id, partnerId)
    });
    if (!partner) return null;

    const sites = await this.listCompanySites();
    const site = sites.find((row) => row.partnerId === partnerId) ?? null;

    return {
      ...partner,
      createdAt: partner.createdAt.toISOString(),
      site
    };
  }

  async getCompanyDashboard() {
    const [applications, partnerRows, syncRuns] = await Promise.all([
      this.listPartnerApplications(),
      this.listPartners(),
      this.listCatalogSyncRuns()
    ]);

    return {
      applications,
      partners: partnerRows,
      latestSyncRun: syncRuns[0] ?? null
    };
  }

  async getMe(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      return null;
    }

    const partner = user.partnerId
      ? await db.query.partners.findFirst({
          where: eq(partners.id, user.partnerId)
        })
      : null;

    return {
      user,
      partner
    };
  }

  /** Коммерческие поля — правит партнёр (не юр. название и не ИНН). */
  async updatePartnerProfile(input: {
    actorUserId: string;
    partnerId: string;
    companyName: string;
    region: string;
    phone: string;
    email: string;
  }) {
    const companyName = input.companyName.trim();
    if (companyName.length < 2) {
      throw new Error("Укажите коммерческое название (минимум 2 символа).");
    }

    await db
      .update(partners)
      .set({
        companyName,
        region: input.region.trim() || "не указан",
        phone: input.phone.trim() || "+7 (000) 000-00-00",
        email: input.email.trim().toLowerCase()
      })
      .where(eq(partners.id, input.partnerId));

    await this.writeAuditLog(input.actorUserId, "partner.profile.updated", "partner", input.partnerId, {
      companyName
    });

    return db.query.partners.findFirst({ where: eq(partners.id, input.partnerId) });
  }

  /** Юр. реквизиты — только HQ (по документам о смене юрлица). */
  async updatePartnerLegal(input: {
    actorUserId: string;
    partnerId: string;
    legalName: string | null;
    inn: string | null;
  }) {
    const existing = await db.query.partners.findFirst({
      where: eq(partners.id, input.partnerId)
    });
    if (!existing) {
      throw new Error("Партнёр не найден.");
    }

    const legalName = input.legalName?.trim() || null;
    const innRaw = input.inn?.trim() || null;
    if (innRaw && !/^\d{10}(\d{2})?$/.test(innRaw)) {
      throw new Error("ИНН должен содержать 10 или 12 цифр.");
    }

    await db
      .update(partners)
      .set({ legalName, inn: innRaw })
      .where(eq(partners.id, input.partnerId));

    await this.writeAuditLog(input.actorUserId, "partner.legal.updated", "partner", input.partnerId, {
      legalName,
      inn: innRaw
    });

    return db.query.partners.findFirst({ where: eq(partners.id, input.partnerId) });
  }

  async updatePartnerStatus(input: {
    actorUserId: string;
    partnerId: string;
    status: "active" | "suspended";
  }) {
    const existing = await db.query.partners.findFirst({
      where: eq(partners.id, input.partnerId)
    });
    if (!existing) {
      throw new Error("Партнёр не найден.");
    }

    await db
      .update(partners)
      .set({ status: input.status })
      .where(eq(partners.id, input.partnerId));

    await this.writeAuditLog(input.actorUserId, "partner.status.updated", "partner", input.partnerId, {
      status: input.status
    });

    return db.query.partners.findFirst({ where: eq(partners.id, input.partnerId) });
  }

  async resetPartnerOwnerPassword(input: { actorUserId: string; partnerId: string }) {
    const owner = await db.query.users.findFirst({
      where: and(eq(users.partnerId, input.partnerId), eq(users.role, "partner_owner"))
    });
    if (!owner) {
      throw new Error("Владелец кабинета партнёра не найден.");
    }

    const temporaryPassword = randomBytes(9).toString("base64url");
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(temporaryPassword), isActive: true })
      .where(eq(users.id, owner.id));

    await this.writeAuditLog(
      input.actorUserId,
      "partner.owner_password.reset",
      "user",
      owner.id,
      { partnerId: input.partnerId }
    );

    return {
      userId: owner.id,
      email: owner.email,
      temporaryPassword
    };
  }

  async listCompanySites() {
    const rows = await db
      .select({
        id: partnerSites.id,
        partnerId: partnerSites.partnerId,
        companyName: partners.companyName,
        subdomain: partnerSites.subdomain,
        domain: partnerSites.domain,
        status: partnerSites.status,
        publishedAt: partnerSites.publishedAt,
        updatedAt: partnerSites.updatedAt,
        publishLocked: partnerSites.publishLocked,
        republishRequestStatus: partnerSites.republishRequestStatus,
        republishRequestedAt: partnerSites.republishRequestedAt,
        republishRequestComment: partnerSites.republishRequestComment
      })
      .from(partnerSites)
      .innerJoin(partners, eq(partnerSites.partnerId, partners.id))
      .orderBy(desc(partnerSites.updatedAt));

    return rows.map((row) => {
      const custom = row.domain?.trim();
      const publicHost = custom
        ? custom.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()
        : `${row.subdomain}.avgst.ru`;
      return {
        ...row,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        republishRequestStatus: row.republishRequestStatus === "pending" ? "pending" : null,
        republishRequestedAt: row.republishRequestedAt?.toISOString() ?? null,
        publicUrl: `https://${publicHost}`
      };
    });
  }

  async listCompanyTeam() {
    return db
      .select()
      .from(users)
      .where(and(isNull(users.partnerId), inArray(users.role, ["company_admin", "company_manager"])))
      .orderBy(users.fullName);
  }

  async createCompanyTeamUser(input: {
    actorUserId: string;
    fullName: string;
    email: string;
    password: string;
    role: "company_admin" | "company_manager";
  }) {
    const email = input.email.trim().toLowerCase();
    const clash = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (clash) {
      throw new Error("Пользователь с таким email уже есть.");
    }

    const user = {
      id: randomUUID(),
      partnerId: null,
      fullName: input.fullName.trim(),
      email,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      isActive: true
    } as const;

    await db.insert(users).values(user);
    await this.writeAuditLog(input.actorUserId, "company.team_user.created", "user", user.id, {
      role: input.role
    });
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };
  }

  async setCompanyTeamUserActive(input: {
    actorUserId: string;
    userId: string;
    isActive: boolean;
  }) {
    if (input.userId === input.actorUserId && !input.isActive) {
      throw new Error("Нельзя деактивировать свой аккаунт.");
    }

    const existing = await db.query.users.findFirst({
      where: and(
        eq(users.id, input.userId),
        isNull(users.partnerId),
        inArray(users.role, ["company_admin", "company_manager"])
      )
    });
    if (!existing) {
      throw new Error("Сотрудник завода не найден.");
    }

    await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
    await this.writeAuditLog(input.actorUserId, "company.team_user.active", "user", input.userId, {
      isActive: input.isActive
    });

    return { ...existing, isActive: input.isActive };
  }

  async listPartnerTeam(partnerId: string) {
    return db.select().from(users).where(eq(users.partnerId, partnerId)).orderBy(users.fullName);
  }

  async createPartnerTeamUser(input: {
    actorUserId: string;
    partnerId: string;
    fullName: string;
    email: string;
    password: string;
    role: "partner_member";
  }) {
    const user = {
      id: randomUUID(),
      partnerId: input.partnerId,
      fullName: input.fullName,
      email: input.email,
      role: "partner_member" as const,
      passwordHash: await hashPassword(input.password)
    } as const;

    await db.insert(users).values(user);
    await this.writeAuditLog(input.actorUserId, "partner.team_user.created", "user", user.id, {
      partnerId: input.partnerId
    });
    return user;
  }

  async createCrmConnection(input: {
    actorUserId: string;
    partnerId: string;
    provider: "amocrm" | "bitrix24";
    portalUrl: string;
    credentials: Record<string, string>;
  }) {
    const adapter = this.crmAdapters.get(input.provider);

    if (!adapter) {
      throw new Error("CRM provider is not supported.");
    }

    const connection = {
      id: randomUUID(),
      partnerId: input.partnerId,
      provider: input.provider,
      portalUrl: input.portalUrl,
      credentials: input.credentials,
      isEnabled: true
    };

    const isValid = await adapter.validateConnection({
      ...connection,
      createdAt: new Date().toISOString()
    });

    if (!isValid) {
      throw new Error("CRM connection is invalid.");
    }

    await db.insert(crmConnections).values(connection);
    await this.writeAuditLog(input.actorUserId, "crm.connection.created", "crm_connection", connection.id, {
      provider: input.provider
    });
    // Секреты обратно не возвращаем — их только что прислал сам клиент
    const { credentials: _credentials, ...safe } = connection;
    return { ...safe, secretHint: maskSecret(input.credentials[SECRET_KEY_BY_PROVIDER[input.provider]] ?? "") };
  }

  /**
   * Замена секрета без пересоздания подключения: ключи протухают, а удалять
   * ради этого подключение — значит терять его историю и идентификатор.
   */
  async updateCrmConnectionCredentials(input: {
    actorUserId: string;
    partnerId: string;
    connectionId: string;
    portalUrl?: string | undefined;
    credentials: Record<string, string>;
  }) {
    const existing = await db.query.crmConnections.findFirst({
      where: and(
        eq(crmConnections.id, input.connectionId),
        eq(crmConnections.partnerId, input.partnerId)
      )
    });
    if (!existing) {
      throw new Error("Подключение CRM не найдено.");
    }

    const adapter = this.crmAdapters.get(existing.provider);
    if (!adapter) {
      throw new Error("CRM provider is not supported.");
    }

    const portalUrl = input.portalUrl?.trim() || existing.portalUrl;
    const isValid = await adapter.validateConnection({
      id: existing.id,
      partnerId: existing.partnerId,
      provider: existing.provider,
      portalUrl,
      credentials: input.credentials,
      isEnabled: existing.isEnabled,
      createdAt: existing.createdAt.toISOString()
    });
    if (!isValid) {
      throw new Error("Заполнены не все поля подключения.");
    }

    await db
      .update(crmConnections)
      .set({ portalUrl, credentials: input.credentials })
      .where(eq(crmConnections.id, input.connectionId));
    await this.writeAuditLog(
      input.actorUserId,
      "crm.connection.credentials_updated",
      "crm_connection",
      input.connectionId,
      { provider: existing.provider }
    );

    return {
      id: existing.id,
      partnerId: existing.partnerId,
      provider: existing.provider,
      portalUrl,
      isEnabled: existing.isEnabled,
      createdAt: existing.createdAt,
      secretHint: maskSecret(input.credentials[SECRET_KEY_BY_PROVIDER[existing.provider]] ?? "")
    };
  }

  /**
   * Наружу отдаём подключения без секретов: вебхук Bitrix24 и токены amoCRM —
   * это полный доступ к CRM партнёра, в браузере им делать нечего. Вместо
   * значения уходит подсказка вида «…a1b2», чтобы владелец узнал свой ключ.
   */
  async listCrmConnections(partnerId: string) {
    const rows = await db
      .select()
      .from(crmConnections)
      .where(eq(crmConnections.partnerId, partnerId));

    return rows.map((row) => {
      const credentials = (row.credentials ?? {}) as Record<string, string>;
      return {
        id: row.id,
        partnerId: row.partnerId,
        provider: row.provider,
        portalUrl: row.portalUrl,
        isEnabled: row.isEnabled,
        createdAt: row.createdAt,
        secretHint: maskSecret(credentials[SECRET_KEY_BY_PROVIDER[row.provider]] ?? "")
      };
    });
  }

  async setCrmConnectionEnabled(input: {
    actorUserId: string;
    partnerId: string;
    connectionId: string;
    isEnabled: boolean;
  }) {
    const existing = await db.query.crmConnections.findFirst({
      where: and(
        eq(crmConnections.id, input.connectionId),
        eq(crmConnections.partnerId, input.partnerId)
      )
    });
    if (!existing) {
      throw new Error("Подключение CRM не найдено.");
    }
    await db
      .update(crmConnections)
      .set({ isEnabled: input.isEnabled })
      .where(eq(crmConnections.id, input.connectionId));
    await this.writeAuditLog(
      input.actorUserId,
      input.isEnabled ? "crm.connection.enabled" : "crm.connection.disabled",
      "crm_connection",
      input.connectionId,
      { isEnabled: input.isEnabled }
    );
    const credentials = (existing.credentials ?? {}) as Record<string, string>;
    return {
      id: existing.id,
      partnerId: existing.partnerId,
      provider: existing.provider,
      portalUrl: existing.portalUrl,
      isEnabled: input.isEnabled,
      createdAt: existing.createdAt,
      secretHint: maskSecret(credentials[SECRET_KEY_BY_PROVIDER[existing.provider]] ?? "")
    };
  }

  async deleteCrmConnection(input: {
    actorUserId: string;
    partnerId: string;
    connectionId: string;
  }) {
    const existing = await db.query.crmConnections.findFirst({
      where: and(
        eq(crmConnections.id, input.connectionId),
        eq(crmConnections.partnerId, input.partnerId)
      )
    });
    if (!existing) {
      throw new Error("Подключение CRM не найдено.");
    }
    await db.delete(crmConnections).where(eq(crmConnections.id, input.connectionId));
    await this.writeAuditLog(
      input.actorUserId,
      "crm.connection.deleted",
      "crm_connection",
      input.connectionId,
      { provider: existing.provider }
    );
  }

  /**
   * Заявка с формы на сайте партнёра. Передача в CRM ещё не реализована,
   * поэтому статус честный: pending, когда CRM подключена и заявку предстоит
   * отправить, skipped — когда отправлять некуда.
  /**
   * Заявка с формы на сайте становится сделкой. Контакт ищем по телефону:
   * тот же покупатель оставляет заявки не по разу, и плодить его копии
   * значит потерять историю общения.
   */
  async createDealFromSite(input: {
    partnerId: string;
    projectId?: string | undefined;
    formName?: string | undefined;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | undefined;
    message?: string | undefined;
    utm?: Record<string, string> | undefined;
    pageUrl?: string | undefined;
  }) {
    const connection = await db.query.crmConnections.findFirst({
      where: and(eq(crmConnections.partnerId, input.partnerId), eq(crmConnections.isEnabled, true))
    });

    const contact = await this.upsertContact({
      partnerId: input.partnerId,
      name: input.customerName,
      phone: input.customerPhone,
      ...(input.customerEmail !== undefined ? { email: input.customerEmail } : {})
    });

    const project = input.projectId
      ? await db.query.catalogProjects.findFirst({
          where: eq(catalogProjects.id, input.projectId)
        })
      : null;

    const formName = input.formName?.trim() || "Форма на сайте";
    const row = {
      id: randomUUID(),
      partnerId: input.partnerId,
      contactId: contact.id,
      // Название по умолчанию — проект, иначе форма: партнёр потом правит
      title: project?.name?.trim() || formName,
      projectId: input.projectId ?? null,
      formName,
      message: input.message ?? null,
      utm: input.utm ?? {},
      pageUrl: input.pageUrl ?? null,
      crmStatus: (connection ? "pending" : "skipped") as "pending" | "skipped"
    };

    await db.insert(deals).values(row);
    await this.addDealEvent(row.id, "created", { formName, contactName: contact.name });
    if (connection) {
      await this.addDealEvent(row.id, "crm_delivery", {
        crmStatus: "pending",
        provider: connection.provider
      });
    }
    return row;
  }

  /** Контакт по телефону: цифры телефона — ключ, имя и почту освежаем */
  private async upsertContact(input: {
    partnerId: string;
    name: string;
    phone: string;
    email?: string | undefined;
  }) {
    const phoneKey = input.phone.replace(/\D/g, "");
    const existing = phoneKey
      ? await db.query.contacts.findFirst({
          where: and(eq(contacts.partnerId, input.partnerId), eq(contacts.phoneKey, phoneKey))
        })
      : null;

    if (existing) {
      const patch: Partial<typeof contacts.$inferInsert> = {};
      // Пустым новым значением затирать известное не будем
      if (input.name.trim() && input.name.trim() !== existing.name) patch.name = input.name.trim();
      if (input.email?.trim() && input.email.trim() !== existing.email) {
        patch.email = input.email.trim();
      }
      if (Object.keys(patch).length > 0) {
        await db.update(contacts).set(patch).where(eq(contacts.id, existing.id));
        return { ...existing, ...patch };
      }
      return existing;
    }

    const row = {
      id: randomUUID(),
      partnerId: input.partnerId,
      name: input.name.trim() || "Без имени",
      phone: input.phone,
      email: input.email?.trim() || null,
      phoneKey: phoneKey || randomUUID()
    };
    await db.insert(contacts).values(row);
    return row;
  }

  /** Событие в ленту карточки. Автор null — покупатель или сама платформа */
  private async addDealEvent(
    dealId: string,
    type:
      | "created"
      | "status_changed"
      | "note"
      | "crm_delivery"
      | "field_changed"
      | "contact_changed",
    payload: Record<string, unknown>,
    authorUserId?: string | undefined
  ) {
    await db.insert(dealEvents).values({
      id: randomUUID(),
      dealId,
      type,
      payload,
      authorUserId: authorUserId ?? null
    });
  }

  /** Сделки партнёра, свежие сверху */
  async listDeals(partnerId: string) {
    const assignee = alias(users, "assignee");
    const rows = await db
      .select({
        deal: deals,
        contact: contacts,
        projectName: catalogProjects.name,
        assigneeName: assignee.fullName
      })
      .from(deals)
      .leftJoin(contacts, eq(contacts.id, deals.contactId))
      .leftJoin(catalogProjects, eq(catalogProjects.id, deals.projectId))
      .leftJoin(assignee, eq(assignee.id, deals.assigneeUserId))
      .where(eq(deals.partnerId, partnerId))
      .orderBy(desc(deals.createdAt));

    return rows.map((row) => ({
      ...row.deal,
      contact: row.contact,
      projectName: row.projectName,
      assigneeName: row.assigneeName
    }));
  }

  /** Сделка целиком: поля, контакт и лента событий */
  async getDeal(partnerId: string, dealId: string) {
    const assignee = alias(users, "assignee");
    const rows = await db
      .select({
        deal: deals,
        contact: contacts,
        projectName: catalogProjects.name,
        assigneeName: assignee.fullName
      })
      .from(deals)
      .leftJoin(contacts, eq(contacts.id, deals.contactId))
      .leftJoin(catalogProjects, eq(catalogProjects.id, deals.projectId))
      .leftJoin(assignee, eq(assignee.id, deals.assigneeUserId))
      .where(and(eq(deals.id, dealId), eq(deals.partnerId, partnerId)))
      .limit(1);

    const found = rows[0];
    if (!found) {
      throw new Error("Сделка не найдена.");
    }

    const events = await db
      .select({ event: dealEvents, authorName: users.fullName })
      .from(dealEvents)
      .leftJoin(users, eq(users.id, dealEvents.authorUserId))
      .where(eq(dealEvents.dealId, dealId))
      .orderBy(desc(dealEvents.createdAt));

    return {
      ...found.deal,
      contact: found.contact,
      projectName: found.projectName,
      assigneeName: found.assigneeName,
      events: events.map((row) => ({ ...row.event, authorName: row.authorName }))
    };
  }

  /** Команда партнёра — из кого выбирать ответственного */
  async listDealAssignees(partnerId: string) {
    const rows = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.partnerId, partnerId), eq(users.isActive, true)));
    return rows;
  }

  /** Партнёр ведёт сделку: правит поля, двигает по воронке, пишет заметку */
  async updateDeal(input: {
    partnerId: string;
    dealId: string;
    actorUserId: string;
    title?: string | undefined;
    status?: "new" | "in_progress" | "won" | "lost" | undefined;
    note?: string | undefined;
    amount?: number | null | undefined;
    assigneeUserId?: string | null | undefined;
  }) {
    const existing = await db.query.deals.findFirst({
      where: and(eq(deals.id, input.dealId), eq(deals.partnerId, input.partnerId))
    });
    if (!existing) {
      throw new Error("Сделка не найдена.");
    }

    const patch: Partial<typeof deals.$inferInsert> = {};
    const events: Array<{
      type: "status_changed" | "note" | "field_changed";
      payload: Record<string, unknown>;
    }> = [];

    if (input.status !== undefined && input.status !== existing.status) {
      patch.status = input.status;
      patch.statusChangedAt = new Date();
      events.push({ type: "status_changed", payload: { from: existing.status, to: input.status } });
    }

    const nextTitle = input.title?.trim();
    if (nextTitle !== undefined && nextTitle !== existing.title) {
      if (!nextTitle) {
        throw new Error("Название сделки не может быть пустым.");
      }
      patch.title = nextTitle;
      events.push({
        type: "field_changed",
        payload: { field: "title", from: existing.title, to: nextTitle }
      });
    }

    if (input.amount !== undefined && input.amount !== existing.amount) {
      patch.amount = input.amount;
      events.push({
        type: "field_changed",
        payload: { field: "amount", from: existing.amount, to: input.amount }
      });
    }

    if (input.assigneeUserId !== undefined && input.assigneeUserId !== existing.assigneeUserId) {
      // Ответственный только из команды партнёра
      if (input.assigneeUserId) {
        const member = await db.query.users.findFirst({
          where: and(eq(users.id, input.assigneeUserId), eq(users.partnerId, input.partnerId))
        });
        if (!member) {
          throw new Error("Сотрудник не найден в вашей команде.");
        }
      }
      patch.assigneeUserId = input.assigneeUserId;
      events.push({
        type: "field_changed",
        payload: { field: "assignee", to: input.assigneeUserId }
      });
    }

    const nextNote = input.note?.trim() || null;
    if (input.note !== undefined && nextNote !== existing.note) {
      patch.note = nextNote;
      events.push({
        type: "note",
        payload: { text: nextNote ?? "", cleared: nextNote === null }
      });
    }

    if (Object.keys(patch).length === 0) {
      return this.getDeal(input.partnerId, input.dealId);
    }

    await db.update(deals).set(patch).where(eq(deals.id, input.dealId));
    for (const event of events) {
      await this.addDealEvent(input.dealId, event.type, event.payload, input.actorUserId);
    }

    return this.getDeal(input.partnerId, input.dealId);
  }

  /** Правка контакта: она видна во всех сделках этого человека */
  async updateContact(input: {
    partnerId: string;
    contactId: string;
    actorUserId: string;
    name?: string | undefined;
    phone?: string | undefined;
    email?: string | null | undefined;
  }) {
    const existing = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, input.contactId), eq(contacts.partnerId, input.partnerId))
    });
    if (!existing) {
      throw new Error("Контакт не найден.");
    }

    const patch: Partial<typeof contacts.$inferInsert> = {};
    const changed: string[] = [];

    const nextName = input.name?.trim();
    if (nextName !== undefined && nextName !== existing.name) {
      if (!nextName) throw new Error("Имя контакта не может быть пустым.");
      patch.name = nextName;
      changed.push("имя");
    }

    const nextPhone = input.phone?.trim();
    if (nextPhone !== undefined && nextPhone !== existing.phone) {
      const phoneKey = nextPhone.replace(/\D/g, "");
      if (!phoneKey) throw new Error("Телефон не может быть пустым.");
      const clash = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.partnerId, input.partnerId),
          eq(contacts.phoneKey, phoneKey),
          ne(contacts.id, input.contactId)
        )
      });
      if (clash) {
        throw new Error("Контакт с таким телефоном уже есть.");
      }
      patch.phone = nextPhone;
      patch.phoneKey = phoneKey;
      changed.push("телефон");
    }

    if (input.email !== undefined) {
      const nextEmail = input.email?.trim() || null;
      if (nextEmail !== existing.email) {
        patch.email = nextEmail;
        changed.push("почту");
      }
    }

    if (Object.keys(patch).length === 0) {
      return existing;
    }

    await db.update(contacts).set(patch).where(eq(contacts.id, input.contactId));

    // Правка контакта касается всех его сделок — отмечаем в каждой ленте
    const related = await db
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.partnerId, input.partnerId), eq(deals.contactId, input.contactId)));
    for (const deal of related) {
      await this.addDealEvent(
        deal.id,
        "contact_changed",
        { changed, name: patch.name ?? existing.name },
        input.actorUserId
      );
    }

    return { ...existing, ...patch };
  }

  async createInquiry(input: {
    actorUserId: string;
    partnerId: string;
    subject: string;
    message: string;
    projectId?: string;
  }) {
    const { messengerService } = await import("../messenger/messenger-service.js");
    const actorUser = await db.query.users.findFirst({ where: eq(users.id, input.actorUserId) });
    if (!actorUser) throw new Error("User not found");

    const conversation = await messengerService.createRequest(
      {
        sub: actorUser.id,
        partnerId: actorUser.partnerId,
        role: actorUser.role,
        fullName: actorUser.fullName
      },
      {
        title: input.subject,
        body: input.message,
        partnerId: input.partnerId,
        ...(input.projectId ? { projectId: input.projectId } : {})
      }
    );

    await this.writeAuditLog(input.actorUserId, "partner.inquiry.created", "messenger_conversation", conversation.id, {
      projectId: input.projectId ?? null,
      requestNumber: conversation.requestNumber
    });

    return conversation;
  }

  async listInquiries(partnerId: string) {
    return db.select().from(partnerInquiries).where(eq(partnerInquiries.partnerId, partnerId));
  }

  private async writeAuditLog(
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>
  ) {
    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorUserId,
      action,
      entityType,
      entityId,
      payload
    });
  }
  /**
   * Общий дилерский раздел: витрина завода до того, как дилер получил свой
   * кабинет с персональными ценами. Цены здесь заводские, одни на всех.
   */
  async listGeneralHouses(technology: "panel_frame" | "modular") {
    const rows = await db
      .select({
        id: catalogProjects.id,
        slug: catalogProjects.slug,
        name: catalogProjects.name,
        technology: catalogProjects.technology,
        area: catalogProjects.area,
        floors: catalogProjects.floors,
        bedrooms: catalogProjects.bedrooms,
        basePrice: catalogProjects.basePrice,
        details: catalogProjects.details
      })
      .from(catalogProjects)
      .where(
        and(eq(catalogProjects.active, true), eq(catalogProjects.technology, technology))
      )
      .orderBy(catalogProjects.basePrice);

    const ids = rows.map((row) => row.id);
    const assets = ids.length
      ? await db
          .select()
          .from(catalogAssets)
          .where(and(inArray(catalogAssets.projectId, ids), eq(catalogAssets.isHidden, false)))
      : [];

    return rows.map((row) => {
      const cover = assets
        .filter((asset) => asset.projectId === row.id && asset.type === "exterior")
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)[0];
      // dimensions в details — объект с готовой подписью вида «13,68×8,98 м»
      const details = (row.details ?? {}) as { dimensions?: { label?: string } };
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        technology: row.technology,
        area: row.area,
        floors: row.floors,
        bedrooms: row.bedrooms,
        basePrice: row.basePrice,
        dimensions: details.dimensions?.label ?? null,
        imageUrl: cover?.localPath || cover?.sourceUrl || null
      };
    });
  }

  /** Продукция завода помимо домов: фермы и кровельные панели */
  async listFactoryProducts(kind?: "truss" | "roof_panel", includeHidden = false) {
    const filters = [];
    if (kind) filters.push(eq(factoryProducts.kind, kind));
    if (!includeHidden) filters.push(eq(factoryProducts.isActive, true));

    return db
      .select()
      .from(factoryProducts)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(factoryProducts.kind, factoryProducts.sortOrder);
  }

  async listDealerMaterials(includeHidden = false) {
    return db
      .select()
      .from(dealerMaterials)
      .where(includeHidden ? undefined : eq(dealerMaterials.isActive, true))
      .orderBy(dealerMaterials.sortOrder);
  }

  /** Сводка для главной общего раздела: счётчики и обложки разделов */
  async getGeneralOverview() {
    const [panel, modular, products, materials] = await Promise.all([
      this.listGeneralHouses("panel_frame"),
      this.listGeneralHouses("modular"),
      db.select().from(factoryProducts).where(eq(factoryProducts.isActive, true)),
      db
        .select({ id: dealerMaterials.id })
        .from(dealerMaterials)
        .where(eq(dealerMaterials.isActive, true))
    ]);

    // Обложка раздела — фото первого проекта: плитка с домом читается быстрее иконки
    const cover = (houses: Array<{ imageUrl: string | null }>) =>
      houses.find((house) => house.imageUrl)?.imageUrl ?? null;

    return {
      panelFrame: panel.length,
      panelFrameCover: cover(panel),
      panelFrameFrom: panel.reduce<number | null>(
        (min, house) =>
          house.basePrice !== null && (min === null || house.basePrice < min) ? house.basePrice : min,
        null
      ),
      modular: modular.length,
      modularCover: cover(modular),
      modularFrom: modular.reduce<number | null>(
        (min, house) =>
          house.basePrice !== null && (min === null || house.basePrice < min) ? house.basePrice : min,
        null
      ),
      trusses: products.filter((item) => item.kind === "truss").length,
      roofPanels: products.filter((item) => item.kind === "roof_panel").length,
      roofPanelPrice: products.find((item) => item.kind === "roof_panel")?.price ?? null,
      materials: materials.length
    };
  }

  async upsertFactoryProduct(input: {
    actorUserId: string;
    id?: string | undefined;
    kind: "truss" | "roof_panel";
    name: string;
    description?: string | undefined;
    sizes?: string | undefined;
    imageUrl?: string | null | undefined;
    price?: number | null | undefined;
    priceUnit?: string | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
  }) {
    const values = {
      kind: input.kind,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      sizes: input.sizes?.trim() ?? "",
      imageUrl: input.imageUrl ?? null,
      price: input.price ?? null,
      priceUnit: input.priceUnit?.trim() ?? "",
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true
    };

    if (input.id) {
      const existing = await db.query.factoryProducts.findFirst({
        where: eq(factoryProducts.id, input.id)
      });
      if (!existing) throw new Error("Позиция не найдена.");
      await db.update(factoryProducts).set(values).where(eq(factoryProducts.id, input.id));
      await this.writeAuditLog(input.actorUserId, "factory_product.updated", "factory_product", input.id, {
        name: values.name
      });
      return { ...existing, ...values };
    }

    const row = { id: randomUUID(), ...values };
    await db.insert(factoryProducts).values(row);
    await this.writeAuditLog(input.actorUserId, "factory_product.created", "factory_product", row.id, {
      name: values.name
    });
    return row;
  }

  async deleteFactoryProduct(actorUserId: string, id: string) {
    const existing = await db.query.factoryProducts.findFirst({
      where: eq(factoryProducts.id, id)
    });
    if (!existing) throw new Error("Позиция не найдена.");
    await db.delete(factoryProducts).where(eq(factoryProducts.id, id));
    await this.writeAuditLog(actorUserId, "factory_product.deleted", "factory_product", id, {
      name: existing.name
    });
  }

  async upsertDealerMaterial(input: {
    actorUserId: string;
    id?: string | undefined;
    title: string;
    description?: string | undefined;
    url: string;
    category?: string | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
  }) {
    const values = {
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      url: input.url.trim(),
      category: input.category?.trim() || "other",
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true
    };

    if (input.id) {
      const existing = await db.query.dealerMaterials.findFirst({
        where: eq(dealerMaterials.id, input.id)
      });
      if (!existing) throw new Error("Подборка не найдена.");
      await db.update(dealerMaterials).set(values).where(eq(dealerMaterials.id, input.id));
      await this.writeAuditLog(input.actorUserId, "dealer_material.updated", "dealer_material", input.id, {
        title: values.title
      });
      return { ...existing, ...values };
    }

    const row = { id: randomUUID(), ...values };
    await db.insert(dealerMaterials).values(row);
    await this.writeAuditLog(input.actorUserId, "dealer_material.created", "dealer_material", row.id, {
      title: values.title
    });
    return row;
  }

  async deleteDealerMaterial(actorUserId: string, id: string) {
    const existing = await db.query.dealerMaterials.findFirst({
      where: eq(dealerMaterials.id, id)
    });
    if (!existing) throw new Error("Подборка не найдена.");
    await db.delete(dealerMaterials).where(eq(dealerMaterials.id, id));
    await this.writeAuditLog(actorUserId, "dealer_material.deleted", "dealer_material", id, {
      title: existing.title
    });
  }

}
