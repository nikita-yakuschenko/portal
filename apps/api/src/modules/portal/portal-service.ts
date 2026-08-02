import { randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq, inArray, or } from "drizzle-orm";

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
  catalogProjects,
  catalogSyncRuns,
  crmConnections,
  leadDeliveries,
  leadEvents,
  partnerApplications,
  partnerInquiries,
  partnerProjectPrices,
  partners,
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
  mergeExtraOptionLibrary,
  normalizeExtraGroups,
  normalizePricingMode,
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

function normalizeOptionalNumber(value: number | null): number | undefined {
  return value ?? undefined;
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
          await db
            .update(catalogProjects)
            .set({
              name: mapped.name,
              slug: projectSlug(mapped.name),
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
              active: true,
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
    const [projects, priceRows] = await Promise.all([
      this.listCatalogProjects(),
      db.select().from(partnerProjectPrices).where(eq(partnerProjectPrices.partnerId, partnerId))
    ]);

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

      const display = resolvePartnerDisplayPrice(project.basePrice, pricing);
      const visible = this.withVisibleAssets(project);
      // Список витрины: только обложка — иначе JSON и сеть раздуваются десятками фото
      const cover =
        visible.assets.find((asset) => asset.isPrimary) ?? visible.assets[0] ?? null;

      return {
        ...visible,
        assets: cover ? [cover] : [],
        factoryBasePrice: project.basePrice ?? null,
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
    if (!project) return null;

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

    const display = resolvePartnerDisplayPrice(mapped.basePrice, pricing);
    const visible = this.withVisibleAssets(mapped);

    return {
      ...visible,
      factoryBasePrice: mapped.basePrice ?? null,
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
      const display = resolvePartnerDisplayPrice(
        project.basePrice,
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
  }) {
    const project = await db.query.catalogProjects.findFirst({
      where: eq(catalogProjects.id, input.projectId)
    });
    if (!project) {
      throw new Error("Проект не найден");
    }

    const pricingMode = normalizePricingMode(input.pricingMode);
    const extras = normalizeExtraGroups(input.extras ?? []);
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

    const payload = {
      pricingMode,
      markupPercent,
      publicPrice,
      priceOnRequest,
      isPublished: input.isPublished ?? existing?.isPublished ?? false,
      extras,
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

    const assets = await db.select().from(catalogAssets).where(eq(catalogAssets.projectId, project.id));
    return this.mapCatalogProject(project, assets);
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
        ...(patch.active !== undefined ? { active: patch.active } : {})
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

  private mapCatalogProject(
    project: typeof catalogProjects.$inferSelect,
    assets: Array<typeof catalogAssets.$inferSelect>
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
      currency: project.currency,
      projectUrl: project.projectUrl,
      active: project.active,
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

  async listPartnerTeam(partnerId: string) {
    return db.select().from(users).where(eq(users.partnerId, partnerId)).orderBy(users.fullName);
  }

  async createPartnerTeamUser(input: {
    actorUserId: string;
    partnerId: string;
    fullName: string;
    email: string;
    password: string;
    role: "partner_owner" | "partner_member";
  }) {
    const user = {
      id: randomUUID(),
      partnerId: input.partnerId,
      fullName: input.fullName,
      email: input.email,
      role: input.role,
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
    return connection;
  }

  async listCrmConnections(partnerId: string) {
    return db.select().from(crmConnections).where(eq(crmConnections.partnerId, partnerId));
  }

  async createLead(input: {
    partnerId: string;
    projectId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    message?: string;
  }) {
    const lead = {
      id: randomUUID(),
      partnerId: input.partnerId,
      type: (input.projectId ? "price_request" : "contact_request") as
        | "price_request"
        | "contact_request",
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      metadata: {}
    } as {
      id: string;
      partnerId: string;
      projectId?: string;
      type: "price_request" | "contact_request";
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      message?: string;
      metadata: Record<string, never>;
    };

    if (input.projectId !== undefined) {
      lead.projectId = input.projectId;
    }
    if (input.customerEmail !== undefined) {
      lead.customerEmail = input.customerEmail;
    }
    if (input.message !== undefined) {
      lead.message = input.message;
    }

    await db.insert(leadEvents).values(lead);

    const connection = await db.query.crmConnections.findFirst({
      where: and(eq(crmConnections.partnerId, input.partnerId), eq(crmConnections.isEnabled, true))
    });

    if (!connection) {
      return { lead };
    }

    const project = input.projectId
      ? await db.query.catalogProjects.findFirst({
          where: eq(catalogProjects.id, input.projectId)
        })
      : null;
    const partner = await db.query.partners.findFirst({
      where: eq(partners.id, input.partnerId)
    });

    if (!partner) {
      return { lead };
    }

    const adapter = this.crmAdapters.get(connection.provider);
    if (!adapter) {
      return { lead };
    }

    const partnerPayload = {
      id: partner.id,
      companyName: partner.companyName,
      status: partner.status,
      region: partner.region,
      email: partner.email,
      phone: partner.phone,
      createdAt: partner.createdAt.toISOString()
    } as {
      id: string;
      companyName: string;
      legalName?: string;
      status: "pending" | "active" | "suspended";
      region: string;
      managerName?: string;
      email: string;
      phone: string;
      createdAt: string;
    };

    if (partner.legalName !== null) {
      partnerPayload.legalName = partner.legalName;
    }
    if (partner.managerName !== null) {
      partnerPayload.managerName = partner.managerName;
    }

    const projectPayload = project
      ? ({
          id: project.id,
          source: project.source,
          sourceUid: project.sourceUid,
          name: project.name,
          slug: project.slug,
          description: project.description,
          technology:
            project.technology === "panel_frame" ? ("panel_frame" as const) : ("modular" as const),
          details: buildProjectDetails({
            name: project.name,
            technology:
              project.technology === "panel_frame" ? "panel_frame" : "modular",
            characteristics: []
          }),
          currency: project.currency,
          projectUrl: project.projectUrl,
          active: project.active,
          sourcePayload: project.sourcePayload as Record<string, unknown>,
          lastSyncedAt: project.lastSyncedAt.toISOString(),
          assets: []
        } as {
          id: string;
          source: "tilda";
          sourceUid: string;
          name: string;
          slug: string;
          description: string;
          technology: "modular" | "panel_frame";
          details: CatalogProjectDetails;
          area?: number;
          floors?: number;
          bedrooms?: number;
          bathrooms?: string;
          basePrice?: number;
          currency: string;
          projectUrl: string;
          active: boolean;
          sourcePayload: Record<string, unknown>;
          lastSyncedAt: string;
          assets: never[];
        })
      : undefined;

    if (projectPayload && project && project.area !== null) {
      projectPayload.area = project.area;
    }
    if (projectPayload && project && project.floors !== null) {
      projectPayload.floors = project.floors;
    }
    if (projectPayload && project && project.bedrooms !== null) {
      projectPayload.bedrooms = project.bedrooms;
    }
    if (projectPayload && project && project.bathrooms !== null) {
      projectPayload.bathrooms = project.bathrooms;
    }
    if (projectPayload && project && project.basePrice !== null) {
      projectPayload.basePrice = project.basePrice;
    }

    const leadEventPayload = {
      id: lead.id,
      partnerId: lead.partnerId,
      siteId: "portal",
      type: lead.type,
      customerName: lead.customerName,
      customerPhone: lead.customerPhone,
      metadata: {},
      createdAt: new Date().toISOString()
    } as {
      id: string;
      partnerId: string;
      siteId: string;
      projectId?: string;
      type: "project_view" | "price_request" | "contact_request" | "crm_delivery_succeeded" | "crm_delivery_failed";
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      message?: string;
      metadata: Record<string, string>;
      createdAt: string;
    };

    if (lead.projectId !== undefined) {
      leadEventPayload.projectId = lead.projectId;
    }
    if (lead.customerEmail !== undefined) {
      leadEventPayload.customerEmail = lead.customerEmail;
    }
    if (lead.message !== undefined) {
      leadEventPayload.message = lead.message;
    }

    const sendPayload = {
      leadEvent: leadEventPayload,
      partner: partnerPayload,
      site: {
        id: "portal",
        partnerId: partner.id,
        name: "portal",
        status: "published" as const,
        subdomain: "portal",
        theme: "default",
        contactPhone: partner.phone,
        contactEmail: partner.email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    } as {
      leadEvent: typeof leadEventPayload;
      partner: typeof partnerPayload;
      site: {
        id: string;
        partnerId: string;
        name: string;
        status: "published";
        subdomain: string;
        theme: string;
        contactPhone: string;
        contactEmail: string;
        createdAt: string;
        updatedAt: string;
      };
    };

    const sendResult: CrmSendResult = await adapter.sendLead(
      {
        id: connection.id,
        partnerId: connection.partnerId,
        provider: connection.provider,
        portalUrl: connection.portalUrl,
        credentials: connection.credentials as Record<string, string>,
        isEnabled: connection.isEnabled,
        createdAt: connection.createdAt.toISOString()
      },
      projectPayload ? { ...sendPayload, project: projectPayload } : sendPayload
    );

    await db.insert(leadDeliveries).values({
      id: randomUUID(),
      leadEventId: lead.id,
      crmConnectionId: connection.id,
      status: sendResult.success ? "sent" : "failed",
      externalLeadId: sendResult.externalLeadId,
      errorMessage: sendResult.errorMessage,
      attemptedAt: new Date()
    });

    return { lead, sendResult };
  }

  async listPartnerLeads(partnerId: string) {
    const events = await db.select().from(leadEvents).where(eq(leadEvents.partnerId, partnerId));
    const deliveries = await db
      .select()
      .from(leadDeliveries)
      .where(
        inArray(
          leadDeliveries.leadEventId,
          events.map((event) => event.id).length > 0 ? events.map((event) => event.id) : ["__none__"]
        )
      );

    return { events, deliveries };
  }

  async createInquiry(input: {
    actorUserId: string;
    partnerId: string;
    subject: string;
    message: string;
    projectId?: string;
  }) {
    const inquiry = {
      id: randomUUID(),
      partnerId: input.partnerId,
      subject: input.subject,
      message: input.message
    };
    await db.insert(partnerInquiries).values(inquiry);
    await this.writeAuditLog(input.actorUserId, "partner.inquiry.created", "partner_inquiry", inquiry.id, {
      projectId: input.projectId ?? null
    });
    return inquiry;
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
