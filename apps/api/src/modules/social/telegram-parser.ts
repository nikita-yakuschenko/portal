import * as cheerio from "cheerio";

import type { SocialMediaItem } from "@b2b/domain";

/**
 * Чистые парсеры публичных страниц Telegram. Ходить в сеть отсюда нельзя —
 * функции принимают HTML и покрыты fixtures в test/telegram-parser.test.ts.
 */

export type TelegramProfileData = {
  displayName?: string | undefined;
  biography?: string | undefined;
  avatarUrl?: string | undefined;
  followersCount?: number | undefined;
  postsCount?: number | undefined;
  media: SocialMediaItem[];
};

const MAX_TEXT_LENGTH = 600;
const MAX_MEDIA_ITEMS = 12;

/**
 * «1.2K» → 1200, «4.75K» → 4750, «1,234» → 1234, «2.1M» → 2100000.
 * Возвращает undefined вместо 0: отсутствие счётчика — не ноль подписчиков.
 */
export function parseCompactNumber(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    .replace(/ | /g, " ")
    .replace(/\s/g, "")
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(",", ".")
    .trim();
  const match = /^(\d+(?:\.\d+)?)([KkMmBb])?$/.exec(cleaned);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  const suffix = match[2]?.toUpperCase();
  const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1;
  return Math.round(value * multiplier);
}

