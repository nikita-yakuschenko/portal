import { randomUUID } from "node:crypto";
import { domainToASCII } from "node:url";

import { and, eq, ne } from "drizzle-orm";
import {
  draftDefaultsFromPartner,
  emptyPartnerSiteDraft,
  normalizePartnerSiteDraft,
  type PartnerSiteDraft,
  type PartnerSiteStatus
} from "@b2b/site-schema";

import { db } from "../../db/client.js";
import { partnerSites, partners } from "../../db/schema.js";

export type PartnerSiteRecord = {
  id: string;
  partnerId: string;
  subdomain: string;
  domain: string | null;
  status: PartnerSiteStatus;
  config: PartnerSiteDraft;
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

function slugifySubdomain(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const ascii = slug
    .replace(/[а-яё]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || "partner";
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

  return {
    id: row.id,
    partnerId: row.partnerId,
    subdomain: row.subdomain,
    domain: row.domain,
    status: row.status,
    config: {
      ...config,
      subdomain: row.subdomain,
      domain: row.domain ?? ""
    },
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
    return this.getByPartnerId(input.partnerId);
  }

  async requestRepublish(input: {
    partnerId: string;
    comment?: string | undefined;
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
  async unlockPublishByHq(partnerId: string): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(partnerId);
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
    return this.getByPartnerId(partnerId);
  }

  /** HQ одобряет запрос — снимает lock и сразу публикует */
  async approveRepublishByHq(partnerId: string): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(partnerId);
    await db
      .update(partnerSites)
      .set({
        status: "published",
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
    return this.getByPartnerId(partnerId);
  }

  async rejectRepublishByHq(partnerId: string): Promise<PartnerSiteRecord> {
    const site = await this.ensurePartnerSite(partnerId);
    await db
      .update(partnerSites)
      .set({
        republishRequestStatus: null,
        republishRequestedAt: null,
        republishRequestComment: null,
        updatedAt: new Date()
      })
      .where(eq(partnerSites.id, site.id));
    return this.getByPartnerId(partnerId);
  }

  /** Резолв публичного сайта по Host (только published) */
  async resolveByHost(host: string): Promise<PartnerSiteRecord | null> {
    const normalized = normalizeHost(host);
    if (!normalized) return null;

    const byDomain = await db.query.partnerSites.findFirst({
      where: and(eq(partnerSites.domain, normalized), eq(partnerSites.status, "published"))
    });
    if (byDomain) return withPartner(byDomain);

    const suffix = ".avgst.ru";
    if (normalized.endsWith(suffix)) {
      const sub = normalized.slice(0, -suffix.length);
      if (sub && !sub.includes(".")) {
        const bySub = await db.query.partnerSites.findFirst({
          where: and(eq(partnerSites.subdomain, sub), eq(partnerSites.status, "published"))
        });
        if (bySub) return withPartner(bySub);
      }
    }

    return null;
  }

  /** Резолв для превью: любой статус по partnerId */
  async resolvePublishedByPartnerId(partnerId: string): Promise<PartnerSiteRecord | null> {
    const site = await db.query.partnerSites.findFirst({
      where: and(eq(partnerSites.partnerId, partnerId), eq(partnerSites.status, "published"))
    });
    return site ? mapRow(site) : null;
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
