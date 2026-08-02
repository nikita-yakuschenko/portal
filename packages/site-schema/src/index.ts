import { z } from "zod";

/** Полный конфиг витрины партнёра (кабинет + public runtime) */
export const partnerSiteDraftSchema = z.object({
  name: z.string(),
  subdomain: z.string(),
  domain: z.string(),
  contactPhone: z.string(),
  contactEmail: z.string(),
  address: z.string(),
  heroHeadline: z.string(),
  heroText: z.string(),
  aboutTitle: z.string(),
  aboutText: z.string(),
  catalogTitle: z.string(),
  catalogText: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  yandexMetrika: z.string(),
  gtmId: z.string(),
  ctaLabel: z.string(),
  inquiryEmail: z.string(),
  socialTelegram: z.string(),
  socialVk: z.string(),
  socialWhatsapp: z.string(),
  socialMax: z.string(),
  socialInstagram: z.string(),
  socialYoutube: z.string(),
  socialDzen: z.string(),
  postLeadOfferSocials: z.array(z.string()),
  popularProjectIds: z.array(z.string()).max(6),
  logoDataUrl: z.string()
});

export type PartnerSiteDraft = z.infer<typeof partnerSiteDraftSchema>;

export const partnerSiteStatusSchema = z.enum(["draft", "published"]);
export type PartnerSiteStatus = z.infer<typeof partnerSiteStatusSchema>;

export const emptyPartnerSiteDraft: PartnerSiteDraft = {
  name: "",
  subdomain: "",
  domain: "",
  contactPhone: "",
  contactEmail: "",
  address: "",
  heroHeadline:
    "Строим современные каркасные и модульные дома для комфортной жизни, отдыха и постоянного проживания",
  heroText:
    "Собственное производство, современные технологии строительства и опытная команда позволяют контролировать качество на каждом этапе, соблюдать сроки и создавать дома на долгие годы.",
  aboutTitle: "О компании",
  aboutText:
    "Мы строительная компания: берём на себя проектирование, комплектацию и строительство. Работаем прозрачно по договору и срокам.",
  catalogTitle: "Проекты домов",
  catalogText: "Выберите дом по площади и планировке.",
  seoTitle: "",
  seoDescription: "",
  yandexMetrika: "",
  gtmId: "",
  ctaLabel: "Посмотреть каталог проектов",
  inquiryEmail: "",
  socialTelegram: "",
  socialVk: "",
  socialWhatsapp: "",
  socialMax: "",
  socialInstagram: "",
  socialYoutube: "",
  socialDzen: "",
  postLeadOfferSocials: ["telegram"],
  popularProjectIds: [],
  logoDataUrl: ""
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizePopularProjectIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= 6) break;
  }
  return ids;
}

function normalizePostLeadOfferSocials(raw: Record<string, unknown>): string[] {
  const fromArray = raw.postLeadOfferSocials;
  if (Array.isArray(fromArray)) {
    if (fromArray.length === 0) return [];
    const ids = fromArray
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    return [...new Set(ids)];
  }
  if ("postLeadOfferSocial" in raw) {
    const single = asString(raw.postLeadOfferSocial).trim().toLowerCase();
    return single ? [single] : [];
  }
  return [...emptyPartnerSiteDraft.postLeadOfferSocials];
}

/** Нормализация произвольного JSON конфига сайта */
export function normalizePartnerSiteDraft(
  raw: Partial<PartnerSiteDraft> & Record<string, unknown>
): PartnerSiteDraft | null {
  if (!raw || typeof raw.name !== "string" || !raw.name.trim()) return null;

  return {
    ...emptyPartnerSiteDraft,
    name: raw.name.trim(),
    subdomain: asString(raw.subdomain, "partner").trim() || "partner",
    domain: asString(raw.domain).trim(),
    contactPhone: asString(raw.contactPhone),
    contactEmail: asString(raw.contactEmail),
    address: asString(raw.address),
    heroHeadline: asString(raw.heroHeadline, emptyPartnerSiteDraft.heroHeadline),
    heroText: asString(raw.heroText, emptyPartnerSiteDraft.heroText),
    aboutTitle: asString(raw.aboutTitle, emptyPartnerSiteDraft.aboutTitle),
    aboutText: asString(raw.aboutText, emptyPartnerSiteDraft.aboutText),
    catalogTitle: asString(raw.catalogTitle, emptyPartnerSiteDraft.catalogTitle),
    catalogText: asString(raw.catalogText, emptyPartnerSiteDraft.catalogText),
    seoTitle: asString(raw.seoTitle),
    seoDescription: asString(raw.seoDescription),
    yandexMetrika: asString(raw.yandexMetrika),
    gtmId: asString(raw.gtmId),
    ctaLabel: asString(raw.ctaLabel, emptyPartnerSiteDraft.ctaLabel),
    inquiryEmail: asString(raw.inquiryEmail),
    socialTelegram: asString(raw.socialTelegram),
    socialVk: asString(raw.socialVk),
    socialWhatsapp: asString(raw.socialWhatsapp),
    socialMax: asString(raw.socialMax),
    socialInstagram: asString(raw.socialInstagram),
    socialYoutube: asString(raw.socialYoutube),
    socialDzen: asString(raw.socialDzen),
    postLeadOfferSocials: normalizePostLeadOfferSocials(raw),
    popularProjectIds: normalizePopularProjectIds(raw.popularProjectIds),
    logoDataUrl: asString(raw.logoDataUrl)
  };
}

export function publicSiteHost(draft: Pick<PartnerSiteDraft, "domain" | "subdomain">): string {
  const custom = draft.domain.trim();
  if (custom) return custom.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  const sub = draft.subdomain.trim() || "partner";
  return `${sub}.avgst.ru`.toLowerCase();
}

export function draftDefaultsFromPartner(partner: {
  companyName: string;
  region: string;
  email: string;
  phone: string;
}): PartnerSiteDraft {
  const slug = partner.companyName
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);

  return {
    ...emptyPartnerSiteDraft,
    name: partner.companyName,
    subdomain: slug || "partner",
    contactPhone: partner.phone,
    contactEmail: partner.email,
    address: partner.region,
    aboutText: `${partner.companyName} помогает выбрать проект, рассчитать смету и построить дом.`,
    seoTitle: `${partner.companyName} — строительство домов`,
    seoDescription: `${partner.companyName}: проекты домов, расчёт стоимости и строительство.`,
    inquiryEmail: partner.email
  };
}

/** Устаревший узкий schema — оставлен для совместимости */
export const partnerSiteConfigSchema = z.object({
  siteId: z.string().min(1),
  partnerId: z.string().min(1),
  brand: z.object({
    title: z.string().min(1),
    phone: z.string().min(1),
    email: z.email(),
    address: z.string().optional()
  }),
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional()
  }),
  analytics: z.object({
    yandexMetrikaCounter: z.string().optional(),
    googleTagManagerId: z.string().optional()
  }),
  cta: z.object({
    primaryLabel: z.string().default("Запросить цену"),
    inquiryEmail: z.email().optional()
  })
});

export type PartnerSiteConfig = z.infer<typeof partnerSiteConfigSchema>;
