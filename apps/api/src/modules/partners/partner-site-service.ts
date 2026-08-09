import { randomUUID } from "node:crypto";
import { domainToASCII } from "node:url";

import { and, eq, ne } from "drizzle-orm";
import {
  draftDefaultsFromPartner,
  emptyPartnerSiteDraft,
  normalizePartnerSiteDraft,
  slugifySubdomain,
  type PartnerSiteDraft,
  type PartnerSiteStatus
} from "@b2b/site-schema";

import { db } from "../../db/client.js";
import { partnerSites, partners } from "../../db/schema.js";
import { notificationService } from "../notifications/notification-service.js";

export type PartnerSiteRecord = {
  id: string;
  partnerId: string;
  subdomain: string;
  domain: string | null;
  status: PartnerSiteStatus;
  /** Черновик кабинета — то, что редактирует партнёр */
  config: PartnerSiteDraft;
  /** Живая версия сайта; null — сайт ещё не публиковался */
  publishedConfig: PartnerSiteDraft | null;
  /** Черновик разошёлся с опубликованной версией: есть что публиковать */
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  publishLocked: boolean;
  publishLockedAt: string | null;
  publishLockNotice: string | null;
  publishLockNoticeReadAt: string | null;
  republishRequestStatus: "pending" | null;
  republishRequestedAt: string | null;
  republishRequestComment: string | null;
  createdAt: string;
  updatedAt: string;
  partner?: {
    companyName: string;
    legalName: string | null;
    inn: string | null;
  } | undefined;
};

const HQ_UNPUBLISH_NOTICE =
  "Администратор сети снял ваш сайт с публикации. Повторная публикация заблокирована — запросите возобновление или дождитесь разблокировки сетью.";

function mapLockFields(row: typeof partnerSites.$inferSelect) {
  const requestStatus = row.republishRequestStatus === "pending" ? ("pending" as const) : null;
  return {
    publishLocked: Boolean(row.publishLocked),
    publishLockedAt: row.publishLockedAt?.toISOString() ?? null,
    publishLockNotice: row.publishLockNotice ?? null,
    publishLockNoticeReadAt: row.publishLockNoticeReadAt?.toISOString() ?? null,
    republishRequestStatus: requestStatus,
    republishRequestedAt: row.republishRequestedAt?.toISOString() ?? null,
    republishRequestComment: row.republishRequestComment ?? null
  };
}

function normalizeHost(host: string): string {
  const cleaned = host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/:\d+$/, "")
    .replace(/\/$/, "")
    .split("/")[0]
    ?.trim() ?? "";

  if (!cleaned) return "";

  // Кириллица / IDN → punycode (Host от браузера и Dokploy — ASCII)
  try {
    const ascii = domainToASCII(cleaned);
    return ascii || cleaned;
  } catch {
    return cleaned;
  }
}

/**
 * Готовит запись к публичной выдаче: наружу под `config` уходит опубликованная
 * версия, а не черновик кабинета. Сайты, опубликованные до появления
 * `published_config`, отдаются как раньше — иначе они бы обнулились.
 */
function asPublicRecord(record: PartnerSiteRecord): PartnerSiteRecord {
  const live = record.publishedConfig ?? record.config;
  return {
    ...record,
    config: {
      ...live,
      subdomain: record.subdomain,
      domain: record.domain ?? ""
    },
    publishedConfig: live,
    hasUnpublishedChanges: false
  };
}

async function withPartner(row: typeof partnerSites.$inferSelect): Promise<PartnerSiteRecord> {
  const base = mapRow(row);
  const partner = await db.query.partners.findFirst({
    where: eq(partners.id, row.partnerId)
  });
  if (!partner) return base;
  return {
    ...base,
    partner: {
      companyName: partner.companyName,
      legalName: partner.legalName,
      inn: partner.inn
    }
  };
}

