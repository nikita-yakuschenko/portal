/** Избранное витрины партнёрского сайта — отдельно на каждый инстанс (хост). */

const PREFIX = "avgst.site.favorites.";

export function siteFavoritesKey(host: string): string {
  const id = host.trim().toLowerCase() || "preview-local";
  return `${PREFIX}${id}`;
}

export function loadSiteFavorites(host: string): Set<string> {
  try {
    const raw = localStorage.getItem(siteFavoritesKey(host));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function saveSiteFavorites(host: string, ids: Set<string>): void {
  try {
    localStorage.setItem(siteFavoritesKey(host), JSON.stringify([...ids]));
  } catch {
    // ignore quota / private mode
  }
}
