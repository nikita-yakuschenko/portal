import type { SocialPlatform, SocialProfileSnapshot } from "@b2b/domain";

import { apiFetch } from "@/lib/api";
import { isPublicSiteRuntime } from "@/lib/partner-site-preview";

export type { SocialPlatform, SocialProfileSnapshot };

/** Площадки, у которых есть серверный провайдер данных */
export const PLATFORMS_WITH_LIVE_DATA: SocialPlatform[] = ["telegram", "instagram"];

export function hasLiveProvider(platform: string): platform is SocialPlatform {
  return (PLATFORMS_WITH_LIVE_DATA as string[]).includes(platform);
}

/**
 * Картинки соцсетей идут через серверный прокси: CDN Telegram и Instagram
 * закрыты referrer-политикой, а прямой запрос из браузера светит посетителя.
 */
export function proxiedMediaUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return `/api/public/social-media?url=${encodeURIComponent(url)}`;
}

/**
 * Снимок профиля: на публичном сайте — по partnerId, в кабинете — по сессии.
 * Ошибку не глотаем — вызывающий показывает честное состояние недоступности.
 */
export async function fetchSocialProfile(
  platform: SocialPlatform,
  partnerId: string | null
): Promise<SocialProfileSnapshot> {
  if (isPublicSiteRuntime) {
    if (!partnerId) throw new Error("Сайт не загружен");
    return apiFetch<SocialProfileSnapshot>(
      `/api/public/sites/${partnerId}/social-profile?platform=${platform}`
    );
  }
  return apiFetch<SocialProfileSnapshot>(`/api/partner/social-profile?platform=${platform}`);
}

/** 11700 → «11,7 тыс.»; форматирование живёт только в UI */
export function formatCount(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (value < 1000) return String(value);
  return new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

/** «2 часа назад» / «12 марта» для подписи публикации */
export function formatPublishedAt(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) return "только что";
  if (diffHours < 24) return `${diffHours} ч назад`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} дн назад`;

  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Человеческое объяснение статуса — показывается вместо выдуманных данных */
export function describeUnavailable(snapshot: SocialProfileSnapshot | null): {
  title: string;
  hint: string;
} {
  switch (snapshot?.status) {
    case "not_found":
      return {
        title: "Профиль не найден",
        hint: "Проверьте ссылку в настройках сайта — площадка такого профиля не отдаёт."
      };
    case "login_required":
      return {
        title: "Площадка требует вход",
        hint: "Публичные данные этого профиля закрыты без авторизации."
      };
    case "rate_limited":
      return {
        title: "Площадка ограничила запросы",
        hint: "Данные появятся, когда лимит снимется."
      };
    case "challenge":
      return {
        title: "Площадка запросила проверку",
        hint: "Автоматическое получение данных временно недоступно."
      };
    default:
      return {
        title: "Данные пока недоступны",
        hint: "Площадка не отдала публичный профиль."
      };
  }
}
