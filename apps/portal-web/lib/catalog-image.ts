// Кадр готовит CMS и кладёт рядом с исходником. Кабинет его только показывает.
const WIDTHS = [384, 828, 1200, 1920];

export function catalogImageSrc(src: string, width: number): string {
  if (!src) return src;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (url.origin !== "https://cms.avgst.ru") return src;
  const file = url.pathname.match(/^\/api\/media\/file\/([^/]+)$/);
  const fitted = url.pathname.match(/^\/api\/media\/fit\/\d+\/([^/]+)$/);
  const name = file?.[1] ?? fitted?.[1];
  if (!name) return src;
  const size = WIDTHS.find((value) => value >= width) ?? 1920;
  return `${url.origin}/api/media/fit/${size}/${name}`;
}
