import {
  emptyPartnerSiteDraft as schemaEmpty,
  normalizePartnerSiteDraft as schemaNormalize,
  publicSiteHost as schemaPublicHost,
  draftDefaultsFromPartner as schemaDefaults,
  slugifySubdomain as schemaSlugify,
  type PartnerSiteDraft
} from "@b2b/site-schema";

import { withDemoPartnerSocials } from "@/lib/partner-site-socials";

export type { PartnerSiteDraft };
export const PARTNER_SITE_DRAFT_KEY = "avgst.partner.site.draft";
export const emptyPartnerSiteDraft: PartnerSiteDraft = schemaEmpty;
export const publicSiteHost = schemaPublicHost;
export const slugifySubdomain = schemaSlugify;

export function savePartnerSiteDraft(draft: PartnerSiteDraft): void {
  try {
    localStorage.setItem(PARTNER_SITE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota / private mode
  }
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
  const base = schemaNormalize(raw as Partial<PartnerSiteDraft> & Record<string, unknown>);
  if (!base) return null;

  const catalogText = base.catalogText;
  const cleanedCatalog =
    /цен(ы|а).*регион/i.test(catalogText) || /регион.*цен/i.test(catalogText)
      ? emptyPartnerSiteDraft.catalogText
      : catalogText;

  return withDemoPartnerSocials({
    ...base,
    heroHeadline: isBadLegacyHero(base.heroHeadline)
      ? emptyPartnerSiteDraft.heroHeadline
      : base.heroHeadline,
    heroText: isBadLegacyHeroBody(base.heroText)
      ? emptyPartnerSiteDraft.heroText
      : base.heroText,
    catalogTitle: isBadLegacyCatalogTitle(base.catalogTitle)
      ? emptyPartnerSiteDraft.catalogTitle
      : base.catalogTitle,
    catalogText: cleanedCatalog,
    ctaLabel: isBadLegacyCta(base.ctaLabel) ? emptyPartnerSiteDraft.ctaLabel : base.ctaLabel
  });
}

export function normalizePopularProjectIds(raw: unknown): string[] {
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
  return withDemoPartnerSocials(schemaDefaults(partner));
}
