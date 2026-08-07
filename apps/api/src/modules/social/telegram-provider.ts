import { randomUUID } from "node:crypto";

import type { SocialProfileSnapshot } from "@b2b/domain";

import { config } from "../../config.js";
import { fetchTextLimited, OutboundError } from "./social-http.js";
import { parseTelegramFeedPage, parseTelegramProfilePage } from "./telegram-parser.js";

/**
 * Провайдер Telegram: публичная лента t.me/s/{username}, при её отсутствии —
 * карточка профиля t.me/{username}. Никаких API-ключей, только публичные страницы.
 */

const MAX_PAGE_BYTES = 2 * 1024 * 1024;

export type ProviderResult = Omit<SocialProfileSnapshot, "expiresAt">;

function emptyResult(
  username: string,
  profileUrl: string,
  status: SocialProfileSnapshot["status"],
  diagnostics: SocialProfileSnapshot["diagnostics"]
): ProviderResult {
  return {
    platform: "telegram",
    profileUrl,
    username,
    media: [],
    source: "telegram_public_page",
    status,
    fetchedAt: new Date().toISOString(),
    diagnostics
  };
}

export async function fetchTelegramProfile(input: {
  username: string;
  profileUrl: string;
}): Promise<ProviderResult> {
  const { username, profileUrl } = input;
  const requestId = randomUUID();
  const startedAt = Date.now();
  const timeoutMs = config.social.fetchTimeoutMs;

  try {
    const feed = await fetchTextLimited(`https://t.me/s/${username}`, {
      timeoutMs,
      maxBytes: MAX_PAGE_BYTES
    });

    if (feed.status === 429) {
      return emptyResult(username, profileUrl, "rate_limited", {
        providerStage: "feed",
        upstreamStatus: 429,
        requestId,
        durationMs: Date.now() - startedAt
      });
    }

    if (feed.status === 200) {
      const parsed = parseTelegramFeedPage(feed.body);
      if (parsed) {
        return {
          platform: "telegram",
          profileUrl,
          username,
          displayName: parsed.displayName,
          biography: parsed.biography,
          avatarUrl: parsed.avatarUrl,
          followersCount: parsed.followersCount,
          postsCount: parsed.postsCount,
          media: parsed.media,
          source: "telegram_public_page",
          status: "live",
          fetchedAt: new Date().toISOString(),
          diagnostics: {
            providerStage: "feed",
            upstreamStatus: 200,
            requestId,
            durationMs: Date.now() - startedAt
          }
        };
      }
    }

    // Редирект с /s/ означает: это не публичный канал (бот, группа, приватный)
    const profile = await fetchTextLimited(`https://t.me/${username}`, {
      timeoutMs,
      maxBytes: MAX_PAGE_BYTES,
      redirect: "follow"
    });

    if (profile.status !== 200) {
      return emptyResult(
        username,
        profileUrl,
        profile.status === 429 ? "rate_limited" : "unavailable",
        {
          providerStage: "profile",
          upstreamStatus: profile.status,
          requestId,
          durationMs: Date.now() - startedAt
        }
      );
    }

    const parsedProfile = parseTelegramProfilePage(profile.body);
    if (!parsedProfile) {
      return emptyResult(username, profileUrl, "not_found", {
        providerStage: "profile",
        upstreamStatus: 200,
        requestId,
        durationMs: Date.now() - startedAt
      });
    }

    return {
      platform: "telegram",
      profileUrl,
      username,
      displayName: parsedProfile.displayName,
      biography: parsedProfile.biography,
      avatarUrl: parsedProfile.avatarUrl,
      followersCount: parsedProfile.followersCount,
      media: [],
      source: "telegram_public_page",
      status: "live",
      fetchedAt: new Date().toISOString(),
      diagnostics: {
        providerStage: "profile",
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
