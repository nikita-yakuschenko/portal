/** Доп. фото со страницы avgst.ru — в Store API галерея обычно урезана до 1–2. */

const SKIP_RE = /(logo|icon|heart|favicon|social|web\.png|image_1\.jpg|\/image\.jpg)/i;
const CDN_IMG_RE = /https:\/\/static\.tildacdn\.com\/[a-z0-9\-_/]+\.(?:jpg|jpeg|png|webp)/gi;
const RESIZE_PATH_RE = /\/-\/(?:resizeb?|resize)[^/]*\/[^/]*\//i;
const PAGE_SCAN_RE = /_page-\d+\.(?:jpg|jpeg|png|webp)/i;
const LI_IMG_URL_RE =
  /li_img(?:\\)?(?:"|\\"|:)\s*(?:\\)?(?:"|\\"|:)\s*(https:\/\/static\.tildacdn\.com[^"\\&]+)/gi;
const LI_IMG_SIMPLE_RE =
  /li_img[^h]*(https:\/\/static\.tildacdn\.com\/[a-z0-9\-_/]+\.(?:jpg|jpeg|png|webp))/gi;

const MAX_SYNC_ASSETS = 10;

function cleanUrl(raw: string): string {
  const unquoted = raw.replace(/&quot;/g, '"');
  const withoutEntity = unquoted.split("&quot;")[0] ?? unquoted;
  const withoutQuote = withoutEntity.split('"')[0] ?? withoutEntity;
  return withoutQuote.trim();
}

export function normalizeTildaImageUrl(url: string): string {
  const withoutResize = cleanUrl(url).replace(RESIZE_PATH_RE, "/");
  return (withoutResize.split("?")[0] ?? withoutResize).trim();
}

function imageDedupeKey(url: string): string {
  const path = normalizeTildaImageUrl(url).split("?")[0] ?? normalizeTildaImageUrl(url);
  const parts = path.split("/");
  return (parts[parts.length - 1] ?? path).toLowerCase();
}

function shouldSkip(url: string, apiGalleryCount: number): boolean {
  if (SKIP_RE.test(url)) return true;
  if (RESIZE_PATH_RE.test(url) || url.includes("/-/resize")) return true;
  if (apiGalleryCount >= 2 && PAGE_SCAN_RE.test(url)) return true;
  return false;
}

function extractSliderImageUrls(pageHtml: string): string[] {
  const urls: string[] = [];
  for (const pattern of [LI_IMG_URL_RE, LI_IMG_SIMPLE_RE]) {
    pattern.lastIndex = 0;
    for (const match of pageHtml.matchAll(pattern)) {
      const url = cleanUrl(match[1] ?? "");
      if (url.startsWith("http")) urls.push(url);
    }
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    const key = imageDedupeKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalizeTildaImageUrl(url));
  }
  return unique;
}

function extractPageImageUrls(pageHtml: string, apiGalleryCount: number): string[] {
  const urls: string[] = [];
  for (const match of pageHtml.matchAll(CDN_IMG_RE)) {
    const url = cleanUrl(match[0] ?? "");
    if (!url.startsWith("http")) continue;
    if (shouldSkip(url, apiGalleryCount)) continue;
    urls.push(normalizeTildaImageUrl(url));
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    const key = imageDedupeKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(url);
  }
  return unique;
}

export function mergeProjectImageUrls(apiUrls: string[], pageHtml: string, max = MAX_SYNC_ASSETS): string[] {
  const apiGalleryCount = apiUrls.length;
  const merged: string[] = [];
  const seenKeys = new Set<string>();

  function add(raw: string, fromApi = false) {
    const url = normalizeTildaImageUrl(raw);
    if (!fromApi && shouldSkip(url, apiGalleryCount)) return;
    if (fromApi && SKIP_RE.test(url)) return;
    const key = imageDedupeKey(url);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    merged.push(url);
  }

  for (const url of apiUrls) add(url, true);
  for (const url of extractSliderImageUrls(pageHtml)) add(url);
  for (const url of extractPageImageUrls(pageHtml, apiGalleryCount)) add(url);

  return merged.slice(0, max);
}

export async function fetchPageHtml(projectUrl: string): Promise<string> {
  if (!projectUrl) return "";

  try {
    const response = await fetch(projectUrl, {
      headers: { Accept: "text/html" },
      redirect: "follow"
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

export async function enrichImagesFromProductPage(
  projectUrl: string,
  apiUrls: string[],
  max = MAX_SYNC_ASSETS
): Promise<string[]> {
  const html = await fetchPageHtml(projectUrl);
  if (!html) return apiUrls.slice(0, max);
  return mergeProjectImageUrls(apiUrls, html, max);
}
