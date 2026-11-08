/** Один адрес карточки проекта для всех ролей. Права решает сессия, не путь. */
export function catalogProjectHref(slug: string, query?: string) {
  const path = `/portal/catalog/${slug}`;
  return query ? `${path}?${query}` : path;
}
