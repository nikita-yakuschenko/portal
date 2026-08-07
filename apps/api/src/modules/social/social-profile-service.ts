import { and, eq } from "drizzle-orm";

import type { SocialPlatform, SocialProfileSnapshot } from "@b2b/domain";

import { config } from "../../config.js";
import { db } from "../../db/client.js";
import { socialProfileSnapshots } from "../../db/schema.js";
import { createId } from "../../lib/ids.js";
import { fetchDzenProfile } from "./dzen-provider.js";
import { fetchInstagramProfile } from "./instagram-provider.js";
import { fetchTelegramProfile, type ProviderResult } from "./telegram-provider.js";

/**
 * Снимки профилей: чтение из БД, фоновое обновление и честные статусы.
 *
 * Модель — stale-while-revalidate: посетитель всегда получает последний
 * валидный снимок мгновенно, а поход к площадке идёт в фоне и только один
 * на профиль. Провайдер не знает ни про БД, ни про HTTP-слой.
 */

type ProviderFn = (input: {
  username: string;
  profileUrl: string;
}) => Promise<ProviderResult>;

const PROVIDERS: Partial<Record<SocialPlatform, ProviderFn>> = {
  telegram: fetchTelegramProfile,
  instagram: fetchInstagramProfile,
  dzen: fetchDzenProfile
};

/** Один активный сбор на профиль: остальные ждут его результат */
const inFlight = new Map<string, Promise<SocialProfileSnapshot>>();

/** Пауза для профиля после повторяющихся отказов площадки */
const breaker = new Map<string, { failures: number; openUntil: number }>();

const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 10 * 60 * 1000;

function cacheKey(platform: SocialPlatform, username: string): string {
  return `${platform}:${username.toLowerCase()}`;
}

function ttlMs(): number {
  return config.social.profileTtlMinutes * 60 * 1000;
}

function isBreakerOpen(key: string): boolean {
  const state = breaker.get(key);
  if (!state) return false;
  if (state.openUntil > Date.now()) return true;
  breaker.delete(key);
  return false;
}

function noteFailure(key: string, status: SocialProfileSnapshot["status"]): void {
  // Отсутствие профиля — не сбой площадки, размыкать нечего
  if (status === "not_found") return;
  const state = breaker.get(key) ?? { failures: 0, openUntil: 0 };
  state.failures += 1;
  if (state.failures >= BREAKER_THRESHOLD) {
    state.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
  }
  breaker.set(key, state);
}

function noteSuccess(key: string): void {
  breaker.delete(key);
}

type StoredRow = typeof socialProfileSnapshots.$inferSelect;

function rowToSnapshot(row: StoredRow, status: SocialProfileSnapshot["status"]): SocialProfileSnapshot {
  const payload = row.payload as Partial<SocialProfileSnapshot>;
  return {
    platform: row.platform as SocialPlatform,
    profileUrl: row.profileUrl,
    username: row.username,
    displayName: payload.displayName,
    biography: payload.biography,
    avatarUrl: payload.avatarUrl,
    followersCount: payload.followersCount,
    followingCount: payload.followingCount,
    postsCount: payload.postsCount,
    category: payload.category,
    website: payload.website,
    location: payload.location,
    pinnedMessage: payload.pinnedMessage,
    media: Array.isArray(payload.media) ? payload.media : [],
    source: "cache",
    status,
    fetchedAt: row.fetchedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString()
  };
}

async function readRow(platform: SocialPlatform, username: string): Promise<StoredRow | null> {
  const [row] = await db
    .select()
    .from(socialProfileSnapshots)
    .where(
      and(
        eq(socialProfileSnapshots.platform, platform),
        eq(socialProfileSnapshots.username, username.toLowerCase())
      )
    )
    .limit(1);
  return row ?? null;
}