function mapRow(row: typeof partnerSites.$inferSelect): PartnerSiteRecord {
  const config =
    normalizePartnerSiteDraft(
      (row.config ?? {}) as Partial<PartnerSiteDraft> & Record<string, unknown>
    ) ?? emptyPartnerSiteDraft;

  const draft: PartnerSiteDraft = {
    ...config,
    subdomain: row.subdomain,
    domain: row.domain ?? ""
  };

  const publishedConfig = row.publishedConfig
    ? (normalizePartnerSiteDraft(
        row.publishedConfig as Partial<PartnerSiteDraft> & Record<string, unknown>
      ) ?? null)
    : null;

  return {
    id: row.id,
    partnerId: row.partnerId,
    subdomain: row.subdomain,
    domain: row.domain,
    status: row.status,
    config: draft,
    publishedConfig,
    // Сравниваем по значению: партнёр должен видеть, есть ли что публиковать
    hasUnpublishedChanges:
      row.status === "published" && JSON.stringify(publishedConfig) !== JSON.stringify(draft),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    ...mapLockFields(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class PartnerSiteService {
  /** Создать черновик сайта для партнёра, если ещё нет */
  async ensurePartnerSite(partnerId: string): Promise<PartnerSiteRecord> {
    const existing = await db.query.partnerSites.findFirst({
      where: eq(partnerSites.partnerId, partnerId)
    });
    if (existing) return mapRow(existing);

    const partner = await db.query.partners.findFirst({
      where: eq(partners.id, partnerId)
    });
    if (!partner) {
      throw new Error("Partner not found.");
    }

    const defaults = draftDefaultsFromPartner({
      companyName: partner.companyName,
      region: partner.region,
      email: partner.email,
      phone: partner.phone
    });
    const subdomain = await this.allocateSubdomain(defaults.subdomain, partnerId);

    const row = {
      id: randomUUID(),
      partnerId,
      subdomain,
      domain: null as string | null,
      status: "draft" as const,
      config: { ...defaults, subdomain, domain: "" },
      publishedConfig: null as PartnerSiteDraft | null,
      publishedAt: null as Date | null,
      publishLocked: false,
      publishLockedAt: null as Date | null,
      publishLockedByUserId: null as string | null,
      publishLockNotice: null as string | null,
      publishLockNoticeReadAt: null as Date | null,
      republishRequestStatus: null as string | null,
      republishRequestedAt: null as Date | null,
      republishRequestComment: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.insert(partnerSites).values(row);
    return mapRow(row);
  }

  async getByPartnerId(partnerId: string): Promise<PartnerSiteRecord> {
    return this.ensurePartnerSite(partnerId);
  }

  async updateSite(
    partnerId: string,
    input: {
      config: PartnerSiteDraft;
      publish?: boolean;
    }
  ): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(partnerId);
    const normalized =
      normalizePartnerSiteDraft(input.config as PartnerSiteDraft & Record<string, unknown>) ??
      site.config;

    const subdomain = await this.allocateSubdomain(
      slugifySubdomain(normalized.subdomain || site.subdomain),
      partnerId
    );
    const domainRaw = normalized.domain.trim();
    const domain = domainRaw ? normalizeHost(domainRaw) : null;

    if (domain) {
      const clash = await db.query.partnerSites.findFirst({
        where: and(eq(partnerSites.domain, domain), ne(partnerSites.partnerId, partnerId))
      });
      if (clash) {
        throw new Error("Этот домен уже занят другим партнёром.");
      }
    }

    const nextStatus: PartnerSiteStatus = input.publish ? "published" : site.status;
    if (input.publish && site.publishLocked) {
      throw new Error(
        "Публикация заблокирована администратором сети. Запросите возобновление или дождитесь разблокировки."
      );
    }
    const publishedAt =
      input.publish && site.status !== "published"
        ? new Date()
        : site.publishedAt
          ? new Date(site.publishedAt)
          : null;

    const config: PartnerSiteDraft = {
      ...normalized,
      subdomain,
      domain: domain ?? ""
    };

    await db
      .update(partnerSites)
      .set({
        subdomain,
        domain,
        config,
        // Живую версию трогает только публикация: сохранение в кабинете
        // не должно менять то, что видят покупатели
        ...(input.publish ? { publishedConfig: config } : {}),
        status: nextStatus,
        publishedAt,
        updatedAt: new Date()
      })
      .where(eq(partnerSites.id, site.id));

    return this.getByPartnerId(partnerId);
  }

  async publish(partnerId: string): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(partnerId);
    return this.updateSite(partnerId, { config: site.config, publish: true });
  }

  /** Партнёр снимает сайт — без блокировки повторной публикации */
  async unpublishByPartner(partnerId: string): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(partnerId);
    if (site.status !== "published") {
      return site;
    }
    await db
      .update(partnerSites)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(partnerSites.id, site.id));
    return this.getByPartnerId(partnerId);
  }

  /** HQ снимает сайт и блокирует повторную публикацию дилером */
  async unpublishByHq(input: {
    partnerId: string;
    actorUserId: string;
    notice?: string | undefined;
  }): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(input.partnerId);
    const notice = input.notice?.trim() || HQ_UNPUBLISH_NOTICE;
    await db
      .update(partnerSites)
      .set({
        status: "draft",
        publishLocked: true,
        publishLockedAt: new Date(),
        publishLockedByUserId: input.actorUserId,
        publishLockNotice: notice,
        publishLockNoticeReadAt: null,
        republishRequestStatus: null,
        republishRequestedAt: null,
        republishRequestComment: null,
        updatedAt: new Date()
      })
      .where(eq(partnerSites.id, site.id));

    const partner = await db.query.partners.findFirst({ where: eq(partners.id, input.partnerId) });
    await notificationService.notifyPartnerUsers(input.partnerId, {
      type: "site.unpublished_by_hq",
      title: "Сайт снят с публикации",
      body: notice,
      entityType: "partner_site",
      entityId: site.id,
      actionUrl: "/partner/site",
      excludeUserId: input.actorUserId,
      payload: { companyName: partner?.companyName ?? null }
    });

    return this.getByPartnerId(input.partnerId);
  }

  async requestRepublish(input: {
    partnerId: string;
    comment?: string | undefined;
    actorUserId?: string | undefined;
  }): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(input.partnerId);
    if (!site.publishLocked) {
      throw new Error("Публикация не заблокирована — можно опубликовать сайт самостоятельно.");
    }
    if (site.republishRequestStatus === "pending") {
      return site;
    }
    await db
      .update(partnerSites)
      .set({
        republishRequestStatus: "pending",
        republishRequestedAt: new Date(),
        republishRequestComment: input.comment?.trim() || null,
        updatedAt: new Date()
      })
      .where(eq(partnerSites.id, site.id));

    const partner = await db.query.partners.findFirst({ where: eq(partners.id, input.partnerId) });
    const companyName = partner?.companyName ?? "Партнёр";
    await notificationService.notifyCompanyUsers({
      type: "site.republish.requested",
      title: "Запрос на возобновление публикации",
      body: `${companyName} просит снова опубликовать сайт${
        input.comment?.trim() ? `: ${input.comment.trim()}` : "."
      }`,
      partnerId: input.partnerId,
      entityType: "partner_site",
      entityId: site.id,
      actionUrl: `/company/partners/${input.partnerId}?tab=site`,
      excludeUserId: input.actorUserId,
      payload: { companyName, comment: input.comment?.trim() || null }
    });

    return this.getByPartnerId(input.partnerId);
  }

  async markPublishLockNoticeRead(partnerId: string): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(partnerId);
    if (!site.publishLockNotice || site.publishLockNoticeReadAt) {
      return site;
    }
    await db
      .update(partnerSites)
      .set({ publishLockNoticeReadAt: new Date(), updatedAt: new Date() })
      .where(eq(partnerSites.id, site.id));
    return this.getByPartnerId(partnerId);
  }

  /** HQ разблокирует возможность публикации (сайт остаётся draft) */
  async unlockPublishByHq(input: {
    partnerId: string;
    actorUserId?: string | undefined;
  }): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(input.partnerId);
    await db
      .update(partnerSites)
      .set({
        publishLocked: false,
        publishLockedAt: null,
        publishLockedByUserId: null,
        publishLockNotice: null,
        publishLockNoticeReadAt: null,
        republishRequestStatus: null,
        republishRequestedAt: null,
        republishRequestComment: null,
        updatedAt: new Date()
      })
      .where(eq(partnerSites.id, site.id));

    await notificationService.notifyPartnerUsers(input.partnerId, {
      type: "site.publish.unlocked",
      title: "Публикация разблокирована",
      body: "Администратор сети снова разрешил публикацию сайта. Вы можете опубликовать сайт самостоятельно.",
      entityType: "partner_site",
      entityId: site.id,
      actionUrl: "/partner/site",
      excludeUserId: input.actorUserId
    });

    return this.getByPartnerId(input.partnerId);
  }

  /** HQ одобряет запрос — снимает lock и сразу публикует */
  async approveRepublishByHq(input: {
    partnerId: string;
    actorUserId?: string | undefined;
  }): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(input.partnerId);
    await db
      .update(partnerSites)
      .set({
        status: "published",
        // Партнёр правил черновик под замечания HQ: одобрение должно вернуть в
        // эфир исправленную версию, а не ту, из-за которой сайт сняли
        publishedConfig: site.config,
        publishedAt: site.publishedAt ? new Date(site.publishedAt) : new Date(),
        publishLocked: false,
        publishLockedAt: null,
        publishLockedByUserId: null,
        publishLockNotice: null,
        publishLockNoticeReadAt: null,
        republishRequestStatus: null,
        republishRequestedAt: null,
        republishRequestComment: null,
        updatedAt: new Date()
      })
      .where(eq(partnerSites.id, site.id));

    await notificationService.notifyPartnerUsers(input.partnerId, {
      type: "site.republish.approved",
      title: "Публикация возобновлена",
      body: "Администратор сети одобрил запрос — ваш сайт снова опубликован.",
      entityType: "partner_site",
      entityId: site.id,
      actionUrl: "/partner/site",
      excludeUserId: input.actorUserId
    });

    return this.getByPartnerId(input.partnerId);
  }

  async rejectRepublishByHq(input: {
    partnerId: string;
    actorUserId?: string | undefined;
  }): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(input.partnerId);
    await db
      .update(partnerSites)
      .set({
        republishRequestStatus: null,
        republishRequestedAt: null,
        republishRequestComment: null,
        updatedAt: new Date()
      })
      .where(eq(partnerSites.id, site.id));

    await notificationService.notifyPartnerUsers(input.partnerId, {
      type: "site.republish.rejected",
      title: "Запрос на возобновление отклонён",
      body: "Администратор сети отклонил запрос на публикацию. Сайт остаётся заблокированным.",
      entityType: "partner_site",
      entityId: site.id,
      actionUrl: "/partner/site",
      excludeUserId: input.actorUserId
    });

    return this.getByPartnerId(input.partnerId);
  }

  /**
   * Резолв публичного сайта по Host (только published).
   *
   * Наружу отдаётся опубликованная версия, а не черновик кабинета: партнёр
   * правит config, и покупатель не должен видеть незаконченные правки.
   */
  async resolveByHost(host: string): Promise<PartnerSiteRecord | null> {
    const normalized = normalizeHost(host);
    if (!normalized) return null;

    const byDomain = await db.query.partnerSites.findFirst({
      where: and(eq(partnerSites.domain, normalized), eq(partnerSites.status, "published"))
    });
    if (byDomain) return asPublicRecord(await withPartner(byDomain));

    const suffix = ".avgst.ru";
    if (normalized.endsWith(suffix)) {
      const sub = normalized.slice(0, -suffix.length);
      if (sub && !sub.includes(".")) {
        const bySub = await db.query.partnerSites.findFirst({
          where: and(eq(partnerSites.subdomain, sub), eq(partnerSites.status, "published"))
        });
        if (bySub) return asPublicRecord(await withPartner(bySub));
      }
    }

    return null;
  }

  /** Публичная выдача по partnerId: тоже только опубликованная версия */
  async resolvePublishedByPartnerId(partnerId: string): Promise<PartnerSiteRecord | null> {
    const site = await db.query.partnerSites.findFirst({
      where: and(eq(partnerSites.partnerId, partnerId), eq(partnerSites.status, "published"))
    });
    return site ? asPublicRecord(mapRow(site)) : null;
  }

  private async allocateSubdomain(preferred: string, partnerId: string): Promise<string> {
    let base = slugifySubdomain(preferred);
    for (let i = 0; i < 20; i += 1) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const clash = await db.query.partnerSites.findFirst({
        where: and(eq(partnerSites.subdomain, candidate), ne(partnerSites.partnerId, partnerId))
      });
      if (!clash) return candidate;
    }
    return `${base}-${randomUUID().slice(0, 6)}`;
  }
}

export const partnerSiteService = new PartnerSiteService();
