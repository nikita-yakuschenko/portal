/** Метки рекламы, которые сохраняем вместе с заявкой */
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

const STORAGE_KEY = "avgst.site.utm";

export type UtmTags = Record<string, string>;

function readFromLocation(): UtmTags {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out: UtmTags = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) out[key] = value.slice(0, 200);
  }
  return out;
}

/**
 * Запоминает метки первого захода: заявку посетитель оставляет уже на другой
 * странице, где utm-параметров в адресе давно нет.
 */
export function captureUtmTags(): void {
  const fresh = readFromLocation();
  if (Object.keys(fresh).length === 0) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // приватный режим — обойдёмся метками из адреса
  }
}

export function readUtmTags(): UtmTags {
  const fromLocation = readFromLocation();
  if (Object.keys(fromLocation).length > 0) return fromLocation;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: UtmTags = {};
    for (const key of UTM_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) out[key] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}