async function persist(result: ProviderResult, expiresAt: Date): Promise<void> {
  const now = new Date();
  const existing = await readRow(result.platform, result.username);

  // Неудачная попытка не затирает прежние данные — только отметку о попытке
  if (result.status !== "live") {
    if (!existing) return;
    await db
      .update(socialProfileSnapshots)
      .set({
        lastAttemptAt: now,
        lastAttemptStatus: result.status,
        lastErrorClass: result.diagnostics?.errorClass ?? null
      })
      .where(eq(socialProfileSnapshots.id, existing.id));
    return;
  }

  const payload = {
    displayName: result.displayName,
    biography: result.biography,
    avatarUrl: result.avatarUrl,
    followersCount: result.followersCount,
    followingCount: result.followingCount,
    postsCount: result.postsCount,
    category: result.category,
    website: result.website,
    location: result.location,
    pinnedMessage: result.pinnedMessage,
    media: result.media
  };

  if (existing) {
    await db
      .update(socialProfileSnapshots)
      .set({
        profileUrl: result.profileUrl,
        source: result.source,
        payload,
        fetchedAt: new Date(result.fetchedAt),
        expiresAt,
        lastAttemptAt: now,
        lastAttemptStatus: result.status,
        lastErrorClass: null
      })
      .where(eq(socialProfileSnapshots.id, existing.id));
    return;
  }

  await db.insert(socialProfileSnapshots).values({
    id: createId(),
    platform: result.platform,
    username: result.username.toLowerCase(),
    profileUrl: result.profileUrl,
    source: result.source,
    payload,
    fetchedAt: new Date(result.fetchedAt),
    expiresAt,
    lastAttemptAt: now,
    lastAttemptStatus: result.status,
    lastErrorClass: null
  });
}

async function refresh(
  platform: SocialPlatform,
  username: string,
  profileUrl: string
): Promise<SocialProfileSnapshot> {
  const key = cacheKey(platform, username);
  const provider = PROVIDERS[platform];
  const expiresAt = new Date(Date.now() + ttlMs());

  if (!provider) {
    return {
      platform,
      profileUrl,
      username,
      media: [],
      source: "none",
      status: "unavailable",
      fetchedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      diagnostics: { providerStage: "no_provider", errorClass: "provider_not_implemented" }
    };
  }

  const result = await provider({ username, profileUrl });
  await persist(result, expiresAt);

  if (result.status === "live") {
    noteSuccess(key);
    return { ...result, expiresAt: expiresAt.toISOString() };
  }

  noteFailure(key, result.status);

  // Свежее получение не удалось — отдаём прошлый снимок как stale, если он есть
  const previous = await readRow(platform, username);
  if (previous) {
    return {
      ...rowToSnapshot(previous, "stale"),
      diagnostics: result.diagnostics
    };
  }

  return { ...result, expiresAt: expiresAt.toISOString() };
}

function refreshOnce(
  platform: SocialPlatform,
  username: string,
  profileUrl: string
): Promise<SocialProfileSnapshot> {
  const key = cacheKey(platform, username);
  const running = inFlight.get(key);
  if (running) return running;

  const task = refresh(platform, username, profileUrl).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, task);
  return task;
}

export const socialProfileService = {
  /**
   * Снимок профиля для публичной витрины.
   * Свежий кэш отдаётся сразу; просроченный — сразу же, но со статусом `stale`
   * и фоновым обновлением. Chromium/HTTP на каждый просмотр страницы не поднимается.
   */
  async getProfile(input: {
    platform: SocialPlatform;
    username: string;
    profileUrl: string;
  }): Promise<SocialProfileSnapshot> {
    const { platform, username, profileUrl } = input;
    const key = cacheKey(platform, username);
    const row = await readRow(platform, username);
    const now = Date.now();

    if (row && row.expiresAt.getTime() > now) {
      return rowToSnapshot(row, "live");
    }

    if (row) {
      if (!isBreakerOpen(key)) {
        void refreshOnce(platform, username, profileUrl).catch(() => undefined);
      }
      return rowToSnapshot(row, "stale");
    }

    if (isBreakerOpen(key)) {
      return {
        platform,
        profileUrl,
        username,
        media: [],
        source: "none",
        status: "unavailable",
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(now + ttlMs()).toISOString(),
        diagnostics: { providerStage: "circuit_open", errorClass: "circuit_breaker_open" }
      };
    }

    return refreshOnce(platform, username, profileUrl);
  },

  /** Для тестов и обслуживания: сбросить состояние прерывателя */
  resetBreaker(): void {
    breaker.clear();
  }
};
