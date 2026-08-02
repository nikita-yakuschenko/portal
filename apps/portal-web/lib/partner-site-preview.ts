import type { PartnerSiteDraft } from "@/lib/partner-site-draft";
import { resolvePartnerSiteSocials } from "@/lib/partner-site-socials";

/** Публичный runtime (Dokploy site) — пути без /partner/site/preview */
export const isPublicSiteRuntime = process.env.NEXT_PUBLIC_APP_ROLE === "site";

export const PREVIEW_BASE = isPublicSiteRuntime ? "" : "/partner/site/preview";

export const previewPaths = {
  home: PREVIEW_BASE || "/",
  catalog: `${PREVIEW_BASE}/catalog`,
  catalogByTechnology: (technology: "modular" | "panel_frame") =>
    `${PREVIEW_BASE}/catalog?technology=${technology}`,
  project: (slug: string) => `${PREVIEW_BASE}/catalog/${slug}`,
  about: `${PREVIEW_BASE}/about`,
  contacts: PREVIEW_BASE ? `${PREVIEW_BASE}#contacts` : "/#contacts",
  policy: `${PREVIEW_BASE}/policy`
} as const;

export type StorefrontAssetType = "exterior" | "floor_plan" | "interior" | "unknown";

export type StorefrontAsset = {
  id?: string;
  sourceUrl: string;
  isPrimary: boolean;
  sortOrder?: number;
  altText?: string | null;
  type?: StorefrontAssetType;
  floorNumber?: number | null;
};

export type StorefrontProject = {
  id: string;
  slug?: string;
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
  dealerExtras?: Array<{
    id: string;
    title: string;
    items: Array<{ id: string; name: string; price?: number; note?: string }>;
  }>;
  dealerPricing?: { isPublished?: boolean } | null;
  assets?: StorefrontAsset[];
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

/** Категория ассета для витрины; unknown по URL-подсказкам, иначе exterior */
export function storefrontAssetKind(
  asset: StorefrontAsset
): "floor_plan" | "exterior" | "interior" {
  if (asset.type === "floor_plan" || asset.type === "interior" || asset.type === "exterior") {
    return asset.type;
  }
  const url = asset.sourceUrl.toLowerCase();
  if (/plan|floor|планир/.test(url)) return "floor_plan";
  if (/interior|interier|интерьер/.test(url)) return "interior";
  return "exterior";
}

export function groupStorefrontAssets(assets: StorefrontAsset[]) {
  const sorted = [...assets].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const floorPlans = sorted
    .filter((asset) => storefrontAssetKind(asset) === "floor_plan")
    .sort(
      (a, b) =>
        (a.floorNumber ?? 999) - (b.floorNumber ?? 999) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
  return {
    floorPlans,
    exteriors: sorted.filter((asset) => storefrontAssetKind(asset) === "exterior"),
    interiors: sorted.filter((asset) => storefrontAssetKind(asset) === "interior")
  };
}

export function projectSpecs(project: StorefrontProject): string[] {
  return [
    project.area ? `${project.area} м²` : null,
    project.floors ? `${project.floors} эт.` : null,
    project.bedrooms ? `${project.bedrooms} сп.` : null,
    project.bathrooms ? `${project.bathrooms} с/у` : null
  ].filter((item): item is string => Boolean(item));
}

export function socialLinks(draft: PartnerSiteDraft): Array<{ label: string; href: string }> {
  return resolvePartnerSiteSocials(draft).map(({ label, href }) => ({ label, href }));
}

export function filterStorefrontProjects(projects: StorefrontProject[]): StorefrontProject[] {
  const published = projects.filter((p) => p.dealerPricing?.isPublished);
  return published.length > 0 ? published : projects;
}

export const POPULAR_PROJECTS_MAX = 6;

/**
 * Блок «Популярные» на главной: выбранный порядок из draft.
 * Пустой список — первые N из каталога (как раньше).
 */
export function resolvePopularProjects(
  projects: StorefrontProject[],
  popularProjectIds: string[] | undefined,
  limit = POPULAR_PROJECTS_MAX
): StorefrontProject[] {
  const catalog = filterStorefrontProjects(projects);
  const ids = (popularProjectIds ?? []).filter(Boolean);
  if (ids.length === 0) return catalog.slice(0, limit);

  const byId = new Map(catalog.map((project) => [project.id, project]));
  const ordered: StorefrontProject[] = [];
  for (const id of ids) {
    const project = byId.get(id);
    if (!project) continue;
    ordered.push(project);
    if (ordered.length >= limit) break;
  }
  return ordered;
}

/** Сегмент URL проекта: slug из API, иначе id */
export function storefrontProjectKey(
  project: Pick<StorefrontProject, "id" | "slug">
): string {
  return project.slug?.trim() || project.id;
}
