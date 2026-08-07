import type { SocialMediaItem } from "@b2b/domain";

/**
 * Чистый разбор ответа витрины канала Дзена. Ходить в сеть отсюда нельзя —
 * функция принимает уже полученный JSON и покрыта fixtures
 * в test/dzen-parser.test.ts.
 */

export type DzenProfileData = {
  displayName?: string | undefined;
  biography?: string | undefined;
  avatarUrl?: string | undefined;
  followersCount?: number | undefined;
  website?: string | undefined;
  media: SocialMediaItem[];
};

const MAX_TEXT_LENGTH = 600;
const MAX_MEDIA_ITEMS = 12;

/** Видеоформаты Дзена: длинные видео, ролики и трансляции */
const VIDEO_ITEM_TYPES = new Set(["gif", "video", "short_video", "live"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Внешний текст показывается посетителю — сжимаем пробелы и режем длину */
function cleanText(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}…` : text;
}

function httpsUrl(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.startsWith("https://") ? raw : undefined;
}

/** Счётчик: 0 подписчиков — настоящее значение, а «—» и мусор дают undefined */
function count(raw: unknown): number | undefined {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value);
}

/** Дзен отдаёт секунды строкой: «1776939140» → ISO */
function toIsoDate(raw: unknown): string | undefined {
  const value = count(raw);
  if (!value) return undefined;
  const date = new Date(value < 1e12 ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Обложка: у статей строкой, у коротких заметок — во вложенном объекте */
function coverUrl(item: Record<string, unknown>): string | undefined {
  const direct = httpsUrl(item.image);
  if (direct) return direct;
  const nested = Array.isArray(item.items) ? asRecord(item.items[0]) : null;
  const nestedImage = nested?.image;
  return httpsUrl(nestedImage) ?? httpsUrl(asRecord(nestedImage)?.link);
}

/**
 * Ответ `dzen.ru/api/v3/launcher/export?channel_name=…`.
 * null — такого канала нет: площадка не подтвердила его существование.
 */
export function parseDzenExport(payload: unknown): DzenProfileData | null {
  const root = asRecord(payload);
  const channel = asRecord(root?.channel);
  const source = asRecord(channel?.source);
  if (!source || channel?.status !== "ok") return null;

  const media: SocialMediaItem[] = [];
  const items = Array.isArray(root?.items) ? root.items : [];

  for (const raw of items) {
    if (media.length >= MAX_MEDIA_ITEMS) break;
    const item = asRecord(raw);
    if (!item) continue;

    // Блоки-подборки («Видео», «Ролики») публикациями не являются: ссылки нет
    const permalink = httpsUrl(item.share_link);
    if (!permalink) continue;

    // Публикацию без обложки в ленте показать нечем
    const thumbnailUrl = coverUrl(item);
    if (!thumbnailUrl) continue;

    const itemType = typeof item.item_type === "string" ? item.item_type : "";
    const id =
      typeof item.publication_object_id === "string"
        ? item.publication_object_id
        : typeof item.id === "string"
          ? item.id
          : permalink;

    media.push({
      id,
      type: VIDEO_ITEM_TYPES.has(itemType) ? "video" : "image",
      mediaUrl: thumbnailUrl,
      thumbnailUrl,
      permalink,
      caption: cleanText(item.title) ?? cleanText(item.text),
      publishedAt: toIsoDate(item.publication_date),
      views: count(item.views)
    });
  }

  const logoSizes = asRecord(source.logo_sizes);

  return {
    displayName: cleanText(source.title),
    biography: cleanText(source.description),
    avatarUrl: httpsUrl(logoSizes?.smart_crop_160) ?? httpsUrl(source.logo),
    followersCount: count(source.subscribers),
    website: httpsUrl(source.main_external_link),
    media
  };
}
