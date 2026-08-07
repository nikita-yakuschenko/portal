import { randomUUID } from "node:crypto";

import type { SocialMediaItem, SocialProfileSnapshot } from "@b2b/domain";

import { config } from "../../config.js";
import { fetchTextLimited, OutboundError } from "./social-http.js";
import type { ProviderResult } from "./telegram-provider.js";

/**
 * Провайдер Instagram по многоуровневой стратегии:
 *   1. официальный Graph API (Business Discovery) — если заданы Meta credentials;
 *   2. внешний Playwright-collector — если задан его адрес;
 *   3. честный `unavailable` с диагностикой.
 *
 * Внутренний web-эндпоинт Instagram не используется: он не публичный контракт
 * и без сессии отдаёт login wall, а выдавать это за данные партнёра нельзя.
 */

const MAX_RESPONSE_BYTES = 1024 * 1024;
const GRAPH_API_VERSION = "v21.0";

function baseResult(
  username: string,
  profileUrl: string,
  status: SocialProfileSnapshot["status"],
  source: SocialProfileSnapshot["source"],
  diagnostics: SocialProfileSnapshot["diagnostics"]
): ProviderResult {
  return {
    platform: "instagram",
    profileUrl,
    username,
    media: [],
    source,
    status,
    fetchedAt: new Date().toISOString(),
    diagnostics
  };
}

type GraphMediaNode = {
  id?: unknown;
  media_type?: unknown;
  media_url?: unknown;
  thumbnail_url?: unknown;
  permalink?: unknown;
  caption?: unknown;
  timestamp?: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapGraphMedia(raw: unknown): SocialMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const items: SocialMediaItem[] = [];
  for (const entry of raw as GraphMediaNode[]) {
    const id = asString(entry.id);
    if (!id) continue;
    const mediaType = asString(entry.media_type)?.toUpperCase();
    const type: SocialMediaItem["type"] =
      mediaType === "VIDEO"
        ? "video"
        : mediaType === "CAROUSEL_ALBUM"
          ? "carousel"
          : mediaType === "IMAGE"
            ? "image"
            : "unknown";
    items.push({
      id,
      type,
      mediaUrl: asString(entry.media_url),
      thumbnailUrl: asString(entry.thumbnail_url) ?? asString(entry.media_url),
      permalink: asString(entry.permalink),
      caption: asString(entry.caption),
      publishedAt: asString(entry.timestamp)
    });
  }
  return items;
}

/**
 * Business Discovery отдаёт данные только по Business/Creator-аккаунтам
 * и только от имени собственного IG-аккаунта приложения.
 */
