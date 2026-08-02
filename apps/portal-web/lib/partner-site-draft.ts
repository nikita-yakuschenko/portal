import { withDemoPartnerSocials } from "@/lib/partner-site-socials";

export const PARTNER_SITE_DRAFT_KEY = "avgst.partner.site.draft";

/** Публичный сайт партнёра: бренд компании для конечного покупателя, не «дилер завода». */
export type PartnerSiteDraft = {
  name: string;
  subdomain: string;
  domain: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  /** Hero и тексты блоков — правит дилер под свой тон */
  heroHeadline: string;
  heroText: string;
  aboutTitle: string;
  aboutText: string;
  catalogTitle: string;
  catalogText: string;
  seoTitle: string;
  seoDescription: string;
  yandexMetrika: string;
  gtmId: string;
  ctaLabel: string;
  inquiryEmail: string;
  socialTelegram: string;
  socialVk: string;
  socialWhatsapp: string;
  socialMax: string;
  socialInstagram: string;
  socialYoutube: string;
  socialDzen: string;
  /**
   * Пул соцсетей после заявки (id из PARTNER_SITE_SOCIALS).
   * Пустой = не предлагать. На каждую заявку берём следующую по кругу.
   */
  postLeadOfferSocials: string[];
  /** Data URL своего логотипа (вместо заводского) */
  logoDataUrl: string;
};

export const emptyPartnerSiteDraft: PartnerSiteDraft = {
  name: "",
  subdomain: "",
  domain: "",
  contactPhone: "",
  contactEmail: "",
  address: "",
  heroHeadline: "Строим современные каркасные и модульные дома для комфортной жизни, отдыха и постоянного проживания",
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
  logoDataUrl: ""
};

export function publicSiteHost(draft: Pick<PartnerSiteDraft, "domain" | "subdomain">): string {
  const custom = draft.domain.trim();
  if (custom) return custom.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const sub = draft.subdomain.trim() || "partner";
  return `${sub}.avgst.ru`;
}

