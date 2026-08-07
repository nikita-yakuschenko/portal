import type { SocialMediaItem } from "@b2b/domain";

/**
 * Чистые парсеры данных Instagram: JSON, который реально загрузил браузер,
 * и DOM как запасной путь. Сети здесь нет — всё покрывается fixtures.
 */

export type CollectedProfile = {
  username?: string | undefined;
  displayName?: string | undefined;
  biography?: string | undefined;
  avatarUrl?: string | undefined;
  followersCount?: number | undefined;
  followingCount?: number | undefined;
  postsCount?: number | undefined;
  category?: string | undefined;
  website?: string | undefined;
  media: SocialMediaItem[];
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function mediaTypeFromNode(node: Record<string, unknown>): SocialMediaItem["type"] {
  if (node.is_video === true) return "video";
  const typename = asString(node.__typename);
  if (typename === "GraphVideo" || typename === "XDTGraphVideo") return "video";
  if (typename === "GraphSidecar" || typename === "XDTGraphSidecar") return "carousel";
  if (typename === "GraphImage" || typename === "XDTGraphImage") return "image";
  const productType = asString(node.product_type);
  if (productType === "clips" || productType === "igtv") return "video";
  if (Array.isArray((record(node.edge_sidecar_to_children)?.edges as unknown[]) ?? [])) {
    if (record(node.edge_sidecar_to_children)) return "carousel";
  }
  return "unknown";
}

function captionFromNode(node: Record<string, unknown>): string | undefined {
  const edges = record(node.edge_media_to_caption)?.edges;
  if (Array.isArray(edges)) {
    for (const edge of edges) {
      const text = asString(record(record(edge)?.node)?.text);
      if (text) return text;
    }
  }
  return asString(record(node.caption)?.text);
}

/**
 * Разбор ответа `web_profile_info` / graphql, перехваченного из сети браузера.
 * null — в ответе нет пользователя: считать это успехом нельзя.
 */
export function parseProfileJson(payload: unknown): CollectedProfile | null {
  const root = record(payload);
  if (!root) return null;

  const user =
    record(record(root.data)?.user) ??
    record(record(record(root.data)?.user_result)?.user) ??
    record(root.user) ??
    record(record(root.graphql)?.user);

  if (!user) return null;

  const username = asString(user.username);
  if (!username) return null;

  const media: SocialMediaItem[] = [];
  const timelineEdges =
    (record(user.edge_owner_to_timeline_media)?.edges as unknown[] | undefined) ??
    (record(user.edge_felix_video_timeline)?.edges as unknown[] | undefined) ??
    [];

  for (const edge of timelineEdges) {
    const node = record(record(edge)?.node);
    if (!node) continue;
    const id = asString(node.id) ?? asString(node.shortcode);
    if (!id) continue;
    const shortcode = asString(node.shortcode);
    media.push({
      id,
      type: mediaTypeFromNode(node),
      mediaUrl: asString(node.display_url),
      thumbnailUrl: asString(node.thumbnail_src) ?? asString(node.display_url),
      permalink: shortcode ? `https://www.instagram.com/p/${shortcode}/` : undefined,
      caption: captionFromNode(node),
      publishedAt: (() => {
        const taken = asNumber(node.taken_at_timestamp) ?? asNumber(node.taken_at);
        return taken ? new Date(taken * 1000).toISOString() : undefined;
      })(),
      views: asNumber(node.video_view_count) ?? asNumber(node.play_count)
    });
  }

  return {
    username,
    displayName: asString(user.full_name),
    biography: asString(user.biography),
    avatarUrl: asString(user.profile_pic_url_hd) ?? asString(user.profile_pic_url),
    followersCount: asNumber(record(user.edge_followed_by)?.count) ?? asNumber(user.follower_count),
    followingCount: asNumber(record(user.edge_follow)?.count) ?? asNumber(user.following_count),
    postsCount:
      asNumber(record(user.edge_owner_to_timeline_media)?.count) ?? asNumber(user.media_count),
    category: asString(user.category_name) ?? asString(user.category),
    website: asString(user.external_url),
    media
  };
}

/** Число из подписи вида «11.7K followers» / «11,7 тыс. подписчиков» */
export function parseHumanCount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = /(\d[\d\s.,]*)\s*(K|M|B|тыс\.?|млн|млрд)?/i.exec(raw.replace(/ /g, " "));
  if (!match) return undefined;

  const digits = match[1]!.replace(/\s/g, "");
  // «1,234» — тысячи, «11.7» — дробь; ориентируемся на позицию разделителя
  const normalized = /,\d{3}\b/.test(digits)
    ? digits.replace(/,/g, "")
    : digits.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return undefined;

  const suffix = match[2]?.toLowerCase();
  const multiplier =
    suffix === "k" || suffix === "тыс" || suffix === "тыс."
      ? 1_000
      : suffix === "m" || suffix === "млн"
        ? 1_000_000
        : suffix === "b" || suffix === "млрд"
          ? 1_000_000_000
          : 1;

  return Math.round(value * multiplier);
}

