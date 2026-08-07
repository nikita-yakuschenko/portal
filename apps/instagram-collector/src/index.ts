import Fastify from "fastify";
import { z } from "zod";

import { closeBrowser, collectInstagramProfile } from "./collector.js";
import { config } from "./config.js";

/**
 * HTTP-оболочка коллектора.
 *
 * Сервис внутренний: наружу не публикуется, доступен только API по общему
 * токену. Наружу не отдаются ни cookies, ни HTML страницы — только
 * нормализованный профиль и техническая диагностика.
 */

const collectSchema = z.object({
  profileUrl: z.string().url()
});

const ALLOWED_HOSTS = ["instagram.com", "www.instagram.com"];
const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;

function parseProfileUrl(raw: string): { username: string; profileUrl: string } | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!ALLOWED_HOSTS.includes(url.hostname.toLowerCase())) return null;

  const segment = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (!segment || !USERNAME_PATTERN.test(segment)) return null;
  if (["p", "reel", "reels", "tv", "explore", "accounts", "direct"].includes(segment)) return null;

  return { username: segment, profileUrl: `https://www.instagram.com/${segment}/` };
}

async function main() {
  if (!config.token) {
    throw new Error("INSTAGRAM_COLLECTOR_TOKEN не задан — коллектор без авторизации не запускается");
  }

  const app = Fastify({ logger: true, bodyLimit: 64 * 1024 });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/collect/instagram", async (request, reply) => {
    const authorization = request.headers.authorization ?? "";
    if (authorization !== `Bearer ${config.token}`) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const parsedBody = collectSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({ message: "Некорректный profileUrl" });
    }

    const target = parseProfileUrl(parsedBody.data.profileUrl);
    if (!target) {
      return reply.status(400).send({ message: "Разрешены только профили instagram.com" });
    }

    const result = await collectInstagramProfile(target);

    request.log.info({
      event: "instagram_collect",
      username: target.username,
      resultStatus: result.status,
      providerStage: result.diagnostics.providerStage,
      upstreamStatus: result.diagnostics.upstreamStatus,
      durationMs: result.diagnostics.durationMs,
      mediaCount: result.profile?.media.length ?? 0,
      errorClass: result.diagnostics.errorClass,
      requestId: result.diagnostics.requestId
    });

    // Форма ответа совпадает с контрактом провайдера в API
    return {
      status: result.status,
      platform: "instagram",
      username: result.profile?.username ?? target.username,
      profileUrl: target.profileUrl,
      displayName: result.profile?.displayName,
      biography: result.profile?.biography,
      avatarUrl: result.profile?.avatarUrl,
      followersCount: result.profile?.followersCount,
      followingCount: result.profile?.followingCount,
      postsCount: result.profile?.postsCount,
      category: result.profile?.category,
      website: result.profile?.website,
      media: result.profile?.media ?? [],
      diagnostics: {
        providerStage: result.diagnostics.providerStage,
        upstreamStatus: result.diagnostics.upstreamStatus,
        durationMs: result.diagnostics.durationMs,
        requestId: result.diagnostics.requestId,
        errorClass: result.diagnostics.errorClass
      }
    };
  });

  const shutdown = async () => {
    await app.close();
    await closeBrowser();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  await app.listen({ port: config.port, host: config.host });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