export function savePartnerSiteDraft(draft: PartnerSiteDraft): void {
  try {
    localStorage.setItem(PARTNER_SITE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota / private mode
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Пул сетей после заявки; тянем из старого postLeadOfferSocial при миграции */
function normalizePostLeadOfferSocials(
  raw: Partial<PartnerSiteDraft> & Record<string, unknown>
): string[] {
  const fromArray = raw.postLeadOfferSocials;
  if (Array.isArray(fromArray)) {
    const ids = fromArray
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    // Явный пустой массив = «не предлагать»
    if (fromArray.length === 0) return [];
    return [...new Set(ids)];
  }
  if ("postLeadOfferSocial" in raw) {
    const single = asString(raw.postLeadOfferSocial).trim().toLowerCase();
    return single ? [single] : [];
  }
  return [...emptyPartnerSiteDraft.postLeadOfferSocials];
}

/** Старые дефолты вида «Строим дома в Нижний Новгород» — выкидываем */
function isBadLegacyHero(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  if (/строим дома в\s/.test(t)) return true;
  if (/^строим дома\b/.test(t) && t.length < 80) return true;
  return false;
}

function isBadLegacyHeroBody(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  if (/проектирование,\s*комплектация и строительство/.test(t)) return true;
  return false;
}

function isBadLegacyCta(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    !t ||
    t === "получить расчёт" ||
    t === "получить расчет" ||
    t === "запросить цену" ||
    t === "связаться"
  );
}

function isBadLegacyCatalogTitle(text: string): boolean {
  const t = text.trim().toLowerCase();
  return !t || t === "проекты";
}

/** Подтягивает старые черновики и выравнивает тексты под шаблон сайта (msk) */
export function normalizePartnerSiteDraft(
  raw: Partial<PartnerSiteDraft> & { name?: string }
): PartnerSiteDraft | null {
  if (!raw || typeof raw.name !== "string" || !raw.name.trim()) return null;
  const catalogText = asString(raw.catalogText, emptyPartnerSiteDraft.catalogText);
  const cleanedCatalog =
    /цен(ы|а).*регион/i.test(catalogText) || /регион.*цен/i.test(catalogText)
      ? emptyPartnerSiteDraft.catalogText
      : catalogText;

  const heroHeadlineRaw = asString(raw.heroHeadline, emptyPartnerSiteDraft.heroHeadline);
  const heroTextRaw = asString(raw.heroText, emptyPartnerSiteDraft.heroText);
  const ctaRaw = asString(raw.ctaLabel, emptyPartnerSiteDraft.ctaLabel);
  const catalogTitleRaw = asString(raw.catalogTitle, emptyPartnerSiteDraft.catalogTitle);

  return withDemoPartnerSocials({
    ...emptyPartnerSiteDraft,
    name: raw.name,
    subdomain: asString(raw.subdomain, "partner"),
    domain: asString(raw.domain),
    contactPhone: asString(raw.contactPhone),
    contactEmail: asString(raw.contactEmail),
    address: asString(raw.address),
    heroHeadline: isBadLegacyHero(heroHeadlineRaw)
      ? emptyPartnerSiteDraft.heroHeadline
      : heroHeadlineRaw,
    heroText: isBadLegacyHeroBody(heroTextRaw)
      ? emptyPartnerSiteDraft.heroText
      : heroTextRaw,
    aboutTitle: asString(raw.aboutTitle, emptyPartnerSiteDraft.aboutTitle),
    aboutText: asString(raw.aboutText, emptyPartnerSiteDraft.aboutText),
    catalogTitle: isBadLegacyCatalogTitle(catalogTitleRaw)
      ? emptyPartnerSiteDraft.catalogTitle
      : catalogTitleRaw,
    catalogText: cleanedCatalog,
    seoTitle: asString(raw.seoTitle),
    seoDescription: asString(raw.seoDescription),
    yandexMetrika: asString(raw.yandexMetrika),
    gtmId: asString(raw.gtmId),
    ctaLabel: isBadLegacyCta(ctaRaw) ? emptyPartnerSiteDraft.ctaLabel : ctaRaw,
    inquiryEmail: asString(raw.inquiryEmail),
    socialTelegram: asString(raw.socialTelegram),
    socialVk: asString(raw.socialVk),
    socialWhatsapp: asString(raw.socialWhatsapp),
    socialMax: asString(raw.socialMax),
    socialInstagram: asString(raw.socialInstagram),
    socialYoutube: asString(raw.socialYoutube),
    socialDzen: asString(raw.socialDzen),
    postLeadOfferSocials: normalizePostLeadOfferSocials(
      raw as Partial<PartnerSiteDraft> & Record<string, unknown>
    ),
    logoDataUrl: asString(raw.logoDataUrl)
  });
}

/** Подставить тексты первого экрана/каталога как на сайте (контакты и лого не трогает) */
export function applySiteTemplateTexts(draft: PartnerSiteDraft): PartnerSiteDraft {
  return {
    ...draft,
    heroHeadline: emptyPartnerSiteDraft.heroHeadline,
    heroText: emptyPartnerSiteDraft.heroText,
    catalogTitle: emptyPartnerSiteDraft.catalogTitle,
    catalogText: emptyPartnerSiteDraft.catalogText,
    ctaLabel: emptyPartnerSiteDraft.ctaLabel,
    aboutTitle: emptyPartnerSiteDraft.aboutTitle
  };
}

export function loadPartnerSiteDraft(): PartnerSiteDraft | null {
  try {
    const raw =
      localStorage.getItem(PARTNER_SITE_DRAFT_KEY) ??
      sessionStorage.getItem(PARTNER_SITE_DRAFT_KEY);
    if (!raw) return null;
    const draft = normalizePartnerSiteDraft(JSON.parse(raw) as Partial<PartnerSiteDraft>);
    if (draft) {
      // миграция со sessionStorage
      localStorage.setItem(PARTNER_SITE_DRAFT_KEY, JSON.stringify(draft));
      sessionStorage.removeItem(PARTNER_SITE_DRAFT_KEY);
    }
    return draft;
  } catch {
    return null;
  }
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

  return withDemoPartnerSocials({
    ...emptyPartnerSiteDraft,
    name: partner.companyName,
    subdomain: slug || "partner",
    contactPhone: partner.phone,
    contactEmail: partner.email,
    address: partner.region,
    heroHeadline: emptyPartnerSiteDraft.heroHeadline,
    heroText: emptyPartnerSiteDraft.heroText,
    aboutText: `${partner.companyName} помогает выбрать проект, рассчитать смету и построить дом.`,
    seoTitle: `${partner.companyName} — строительство домов`,
    seoDescription: `${partner.companyName}: проекты домов, расчёт стоимости и строительство.`,
    ctaLabel: emptyPartnerSiteDraft.ctaLabel,
    inquiryEmail: partner.email,
    logoDataUrl: ""
  });
}
