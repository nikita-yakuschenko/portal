/**
 * Единый контракт публичных профилей соцсетей партнёра.
 *
 * Правило: числа хранятся числами, форматирование («11,7 тыс.») живёт только в UI.
 * Отсутствующее значение — undefined, а не 0 и не выдуманная подстановка.
 */

/** Площадки, для которых существует провайдер данных */
export type SocialPlatform = "telegram" | "instagram" | "vk" | "youtube" | "dzen" | "max";

/**
 * Честное состояние снимка. `live` допустим только когда данные реально получены
 * от площадки в этом цикле; кэш всегда помечается `stale`.
 */
export type SocialProfileStatus =
  | "live"
  | "stale"
  | "unavailable"
  | "not_found"
  | "login_required"
  | "rate_limited"
  | "challenge";

/** Откуда взяты данные — попадает в ответ API и в лог */
export type SocialProfileSource =
  | "telegram_public_page"
  | "instagram_graph_api"
  | "instagram_playwright"
  | "vk_api"
  | "youtube_data_api"
  | "dzen_public_api"
  | "cache"
  | "none";

export type SocialMediaItem = {
  id: string;
  type: "image" | "video" | "carousel" | "unknown";
  mediaUrl?: string | undefined;
  thumbnailUrl?: string | undefined;
  /**
   * Файл видео. У Telegram превью видео — намеренно размытая заглушка,
   * чёткий кадр есть только в самом файле.
   */
  videoUrl?: string | undefined;
  /** Ширина / высота исходника: без неё кадры приходится резать вслепую */
  aspectRatio?: number | undefined;
  permalink?: string | undefined;
  caption?: string | undefined;
  publishedAt?: string | undefined;
  views?: number | undefined;
};

/** Техническая диагностика получения — не показывается посетителю */
export type SocialProfileDiagnostics = {
  providerStage?: string | undefined;
  upstreamStatus?: number | undefined;
  errorClass?: string | undefined;
  requestId?: string | undefined;
  durationMs?: number | undefined;
};

export type SocialProfileSnapshot = {
  platform: SocialPlatform;
  profileUrl: string;
  username: string;
  displayName?: string | undefined;
  biography?: string | undefined;
  avatarUrl?: string | undefined;

  followersCount?: number | undefined;
  followingCount?: number | undefined;
  postsCount?: number | undefined;

  category?: string | undefined;
  website?: string | undefined;
  location?: string | undefined;

  /** Закреплённое сообщение канала — только если площадка его отдала */
  pinnedMessage?: string | undefined;

  media: SocialMediaItem[];

  source: SocialProfileSource;
  status: SocialProfileStatus;
  fetchedAt: string;
  expiresAt: string;

  diagnostics?: SocialProfileDiagnostics | undefined;
};

/** Статусы, при которых у нас есть содержательные данные для показа */
export function hasProfileData(snapshot: SocialProfileSnapshot): boolean {
  return snapshot.status === "live" || snapshot.status === "stale";
}

/** Ключ кэша: платформа + нормализованный username, без данных других партнёров */
export function socialProfileCacheKey(platform: SocialPlatform, username: string): string {
  return `social-profile:${platform}:${username.toLowerCase()}`;
}