/** Внешний текст показывается посетителю — режем HTML и длину */
function cleanText(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}…` : text;
}

/** Пропорции разумны в пределах панорамы и вертикального сторис */
function sanitizeAspectRatio(value: number): number | undefined {
  return Number.isFinite(value) && value >= 0.3 && value <= 3.5
    ? Math.round(value * 1000) / 1000
    : undefined;
}

/** width:453px;height:362px → 1.251 */
function parseBoxAspectRatio(style: string | undefined): number | undefined {
  if (!style) return undefined;
  const width = /(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/i.exec(style);
  const height = /(?:^|;)\s*height\s*:\s*(\d+(?:\.\d+)?)px/i.exec(style);
  if (!width || !height) return undefined;
  const h = Number(height[1]);
  if (h <= 0) return undefined;
  return sanitizeAspectRatio(Number(width[1]) / h);
}

/** padding-top:133.33% — приём вёрстки Telegram для соотношения сторон видео */
function parsePaddingAspectRatio(style: string | undefined): number | undefined {
  if (!style) return undefined;
  const padding = /padding-top\s*:\s*(\d+(?:\.\d+)?)%/i.exec(style);
  if (!padding) return undefined;
  const percent = Number(padding[1]);
  if (percent <= 0) return undefined;
  return sanitizeAspectRatio(100 / percent);
}

/** background-image:url('https://…') → https://… */
function extractBackgroundUrl(style: string | undefined): string | undefined {
  if (!style) return undefined;
  const match = /background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/i.exec(style);
  const url = match?.[1];
  if (!url || !url.startsWith("https://")) return undefined;
  return url;
}

/**
 * Страница ленты t.me/s/{username}.
 * null — на этом URL нет публичной ленты канала (Telegram отдал что-то другое).
 */
export function parseTelegramFeedPage(html: string): TelegramProfileData | null {
  const $ = cheerio.load(html);
  if ($(".tgme_channel_info").length === 0) return null;

  const displayName =
    cleanText($(".tgme_channel_info_header_title span").first().text()) ??
    cleanText($('meta[property="og:title"]').attr("content"));

  const biography =
    cleanText($(".tgme_channel_info_description").first().text()) ??
    cleanText($('meta[property="og:description"]').attr("content"));

  const avatarUrl =
    $(".tgme_page_photo_image img").first().attr("src") ??
    $(".tgme_channel_info_header_photo img").first().attr("src") ??
    $('meta[property="og:image"]').attr("content");

  let followersCount: number | undefined;
  let photosCount: number | undefined;
  let videosCount: number | undefined;

  $(".tgme_channel_info_counter").each((_, element) => {
    const type = $(element).find(".counter_type").text().trim().toLowerCase();
    const value = parseCompactNumber($(element).find(".counter_value").text());
    if (value === undefined) return;
    if (type.startsWith("subscriber") || type.startsWith("подписчик")) followersCount = value;
    if (type.startsWith("photo") || type.startsWith("фото")) photosCount = value;
    if (type.startsWith("video") || type.startsWith("виде")) videosCount = value;
  });

  const media: SocialMediaItem[] = [];

  $(".tgme_widget_message").each((_, element) => {
    if (media.length >= MAX_MEDIA_ITEMS) return;
    const message = $(element);
    const post = message.attr("data-post");
    if (!post) return;

    const permalink = message.find(".tgme_widget_message_date").attr("href");
    const publishedAt = message.find(".tgme_widget_message_date time").attr("datetime");
    const views = parseCompactNumber(message.find(".tgme_widget_message_views").text());
    const caption = cleanText(message.find(".tgme_widget_message_text").first().text());

    const photos: Array<{ url: string; aspectRatio?: number | undefined }> = [];
    message.find(".tgme_widget_message_photo_wrap").each((__, node) => {
      const style = $(node).attr("style");
      const url = extractBackgroundUrl(style);
      if (url) photos.push({ url, aspectRatio: parseBoxAspectRatio(style) });
    });

    // Превью видео у Telegram размыто намеренно — годится только как заглушка
    const blurredVideoThumb = extractBackgroundUrl(
      message.find(".tgme_widget_message_video_thumb").first().attr("style")
    );
    const videoUrl = message
      .find(".tgme_widget_message_video_wrap video, video.tgme_widget_message_video")
      .filter((__, node) => Boolean($(node).attr("src")))
      .first()
      .attr("src");
    const videoAspectRatio = parsePaddingAspectRatio(
      message.find(".tgme_widget_message_video_wrap").first().attr("style")
    );

    const isVideo = Boolean(videoUrl) || message.find(".tgme_widget_message_video_player").length > 0;

    const firstPhoto = photos[0];
    const thumbnailUrl = firstPhoto?.url ?? blurredVideoThumb;
    // Пост без единого кадра иллюстрировать нечем — в ленту не идёт
    if (!thumbnailUrl && !videoUrl) return;

    const type: SocialMediaItem["type"] = isVideo
      ? "video"
      : photos.length > 1
        ? "carousel"
        : "image";

    media.push({
      id: post,
      type,
      mediaUrl: thumbnailUrl,
      thumbnailUrl,
      videoUrl: videoUrl && videoUrl.startsWith("https://") ? videoUrl : undefined,
      aspectRatio: isVideo ? videoAspectRatio : firstPhoto?.aspectRatio,
      permalink: permalink ?? undefined,
      caption,
      publishedAt: publishedAt ?? undefined,
      views
    });
  });

  // В ленте сверху старые сообщения — в сетке ожидаются свежие
  media.reverse();

  const postsCount =
    photosCount !== undefined || videosCount !== undefined
      ? (photosCount ?? 0) + (videosCount ?? 0)
      : undefined;

  return {
    displayName,
    biography,
    avatarUrl: avatarUrl && avatarUrl.startsWith("https://") ? avatarUrl : undefined,
    followersCount,
    postsCount,
    media
  };
}

/**
 * Страница профиля t.me/{username} — используется, когда публичной ленты нет
 * (бот, группа, приватный канал). null — такого профиля не существует.
 */
export function parseTelegramProfilePage(html: string): TelegramProfileData | null {
  const $ = cheerio.load(html);
  const title = cleanText($(".tgme_page_title span").first().text());
  if (!title) return null;

  const extra = $(".tgme_page_extra").first().text().trim();
  const followersCount = /subscriber|подписчик|member|участник/i.test(extra)
    ? parseCompactNumber(extra.replace(/[^\d.,\sKkMmBb]/g, "").trim())
    : undefined;

  const avatarUrl = $(".tgme_page_photo_image img").first().attr("src");

  return {
    displayName: title,
    biography: cleanText($(".tgme_page_description").first().text()),
    avatarUrl: avatarUrl && avatarUrl.startsWith("https://") ? avatarUrl : undefined,
    followersCount,
    postsCount: undefined,
    media: []
  };
}
