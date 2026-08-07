import type { SocialPlatform } from "@b2b/domain";

/**
 * Разбор ссылок соцсетей из конфига партнёра.
 *
 * Работает только с https и известными хостами: ссылка партнёра — это
 * недоверенный ввод, а провайдеры по ней ходят с сервера (SSRF).
 */

export type ParsedSocialUrl = {
  platform: SocialPlatform;
  /** Нормализованный идентификатор: нижний регистр, без @ и слэшей */
  username: string;
  /** Канонический публичный URL профиля */
  profileUrl: string;
};

const HOSTS: Record<SocialPlatform, string[]> = {
  telegram: ["t.me", "telegram.me", "telegram.dog"],
  instagram: ["instagram.com", "www.instagram.com"],
  vk: ["vk.com", "www.vk.com", "m.vk.com", "vkvideo.ru"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  dzen: ["dzen.ru", "www.dzen.ru", "zen.yandex.ru"],
  max: ["max.ru", "www.max.ru"]
};

/** Служебные пути площадок, которые не являются именем профиля */
const RESERVED_SEGMENTS: Record<SocialPlatform, string[]> = {
  telegram: ["s", "joinchat", "addstickers", "proxy", "socks", "share", "iv", "c"],
  instagram: ["p", "reel", "reels", "tv", "explore", "stories", "accounts", "direct"],
  vk: ["video", "wall", "feed", "im", "away", "audio", "search"],
  youtube: ["watch", "shorts", "playlist", "results", "feed", "embed"],
  dzen: ["video", "media", "profile", "suggest"],
  max: ["join", "invite"]
};

const USERNAME_PATTERN: Record<SocialPlatform, RegExp> = {
  telegram: /^[a-z0-9_]{4,32}$/,
  instagram: /^[a-z0-9._]{1,30}$/,
  vk: /^[a-z0-9._]{2,64}$/,
  youtube: /^@?[a-z0-9._\-]{2,64}$/,
  dzen: /^[a-z0-9._\-]{2,64}$/,
  max: /^[a-z0-9._\-]{2,64}$/
};

function platformByHost(host: string): SocialPlatform | null {
  const normalized = host.toLowerCase();
  for (const [platform, hosts] of Object.entries(HOSTS) as Array<[SocialPlatform, string[]]>) {
    if (hosts.includes(normalized)) return platform;
  }
  return null;
}

/**
 * Нормализация имени профиля: срезает @, регистр и мусор.
 * Возвращает null, если после нормализации имя не проходит формат площадки.
 */
export function normalizeUsername(platform: SocialPlatform, raw: string): string | null {
  const trimmed = raw.trim().replace(/^@/, "").toLowerCase();
  if (!trimmed) return null;
  const candidate = platform === "youtube" && !trimmed.startsWith("@") ? trimmed : trimmed;
  return USERNAME_PATTERN[platform].test(candidate) ? candidate : null;
}

/** Канонический URL профиля — по нему уходит посетитель по кнопке «Подписаться» */
export function buildProfileUrl(platform: SocialPlatform, username: string): string {
  switch (platform) {
    case "telegram":
      return `https://t.me/${username}`;
    case "instagram":
      return `https://www.instagram.com/${username}/`;
    case "vk":
      return `https://vk.com/${username}`;
    case "youtube":
      return `https://www.youtube.com/${username.startsWith("@") ? username : `@${username}`}`;
    case "dzen":
      return `https://dzen.ru/${username}`;
    case "max":
      return `https://max.ru/${username}`;
  }
}

/**
 * Разбирает ссылку из конфига партнёра. Ссылка на чужую площадку,
 * http, служебный путь или пустой профиль дают null — без исключений,
 * чтобы кривая ссылка одного партнёра не роняла страницу.
 */
export function parseSocialUrl(rawUrl: string): ParsedSocialUrl | null {
  const value = rawUrl.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;

  const platform = platformByHost(url.hostname);
  if (!platform) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  // t.me/s/name — та же сущность, что t.me/name
  const first = segments[0]!.toLowerCase();
  const candidateRaw =
    platform === "telegram" && first === "s" && segments[1] ? segments[1]! : segments[0]!;

  const candidate = candidateRaw.toLowerCase();
  const reserved = RESERVED_SEGMENTS[platform];
  if (reserved.includes(candidate) && !(platform === "telegram" && first === "s")) {
    return null;
  }

  const username = normalizeUsername(platform, candidate);
  if (!username) return null;

  return {
    platform,
    username,
    profileUrl: buildProfileUrl(platform, username)
  };
}

/** Платформы, для которых реализован живой провайдер данных */
export const PLATFORMS_WITH_PROVIDER: SocialPlatform[] = ["telegram", "instagram"];

/** Поле конфига сайта партнёра, где лежит ссылка на площадку */
export const SOCIAL_CONFIG_FIELD: Record<SocialPlatform, string> = {
  telegram: "socialTelegram",
  instagram: "socialInstagram",
  vk: "socialVk",
  youtube: "socialYoutube",
  dzen: "socialDzen",
  max: "socialMax"
};

/** Ссылка партнёра на площадку из конфига его сайта */
export function resolvePartnerSocialUrl(
  siteConfig: Record<string, unknown>,
  platform: SocialPlatform
): ParsedSocialUrl | null {
  const raw = siteConfig[SOCIAL_CONFIG_FIELD[platform]];
  if (typeof raw !== "string") return null;
  const parsed = parseSocialUrl(raw);
  // Ссылка на другую площадку в поле платформы — конфигурационная ошибка партнёра
  return parsed && parsed.platform === platform ? parsed : null;
}
