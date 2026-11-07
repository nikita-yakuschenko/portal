// Кадр один раз забирается с CMS по локальной сети и дальше отдаётся самим порталом.
const WIDTHS = [384, 828, 1200, 1920];
const PORTAL_ORIGIN = "https://b2b.avgst.ru";

export function catalogImageSrc(src: string, width: number): string {
  if (!src) return src;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (url.origin !== "https://cms.avgst.ru" && url.origin !== PORTAL_ORIGIN) return src;
  const file = url.pathname.match(/^\/api\/media\/file\/([^/]+)$/);
  const fitted = url.pathname.match(/^\/api\/media\/fit\/\d+\/([^/]+)$/);
  const name = file?.[1] ?? fitted?.[1];
  if (!name) return src;
  const size = WIDTHS.find((value) => value >= width) ?? 1920;
  return `${PORTAL_ORIGIN}/api/media/fit/${size}/${name}`;
}
