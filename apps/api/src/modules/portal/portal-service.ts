import { randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

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
  crmConnections,
  partnerApplications,
  partnerInquiries,
  partnerProjectPrices,
  partners,
  partnerSites,
  passwordResetTokens,
  siteRequests,
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
   */
  async createSiteRequest(input: {
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

    const row = {
      id: randomUUID(),
      partnerId: input.partnerId,
      projectId: input.projectId ?? null,
      formName: input.formName?.trim() || "Форма на сайте",
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      message: input.message ?? null,
      utm: input.utm ?? {},
      pageUrl: input.pageUrl ?? null,
      crmStatus: (connection ? "pending" : "skipped") as "pending" | "skipped"
    };

    await db.insert(siteRequests).values(row);
    return row;
  }

  /** Заявки партнёра, свежие сверху. Имя проекта — чтобы не тянуть каталог в кабинет */
  async listSiteRequests(partnerId: string) {
    const rows = await db
      .select({
        request: siteRequests,
        projectName: catalogProjects.name
      })
      .from(siteRequests)
      .leftJoin(catalogProjects, eq(catalogProjects.id, siteRequests.projectId))
      .where(eq(siteRequests.partnerId, partnerId))
      .orderBy(desc(siteRequests.createdAt));

    return rows.map((row) => ({ ...row.request, projectName: row.projectName }));
  }

  /** Партнёр ведёт заявку: двигает по воронке и пишет, о чём договорились */
  async updateSiteRequest(input: {
    partnerId: string;
    requestId: string;
    status?: "new" | "in_progress" | "won" | "lost" | undefined;
    note?: string | undefined;
  }) {
    const existing = await db.query.siteRequests.findFirst({
      where: and(
        eq(siteRequests.id, input.requestId),
        eq(siteRequests.partnerId, input.partnerId)
      )
    });
    if (!existing) {
      throw new Error("Заявка не найдена.");
    }

    const patch: Partial<typeof siteRequests.$inferInsert> = {};
    if (input.status !== undefined && input.status !== existing.status) {
      patch.status = input.status;
      patch.statusChangedAt = new Date();
    }
    if (input.note !== undefined) {
      patch.note = input.note.trim() || null;
    }
    if (Object.keys(patch).length === 0) {
      return existing;
    }

    await db.update(siteRequests).set(patch).where(eq(siteRequests.id, input.requestId));
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
}
