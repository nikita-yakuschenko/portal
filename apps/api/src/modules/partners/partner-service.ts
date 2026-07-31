import type { Partner, PartnerProjectPrice, PartnerSite, PartnerUser } from "@b2b/domain";

import { createId } from "../../lib/ids.js";
import { slugify } from "../../lib/slug.js";

export interface CreatePartnerInput {
  companyName: string;
  region: string;
  email: string;
  phone: string;
  ownerName: string;
}

export interface UpdateSiteInput {
  siteId: string;
  contactPhone: string;
  contactEmail: string;
  address?: string;
  yandexMetrikaCounter?: string;
  googleTagManagerId?: string;
}

export class PartnerService {
  private readonly partners = new Map<string, Partner>();
  private readonly users = new Map<string, PartnerUser>();
  private readonly sites = new Map<string, PartnerSite>();
  private readonly prices = new Map<string, PartnerProjectPrice>();

  createPartner(input: CreatePartnerInput): {
    partner: Partner;
    user: PartnerUser;
    site: PartnerSite;
  } {
    const now = new Date().toISOString();
    const partnerId = createId();
    const siteId = createId();

    const partner: Partner = {
      id: partnerId,
      companyName: input.companyName,
      status: "active",
      region: input.region,
      email: input.email,
      phone: input.phone,
      createdAt: now
    };

    const user: PartnerUser = {
      id: createId(),
      partnerId,
      email: input.email,
      fullName: input.ownerName,
      role: "partner_owner"
    };

    const site: PartnerSite = {
      id: siteId,
      partnerId,
      name: `${input.companyName} сайт`,
      status: "draft",
      subdomain: slugify(input.companyName),
      theme: "default",
      contactPhone: input.phone,
      contactEmail: input.email,
      createdAt: now,
      updatedAt: now
    };

    this.partners.set(partnerId, partner);
    this.users.set(user.id, user);
    this.sites.set(siteId, site);

    return { partner, user, site };
  }

  listPartners(): Partner[] {
    return [...this.partners.values()];
  }

  getPartner(partnerId: string): Partner | undefined {
    return this.partners.get(partnerId);
  }

  listSites(partnerId?: string): PartnerSite[] {
    const sites = [...this.sites.values()];
    return partnerId ? sites.filter((site) => site.partnerId === partnerId) : sites;
  }

  updateSite(input: UpdateSiteInput): PartnerSite | undefined {
    const site = this.sites.get(input.siteId);

    if (!site) {
      return undefined;
    }

    const analytics: NonNullable<PartnerSite["analytics"]> = {};
    if (input.yandexMetrikaCounter !== undefined) {
      analytics.yandexMetrikaCounter = input.yandexMetrikaCounter;
    }
    if (input.googleTagManagerId !== undefined) {
      analytics.googleTagManagerId = input.googleTagManagerId;
    }

    const nextSite: PartnerSite = {
      ...site,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      updatedAt: new Date().toISOString()
    };

    if (input.address !== undefined) {
      nextSite.address = input.address;
    }
    if (Object.keys(analytics).length > 0) {
      nextSite.analytics = analytics;
    }

    this.sites.set(site.id, nextSite);
    return nextSite;
  }

  upsertProjectPrice(
    partnerId: string,
    projectId: string,
    input: {
      pricingMode?: "markup" | "exact" | "on_request";
      publicPrice?: number;
      markupPercent?: number;
    } = {}
  ): PartnerProjectPrice {
    const existing = [...this.prices.values()].find(
      (price) => price.partnerId === partnerId && price.projectId === projectId
    );

    const pricingMode = input.pricingMode ?? (input.publicPrice !== undefined ? "exact" : "on_request");
    const nextPrice: PartnerProjectPrice = {
      id: existing?.id ?? createId(),
      partnerId,
      projectId,
      pricingMode,
      priceOnRequest: pricingMode === "on_request",
      isPublished: true,
      extras: existing?.extras ?? [],
      updatedAt: new Date().toISOString()
    };

    if (pricingMode === "exact" && input.publicPrice !== undefined) {
      nextPrice.publicPrice = input.publicPrice;
    }
    if (pricingMode === "markup" && input.markupPercent !== undefined) {
      nextPrice.markupPercent = input.markupPercent;
    }

    this.prices.set(nextPrice.id, nextPrice);
    return nextPrice;
  }

  listPrices(partnerId: string): PartnerProjectPrice[] {
    return [...this.prices.values()].filter((price) => price.partnerId === partnerId);
  }
}