async function fetchViaGraphApi(input: {
  username: string;
  profileUrl: string;
  requestId: string;
  startedAt: number;
}): Promise<ProviderResult | null> {
  const { metaAccessToken, metaBusinessId } = config.social.instagram;
  if (!metaAccessToken || !metaBusinessId) return null;

  const fields =
    `business_discovery.username(${input.username})` +
    "{username,name,biography,profile_picture_url,followers_count,follows_count,media_count," +
    "media.limit(12){id,media_type,media_url,thumbnail_url,permalink,caption,timestamp}}";

  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${metaBusinessId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", metaAccessToken);

  const response = await fetchTextLimited(url.toString(), {
    timeoutMs: config.social.fetchTimeoutMs,
    maxBytes: MAX_RESPONSE_BYTES,
    redirect: "follow",
    headers: { Accept: "application/json" }
  });

  if (response.status !== 200) {
    return baseResult(
      input.username,
      input.profileUrl,
      response.status === 429 ? "rate_limited" : "unavailable",
      "instagram_graph_api",
      {
        providerStage: "graph_api",
        upstreamStatus: response.status,
        requestId: input.requestId,
        durationMs: Date.now() - input.startedAt
      }
    );
  }

  let payload: { business_discovery?: Record<string, unknown> };
  try {
    payload = JSON.parse(response.body) as { business_discovery?: Record<string, unknown> };
  } catch {
    return baseResult(input.username, input.profileUrl, "unavailable", "instagram_graph_api", {
      providerStage: "graph_api",
      errorClass: "invalid_json",
      requestId: input.requestId,
      durationMs: Date.now() - input.startedAt
    });
  }

  const discovery = payload.business_discovery;
  if (!discovery) {
    // Профиль не Business/Creator либо недоступен приложению — это не «пусто», а «нет данных»
    return baseResult(input.username, input.profileUrl, "not_found", "instagram_graph_api", {
      providerStage: "graph_api",
      upstreamStatus: 200,
      errorClass: "business_discovery_empty",
      requestId: input.requestId,
      durationMs: Date.now() - input.startedAt
    });
  }

  const mediaContainer = discovery.media as { data?: unknown } | undefined;

  return {
    platform: "instagram",
    profileUrl: input.profileUrl,
    username: asString(discovery.username) ?? input.username,
    displayName: asString(discovery.name),
    biography: asString(discovery.biography),
    avatarUrl: asString(discovery.profile_picture_url),
    followersCount: asNumber(discovery.followers_count),
    followingCount: asNumber(discovery.follows_count),
    postsCount: asNumber(discovery.media_count),
    media: mapGraphMedia(mediaContainer?.data),
    source: "instagram_graph_api",
    status: "live",
    fetchedAt: new Date().toISOString(),
    diagnostics: {
      providerStage: "graph_api",
      upstreamStatus: 200,
      requestId: input.requestId,
      durationMs: Date.now() - input.startedAt
    }
  };
}

/** Внешний браузерный коллектор: отдельный сервис, Chromium внутри API не поднимаем */
async function fetchViaCollector(input: {
  username: string;
  profileUrl: string;
  requestId: string;
  startedAt: number;
}): Promise<ProviderResult | null> {
  const { collectorUrl, collectorToken } = config.social.instagram;
  if (!collectorUrl) return null;

  const endpoint = new URL("/collect/instagram", collectorUrl).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.social.fetchTimeoutMs + 10_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(collectorToken ? { Authorization: `Bearer ${collectorToken}` } : {})
      },
      body: JSON.stringify({ profileUrl: input.profileUrl })
    });

    if (!response.ok) {
      return baseResult(input.username, input.profileUrl, "unavailable", "instagram_playwright", {
        providerStage: "collector",
        upstreamStatus: response.status,
        requestId: input.requestId,
        durationMs: Date.now() - input.startedAt
      });
    }

    const payload = (await response.json()) as Partial<ProviderResult> & {
      status?: SocialProfileSnapshot["status"];
    };

    // Коллектор обязан сообщать честный статус: challenge/login_required не маскируем
    if (!payload.status || payload.status !== "live") {
      return baseResult(
        input.username,
        input.profileUrl,
        payload.status ?? "unavailable",
        "instagram_playwright",
        {
          providerStage: "collector",
          requestId: input.requestId,
          durationMs: Date.now() - input.startedAt
        }
      );
    }

    return {
      ...baseResult(input.username, input.profileUrl, "live", "instagram_playwright", {
        providerStage: "collector",
        requestId: input.requestId,
        durationMs: Date.now() - input.startedAt
      }),
      displayName: payload.displayName,
      biography: payload.biography,
      avatarUrl: payload.avatarUrl,
      followersCount: payload.followersCount,
      followingCount: payload.followingCount,
      postsCount: payload.postsCount,
      category: payload.category,
      website: payload.website,
      media: Array.isArray(payload.media) ? payload.media : []
    };
  } catch (error) {
    return baseResult(input.username, input.profileUrl, "unavailable", "instagram_playwright", {
      providerStage: "collector",
      errorClass: error instanceof Error ? error.name : "collector_error",
      requestId: input.requestId,
      durationMs: Date.now() - input.startedAt
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchInstagramProfile(input: {
  username: string;
  profileUrl: string;
}): Promise<ProviderResult> {
  const requestId = randomUUID();
  const startedAt = Date.now();

  if (config.social.instagram.provider === "off") {
    return baseResult(input.username, input.profileUrl, "unavailable", "none", {
      providerStage: "disabled",
      errorClass: "provider_off",
      requestId
    });
  }

  try {
    const viaGraph = await fetchViaGraphApi({ ...input, requestId, startedAt });
    if (viaGraph) return viaGraph;

    const viaCollector = await fetchViaCollector({ ...input, requestId, startedAt });
    if (viaCollector) return viaCollector;

    // Ни Meta credentials, ни collector не настроены — честно сообщаем об этом
    return baseResult(input.username, input.profileUrl, "unavailable", "none", {
      providerStage: "not_configured",
      errorClass: "instagram_provider_not_configured",
      requestId,
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    return baseResult(input.username, input.profileUrl, "unavailable", "none", {
      providerStage: "fetch",
      errorClass: error instanceof OutboundError ? error.errorClass : "unexpected_error",
      requestId,
      durationMs: Date.now() - startedAt
    });
  }
}
