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

    const photoUrls: string[] = [];
    message.find(".tgme_widget_message_photo_wrap").each((__, node) => {
      const url = extractBackgroundUrl($(node).attr("style"));
      if (url) photoUrls.push(url);
    });

    const videoThumb = extractBackgroundUrl(
      message.find(".tgme_widget_message_video_thumb").first().attr("style")
    );
    const isVideo = message.find(".tgme_widget_message_video_player").length > 0 || Boolean(videoThumb);

    const thumbnailUrl = photoUrls[0] ?? videoThumb;
    // Пост без единого изображения в сетку не попадает — иллюстрировать нечем
    if (!thumbnailUrl) return;

    const type: SocialMediaItem["type"] = isVideo
      ? "video"
      : photoUrls.length > 1
        ? "carousel"
        : "image";

    media.push({
      id: post,
      type,
      mediaUrl: thumbnailUrl,
      thumbnailUrl,
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
