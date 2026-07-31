import type { PartnerSiteDraft } from "@/lib/partner-site-draft";

export const PREVIEW_BASE = "/partner/site/preview";

export const previewPaths = {
  home: PREVIEW_BASE,
  projects: `${PREVIEW_BASE}/projects`,
  project: (id: string) => `${PREVIEW_BASE}/projects/${id}`,
  about: `${PREVIEW_BASE}/about`,
  contacts: `${PREVIEW_BASE}/contacts`
} as const;

export type StorefrontProject = {
  id: string;
  name: string;
  description?: string | null;
  technology: "modular" | "panel_frame";
  area: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms?: string | null;
  factoryBasePrice?: number | null;
  basePrice: number | null;
  priceOnRequest?: boolean;
  dealerExtras?: Array<{ id: string; name: string; price?: number; note?: string }>;
  dealerPricing?: { isPublished?: boolean } | null;
  assets?: Array<{ sourceUrl: string; isPrimary: boolean; sortOrder?: number; altText?: string | null }>;
  details?: {
    summary?: string | null;
    optionGroups?: Array<{
      id: string;
      title: string;
      items: Array<{ id: string; name: string; price?: number; note?: string }>;
    }>;
  } | null;
};

export function primaryImage(project: StorefrontProject): string | null {
  if (!project.assets?.length) return null;
  const sorted = [...project.assets].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  return sorted[0]?.sourceUrl ?? null;
}

export function projectSpecs(project: StorefrontProject): string[] {
  return [
    project.area ? `${project.area} м²` : null,
    project.floors ? `${project.floors} эт.` : null,
    project.bedrooms ? `${project.bedrooms} сп.` : null
  ].filter((item): item is string => Boolean(item));
}

export function socialLinks(draft: PartnerSiteDraft): Array<{ label: string; href: string }> {
  return [
    { label: "Telegram", href: draft.socialTelegram },
    { label: "ВКонтакте", href: draft.socialVk },
    { label: "WhatsApp", href: draft.socialWhatsapp },
    { label: "MAX", href: draft.socialMax }
  ].filter((item) => item.href.trim());
}

export function filterStorefrontProjects(projects: StorefrontProject[]): StorefrontProject[] {
  const published = projects.filter((p) => p.dealerPricing?.isPublished);
  return published.length > 0 ? published : projects;
}
