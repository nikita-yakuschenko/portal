import { config } from "../../config.js";
import { OutboundError } from "./social-http.js";

/**
 * Прокси картинок соцсетей.
 *
 * Отдельный узкий канал, а не универсальный прокси: только https, только
 * известные CDN площадок, только изображения и с жёстким потолком по размеру.
 * Иначе эндпоинт превращается в SSRF-инструмент против внутренней сети.
 */

const ALLOWED_HOSTS = ["t.me", "telesco.pe"];
const ALLOWED_HOST_SUFFIXES = [
  ".telesco.pe",
  ".cdninstagram.com",
  ".fbcdn.net",
  ".instagram.com",
  // Дзен: аватары каналов и обложки публикаций
  ".dzeninfra.ru"
];

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  // Видео Telegram: чёткий кадр есть только в самом файле, превью размыто
  "video/mp4"
];

/** Потолок на один кусок видео — плеер докачает остальное запросами Range */
const VIDEO_CHUNK_LIMIT = 24 * 1024 * 1024;

export function isAllowedMediaUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.port && url.port !== "443") return false;

  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOSTS.includes(host)) return true;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export type ProxiedMedia = {
  contentType: string;
  body: Buffer;
  /** 206 при отдаче диапазона — иначе браузер не станет играть видео */
  status: number;
  contentRange?: string | undefined;
};

/** Видео тяжелее картинок, но не бесконечно: потолок на один кусок */
function limitFor(contentType: string): number {
  return contentType.startsWith("video/")
    ? Math.max(config.social.mediaMaxBytes, VIDEO_CHUNK_LIMIT)
    : config.social.mediaMaxBytes;
}

export async function fetchProxiedMedia(
  rawUrl: string,
  range?: string | undefined
): Promise<ProxiedMedia> {
  if (!isAllowedMediaUrl(rawUrl)) {
    throw new OutboundError("Домен не разрешён", "host_not_allowed");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.social.fetchTimeoutMs);

  try {
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "image/*,video/*",
        // Диапазон прокидываем как есть: плеер сам решает, что ему нужно
        ...(range ? { Range: range } : {})
      }
    });

    if (!response.ok) {
      throw new OutboundError("Источник вернул ошибку", "upstream_error", response.status);
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new OutboundError(`Неподходящий тип ${contentType || "—"}`, "content_type_rejected");
    }

    const maxBytes = limitFor(contentType);
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > maxBytes) {
      throw new OutboundError("Файл слишком большой", "response_too_large");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new OutboundError("Файл слишком большой", "response_too_large");
    }

    return {
      contentType,
      body: buffer,
      status: response.status === 206 ? 206 : 200,
      contentRange: response.headers.get("content-range") ?? undefined
    };
  } catch (error) {
    if (error instanceof OutboundError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OutboundError("Таймаут загрузки медиа", "timeout");
    }
    throw new OutboundError(
      error instanceof Error ? error.message : "Ошибка загрузки медиа",
      "network_error"
    );
  } finally {
    clearTimeout(timer);
  }
}
