export const PARTNER_SITE_DRAFT_KEY = "avgst.partner.site.draft";

export type PartnerSiteDraft = {
  name: string;
  subdomain: string;
  domain: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  seoTitle: string;
  seoDescription: string;
  yandexMetrika: string;
  gtmId: string;
  ctaLabel: string;
  inquiryEmail: string;
};

export function publicSiteHost(draft: Pick<PartnerSiteDraft, "domain" | "subdomain">): string {
  const custom = draft.domain.trim();
  if (custom) return custom.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const sub = draft.subdomain.trim() || "partner";
  return `${sub}.avgst.ru`;
}

export function savePartnerSiteDraft(draft: PartnerSiteDraft): void {
  try {
    sessionStorage.setItem(PARTNER_SITE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota / private mode
  }
}

export function loadPartnerSiteDraft(): PartnerSiteDraft | null {
  try {
    const raw = sessionStorage.getItem(PARTNER_SITE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PartnerSiteDraft;
    if (!parsed || typeof parsed.name !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