export type DomSnapshotInput = {
  /** og:description вида «11.7K Followers, 120 Following, 340 Posts — …» */
  metaDescription?: string | undefined;
  ogTitle?: string | undefined;
  ogImage?: string | undefined;
  /** href публикаций, собранные из ссылок /p/, /reel/, /tv/ */
  postLinks: Array<{ href: string; imageUrl?: string | undefined; alt?: string | undefined }>;
  headerTitle?: string | undefined;
  biography?: string | undefined;
};

/**
 * Запасной разбор по DOM. Опирается на семантику и meta, а не на
 * сгенерированные классы Instagram — они меняются каждую неделю.
 */
export function parseProfileDom(input: DomSnapshotInput, username: string): CollectedProfile | null {
  const description = input.metaDescription ?? "";
  const counters = /([\d.,\s]+[KMBкмлрдтыс.]*)\s*(?:Followers|подписчик)/i.exec(description);
  const following = /([\d.,\s]+[KMBкмлрдтыс.]*)\s*(?:Following|подписк)/i.exec(description);
  const posts = /([\d.,\s]+[KMBкмлрдтыс.]*)\s*(?:Posts|публикац)/i.exec(description);

  const media: SocialMediaItem[] = [];
  for (const link of input.postLinks) {
    const match = /\/(p|reel|tv)\/([^/?#]+)/.exec(link.href);
    if (!match) continue;
    const kind = match[1]!;
    media.push({
      id: match[2]!,
      type: kind === "p" ? "image" : "video",
      thumbnailUrl: link.imageUrl,
      mediaUrl: link.imageUrl,
      permalink: `https://www.instagram.com${link.href.startsWith("/") ? link.href : `/${link.href}`}`,
      caption: link.alt
    });
  }

  const displayName = input.headerTitle ?? input.ogTitle?.split("(")[0]?.trim();
  const hasAnything =
    media.length > 0 || counters !== null || Boolean(displayName) || Boolean(input.biography);
  if (!hasAnything) return null;

  return {
    username,
    displayName,
    biography: input.biography,
    avatarUrl: input.ogImage,
    followersCount: parseHumanCount(counters?.[1]),
    followingCount: parseHumanCount(following?.[1]),
    postsCount: parseHumanCount(posts?.[1]),
    media
  };
}

export type PageSignals = {
  finalUrl: string;
  status?: number | undefined;
  title?: string | undefined;
  bodyText: string;
};

export type CollectorStatus =
  | "live"
  | "not_found"
  | "login_required"
  | "rate_limited"
  | "challenge"
  | "unavailable";

/**
 * Классификация того, что показал Instagram.
 * Пустой успешный ответ недопустим: если данных нет — статус объясняет причину.
 */
export function classifyPage(signals: PageSignals): CollectorStatus | null {
  const url = signals.finalUrl.toLowerCase();
  const text = signals.bodyText.toLowerCase();

  if (signals.status === 429 || text.includes("please wait a few minutes")) return "rate_limited";
  if (url.includes("/challenge") || text.includes("suspicious login")) return "challenge";
  if (url.includes("/accounts/login") || url.includes("/accounts/signup")) return "login_required";
  if (signals.status === 404 || text.includes("sorry, this page isn't available")) {
    return "not_found";
  }
  if (text.includes("this account is private") || text.includes("аккаунт закрыт")) {
    // Приватный аккаунт существует, но публичных данных не отдаёт
    return "login_required";
  }
  return null;
}
