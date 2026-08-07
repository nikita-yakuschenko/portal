import { randomUUID } from "node:crypto";

import type { SocialProfileSnapshot } from "@b2b/domain";

import { config } from "../../config.js";
import { parseDzenExport } from "./dzen-parser.js";
import { fetchTextLimited, OutboundError } from "./social-http.js";
import type { ProviderResult } from "./telegram-provider.js";

/**
 * Провайдер Дзена: публичная витрина канала, тот же ответ, которым живёт сам
 * сайт Дзена. Ключи не нужны.
 *
 * RSS (`dzen.ru/{channel}?rss`) для этой задачи мёртв: он уводит запрос в
 * авторизацию Яндекса и заканчивается капчей, поэтому берём JSON витрины.
 */

// Витрина канала — около 1 МБ служебных полей на двадцать публикаций
const MAX_PAGE_BYTES = 4 * 1024 * 1024;

const EXPORT_ENDPOINT = "https://dzen.ru/api/v3/launcher/export";

function emptyResult(
  username: string,
  profileUrl: string,
  status: SocialProfileSnapshot["status"],
  diagnostics: SocialProfileSnapshot["diagnostics"]
): ProviderResult {
  return {
    platform: "dzen",
    profileUrl,
    username,
    media: [],
    source: "dzen_public_api",
    status,
    fetchedAt: new Date().toISOString(),
    diagnostics
  };
}

export async function fetchDzenProfile(input: {
  username: string;
  profileUrl: string;
}): Promise<ProviderResult> {
  const { username, profileUrl } = input;
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const response = await fetchTextLimited(
      `${EXPORT_ENDPOINT}?channel_name=${encodeURIComponent(username)}`,
      {
        timeoutMs: config.social.fetchTimeoutMs,
        maxBytes: MAX_PAGE_BYTES,
        headers: { Accept: "application/json" }
      }
    );

    if (response.status !== 200) {
      const status: SocialProfileSnapshot["status"] =
        response.status === 404 ? "not_found" : response.status === 429 ? "rate_limited" : "unavailable";
      return emptyResult(username, profileUrl, status, {
        providerStage: "export",
        upstreamStatus: response.status,
        requestId,
        durationMs: Date.now() - startedAt
      });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(response.body);
    } catch {
      return emptyResult(username, profileUrl, "unavailable", {
        providerStage: "export",
        upstreamStatus: 200,
        errorClass: "invalid_json",
        requestId,
        durationMs: Date.now() - startedAt
      });
    }

    // Несуществующий канал витрина отдаёт как 404, поэтому 200 без канала —
    // это смена формата ответа, а не отсутствие профиля
    const parsed = parseDzenExport(payload);
    if (!parsed) {
      return emptyResult(username, profileUrl, "unavailable", {
        providerStage: "export",
        upstreamStatus: 200,
        errorClass: "unexpected_payload",
        requestId,
        durationMs: Date.now() - startedAt
      });
    }

    return {
      platform: "dzen",
      profileUrl,
      username,
      displayName: parsed.displayName,
      biography: parsed.biography,
      avatarUrl: parsed.avatarUrl,
      followersCount: parsed.followersCount,
      website: parsed.website,
      media: parsed.media,
      source: "dzen_public_api",
      status: "live",
      fetchedAt: new Date().toISOString(),
      diagnostics: {
        providerStage: "export",
        upstreamStatus: 200,
        requestId,
        durationMs: Date.now() - startedAt
      }
    };
  } catch (error) {
    const errorClass = error instanceof OutboundError ? error.errorClass : "unexpected_error";
    return emptyResult(username, profileUrl, "unavailable", {
      providerStage: "fetch",
      errorClass,
      requestId,
      durationMs: Date.now() - startedAt
    });
  }
}
