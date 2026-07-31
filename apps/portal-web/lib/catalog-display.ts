import type { CatalogTechnology } from "@b2b/domain";

export const TECHNOLOGY_LABELS: Record<CatalogTechnology, string> = {
  modular: "Модульная",
  panel_frame: "Панельно-каркасная"
};

/** Короткие подписи для бейджей в каталоге */
export const TECHNOLOGY_BADGE: Record<CatalogTechnology, string> = {
  modular: "Модульный",
  panel_frame: "Панельно-каркасный"
};

export function technologyLabel(value: CatalogTechnology | string | null | undefined): string {
  if (value === "panel_frame") return TECHNOLOGY_LABELS.panel_frame;
  return TECHNOLOGY_LABELS.modular;
}

export function technologyBadgeCode(value: CatalogTechnology | string | null | undefined): string {
  if (value === "panel_frame") return TECHNOLOGY_BADGE.panel_frame;
  return TECHNOLOGY_BADGE.modular;
}

export function technologyBadgeVariant(
  value: CatalogTechnology | string | null | undefined
): "modular" | "panel" {
  return value === "panel_frame" ? "panel" : "modular";
}
