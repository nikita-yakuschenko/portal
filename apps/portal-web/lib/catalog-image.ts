// В CMS файл карточки уже WebP. Здесь только меньший кадр для экрана.
const WIDTHS = [256, 384, 640, 828, 1080, 1200, 1920];

export function catalogImageSrc(src: string, width: number, quality: 60 | 75 = 60): string {
  if (!src) return src;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (url.origin !== "https://cms.avgst.ru" || !url.pathname.startsWith("/api/media/file/")) return src;
  const size = WIDTHS.find((value) => value >= width) ?? 1920;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${size}&q=${quality}`;
}
