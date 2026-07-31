/** Убирает HTML из описаний Tilda для безопасного текстового вывода */
export function stripHtml(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .replace(/<sup>\s*2\s*<\/sup>/gi, "²")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Описание Tilda часто — только характеристики (площадь и т.д.), их не дублируем в карточке */
export function catalogProseDescription(value: string | null | undefined): string {
  const text = stripHtml(value);
  if (!text) return "";

  const looksLikeSpecs =
    /\d+(?:[.,]\d+)?\s*м(?:2|²)/i.test(text) ||
    /\d+(?:[.,]\d+)?\s*[xх×]\s*\d+(?:[.,]\d+)?\s*м/i.test(text);

  return looksLikeSpecs ? "" : text;
}
