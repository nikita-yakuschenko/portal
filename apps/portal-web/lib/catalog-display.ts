import type { CatalogTechnology } from "@b2b/domain";

export const TECHNOLOGY_LABELS: Record<CatalogTechnology, string> = {
  modular: "Модульная",
  panel_frame: "Панельно-каркасная",
  frame: "Каркасная"
};

/** Подписи для бейджей — те же, что у фильтра «Технология» (ж.р.) */
export const TECHNOLOGY_BADGE: Record<CatalogTechnology, string> = {
  modular: "Модульная",
  panel_frame: "Панельно-каркасная",
  frame: "Каркасная"
};

export function technologyLabel(value: CatalogTechnology | string | null | undefined): string {
  if (value === "panel_frame" || value === "panel") return TECHNOLOGY_LABELS.panel_frame;
  if (value === "frame") return TECHNOLOGY_LABELS.frame;
  if (value === "modular") return TECHNOLOGY_LABELS.modular;
  return TECHNOLOGY_LABELS.modular;
}

export function technologyBadgeCode(value: CatalogTechnology | string | null | undefined): string {
  return technologyLabel(value);
}

export function technologyBadgeVariant(
  value: CatalogTechnology | string | null | undefined
): "modular" | "panel" | "frame" {
  if (value === "panel_frame" || value === "panel") return "panel";
  if (value === "frame") return "frame";
  return "modular";
}
