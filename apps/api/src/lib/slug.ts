/** Общий slug (поддомены и т.п.) */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

/** Серии домов → английский сегмент URL */
const PROJECT_SERIES: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /барнхаус/i, slug: "barnhouse" },
  { pattern: /эко[\s-]?хаус/i, slug: "ecohouse" },
  { pattern: /норвегия/i, slug: "norway" },
  { pattern: /шведск/i, slug: "sweden" },
  { pattern: /фрейм/i, slug: "frame" },
  { pattern: /сканди/i, slug: "scandi" },
  { pattern: /камелот/i, slug: "camelot" },
  { pattern: /дуплекс/i, slug: "duplex" },
  { pattern: /куб/i, slug: "cube" }
];

/**
 * Публичный slug проекта: barnhouse-115, ecohouse-80, …
 * Номер берём из конца названия («Барнхаус 115»).
 */
export function projectSlug(name: string): string {
  const trimmed = name.trim();
  const mark = trimmed.match(/(\d+)\s*$/)?.[1];

  for (const series of PROJECT_SERIES) {
    if (!series.pattern.test(trimmed)) continue;
    return mark ? `${series.slug}-${mark}` : series.slug;
  }

  // Неизвестная серия — латиница из названия + номер, если есть
  const latin = slugify(trimmed.replace(/\d+\s*$/, "").trim());
  if (latin && mark) return `${latin}-${mark}`;
  if (latin) return latin;
  if (mark) return `project-${mark}`;
  return "project";
}
