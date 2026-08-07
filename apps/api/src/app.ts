import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { randomBytes } from "node:crypto";
import Fastify from "fastify";
import { z } from "zod";

import { config } from "./config.js";
import { StoreTildaClient, verifyOfficialTildaKeys } from "./modules/catalog/tilda-client.js";
import { hashResetToken } from "./modules/auth/passwords.js";
import { partnerSiteService } from "./modules/partners/partner-site-service.js";
import { notificationService } from "./modules/notifications/notification-service.js";
import { messengerService } from "./modules/messenger/messenger-service.js";
import { PortalService } from "./modules/portal/portal-service.js";
import { socialProfileService } from "./modules/social/social-profile-service.js";
import { resolvePartnerSocialUrl } from "./modules/social/social-urls.js";
import { fetchProxiedMedia } from "./modules/social/media-proxy.js";
import { OutboundError } from "./modules/social/social-http.js";
import { consumeRateLimit } from "./modules/social/rate-limit.js";
import { partnerSiteDraftSchema } from "@b2b/site-schema";
import type { SocialProfileSnapshot } from "@b2b/domain";

const applicationSchema = z.object({
  inn: z.string().regex(/^\d{10}(\d{2})?$/, "ИНН должен содержать 10 или 12 цифр"),
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.email(),
  region: z.string().min(2),
  interests: z
    .array(z.enum(["modular", "panel_frame", "farms"]))
    .min(1, "Выберите хотя бы один интерес"),
  message: z.string().optional()
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

const reviewSchema = z.object({
  comment: z.string().optional()
});

const createCrmConnectionSchema = z.object({
  provider: z.enum(["amocrm", "bitrix24"]),
  portalUrl: z.url(),
  credentials: z.record(z.string(), z.string())
});

const createTeamUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(["partner_owner", "partner_member"])
});

const createInquirySchema = z.object({
  subject: z.string().min(2),
  message: z.string().min(2),
  projectId: z.string().optional()
});

const messengerPostMessageSchema = z.object({
  body: z.string().optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        dataBase64: z.string().min(1)
      })
    )
    .optional()
});

const messengerCreateRequestSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  projectId: z.string().optional(),
  partnerId: z.string().optional()
});

const messengerCreateChannelSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(2).max(500)
});

const messengerPinSchema = z.object({
  pinned: z.boolean()
});

const messengerMuteSchema = z.object({
  muted: z.boolean()
});

const messengerUpdateRequestSchema = z.object({
  status: z.enum(["open", "in_progress", "closed"])
});

const upsertPartnerPriceSchema = z.object({
  projectId: z.string().min(1),
  pricingMode: z.enum(["markup", "exact", "on_request"]),
  markupPercent: z.number().min(0).max(500).optional(),
  publicPrice: z.number().int().positive().optional(),
  isPublished: z.boolean().optional(),
  factorySelectedOptions: z.array(z.string()).optional(),
  extras: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string(),
        items: z.array(
          z.object({
            id: z.string().optional(),
            name: z.string().min(1),
            price: z.number().nonnegative().optional(),
            note: z.string().optional()
          })
        )
      })
    )
    .optional()
});

const createLeadSchema = z.object({
  projectId: z.string().optional(),
  customerName: z.string().min(2),
  customerPhone: z.string().min(5),
  customerEmail: z.email().optional(),
  message: z.string().optional()
});

const updatePartnerSiteSchema = z.object({
  config: partnerSiteDraftSchema,
  publish: z.boolean().optional()
});

const resolveSiteSchema = z.object({
  host: z.string().min(1)
});

const passwordResetRequestSchema = z.object({
  email: z.email()
});

const socialProfileQuerySchema = z.object({
  platform: z.enum(["telegram", "instagram", "vk", "youtube", "dzen", "max"])
});

const socialMediaQuerySchema = z.object({
  url: z.string().url().max(2048)
});

const updateCatalogProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  technology: z.enum(["modular", "panel_frame"]).optional(),
  area: z.number().int().positive().nullable().optional(),
  floors: z.number().int().positive().nullable().optional(),
  bedrooms: z.number().int().nonnegative().nullable().optional(),
  bathrooms: z.string().nullable().optional(),
  basePrice: z.number().int().nonnegative().nullable().optional(),
  active: z.boolean().optional()
});

const updateCatalogAssetSchema = z.object({
  type: z.enum(["exterior", "floor_plan", "interior", "unknown"]).optional(),
  floorNumber: z.number().int().positive().nullable().optional(),
  isPrimary: z.boolean().optional(),
  isHidden: z.boolean().optional()
});

const roomPolygonPointSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100)
});

const createProjectRoomSchema = z.object({
  floorNumber: z.number().int().positive(),
  name: z.string().min(1),
  area: z.number().positive()
});

const updateProjectRoomSchema = z.object({
  name: z.string().min(1).optional(),
  area: z.number().positive().optional(),
  polygon: z.array(roomPolygonPointSchema).optional(),
  sortOrder: z.number().int().nonnegative().optional()
});

const factoryOfferLineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().int().nonnegative()
});

const updateFactoryOfferSchema = z.object({
  basePrice: z.number().int().nonnegative().nullable().optional(),
  assembly: z.array(factoryOfferLineSchema),
  extras: z.array(factoryOfferLineSchema)
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(8),
  password: z.string().min(8)
});

type JwtPayload = {
  sub: string;
  partnerId: string | null;
  role: "company_admin" | "company_manager" | "partner_owner" | "partner_member";
  email: string;
  fullName: string;
};

function getAuthUser(request: { user?: unknown }): JwtPayload | null {
  if (!request.user || typeof request.user !== "object") {
    return null;
  }

  return request.user as JwtPayload;
}

export async function buildApp() {
  // Временно: вложения мессенджера уходят base64 в JSON (до S3).
  // 10 × 10 МБ × ~4/3 + запас на JSON.
  const app = Fastify({
    logger: true,
    bodyLimit: 150 * 1024 * 1024
  });
  const portalService = new PortalService(new StoreTildaClient());

  await app.register(cors, {
    origin: true,
    credentials: true
  });
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: {
      // Совпадает с maxAge cookie — иначе JWT протухнет раньше cookie
      expiresIn: "30d"
    },
    cookie: {
      cookieName: "b2b_session",
      signed: false
    }
  });

  // Persistent session: без maxAge cookie = session-only и сгорает при закрытии браузера
  const sessionCookieOptions = {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30
  };

  await portalService.ensureCompanyAdmin({
    email: config.adminEmail,
    password: config.adminPassword,
    fullName: config.adminFullName
  });

  await portalService.ensureDemoPartner({
    email: config.partnerEmail,
    password: config.partnerPassword,
    fullName: config.partnerFullName,
    companyName: config.partnerCompanyName,
    region: config.partnerRegion
  });

  await messengerService.ensureBootstrap();

  async function requireAuth(
    request: { jwtVerify: () => Promise<unknown>; user?: unknown },
    reply: { status: (code: number) => { send: (body: unknown) => unknown } }
  ) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ message: "Unauthorized" });
    }
  }

  async function requireRoles(
    request: { jwtVerify: () => Promise<unknown>; user?: unknown },
    reply: { status: (code: number) => { send: (body: unknown) => unknown } },
    roles: JwtPayload["role"][]
  ) {
    const authResult = await requireAuth(request, reply);
    if (authResult) {
      return authResult;
    }
    const user = getAuthUser(request);
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({ message: "Forbidden" });
    }
  }

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/public/partner-applications", async (request, reply) => {
    const parsed = applicationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      const payload: {
        inn: string;
        companyName: string;
        contactName: string;
        email: string;
        region: string;
        interests: Array<"modular" | "panel_frame" | "farms">;
        message?: string;
      } = {
        inn: parsed.data.inn,
        companyName: parsed.data.companyName,
        contactName: parsed.data.contactName,
        email: parsed.data.email,
        region: parsed.data.region,
        interests: parsed.data.interests
      };

      if (parsed.data.message) {
        payload.message = parsed.data.message;
      }

      return await portalService.submitPartnerApplication(payload);
    } catch (error) {
      return reply.status(400).send({ message: error instanceof Error ? error.message : "Application failed" });
    }
  });

  app.get("/api/public/sites/resolve", async (request, reply) => {
    const parsed = resolveSiteSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }
    const site = await partnerSiteService.resolveByHost(parsed.data.host);
    if (!site) {
      return reply.status(404).send({ message: "Сайт не найден" });
    }
    return site;
  });

  app.get("/api/public/sites/:partnerId/projects", async (request, reply) => {
    const { partnerId } = request.params as { partnerId: string };
    const published = await partnerSiteService.resolvePublishedByPartnerId(partnerId);
    if (!published) {
      return reply.status(404).send({ message: "Сайт не опубликован" });
    }
    return portalService.listPartnerStorefrontProjects(partnerId);
  });

  app.get("/api/public/sites/:partnerId/projects/:key", async (request, reply) => {
    const { partnerId, key } = request.params as { partnerId: string; key: string };
    const published = await partnerSiteService.resolvePublishedByPartnerId(partnerId);
    if (!published) {
      return reply.status(404).send({ message: "Сайт не опубликован" });
    }
    const project = await portalService.getPartnerStorefrontProject(partnerId, key);
    if (!project) {
      return reply.status(404).send({ message: "Проект не найден" });
    }
    return project;
  });

  app.post("/api/public/sites/:partnerId/leads", async (request, reply) => {
    const { partnerId } = request.params as { partnerId: string };
    const published = await partnerSiteService.resolvePublishedByPartnerId(partnerId);
    if (!published) {
      return reply.status(404).send({ message: "Сайт не опубликован" });
    }
    const parsed = createLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }
    const leadInput = {
      partnerId,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone
    } as {
      partnerId: string;
      projectId?: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      message?: string;
    };
    if (parsed.data.projectId !== undefined) leadInput.projectId = parsed.data.projectId;
    if (parsed.data.customerEmail !== undefined) leadInput.customerEmail = parsed.data.customerEmail;
    if (parsed.data.message !== undefined) leadInput.message = parsed.data.message;
    return portalService.createLead(leadInput);
  });

  /** Диагностика остаётся в логе: наружу уходят только данные профиля и статус */
  function toPublicSnapshot(snapshot: SocialProfileSnapshot) {
    const { diagnostics: _diagnostics, ...rest } = snapshot;
    return rest;
  }

  function logSocialFetch(
    request: { log: { info: (payload: Record<string, unknown>) => void } },
    snapshot: SocialProfileSnapshot
  ) {
    request.log.info({
      event: "social_profile_fetch",
      platform: snapshot.platform,
      username: snapshot.username,
      provider: snapshot.source,
      providerStage: snapshot.diagnostics?.providerStage,
      upstreamStatus: snapshot.diagnostics?.upstreamStatus,
      durationMs: snapshot.diagnostics?.durationMs,
      resultStatus: snapshot.status,
      mediaCount: snapshot.media.length,
      errorClass: snapshot.diagnostics?.errorClass,
      requestId: snapshot.diagnostics?.requestId
    });
  }

  /** Снимок профиля соцсети для витрины опубликованного сайта партнёра */
  app.get("/api/public/sites/:partnerId/social-profile", async (request, reply) => {
    const { partnerId } = request.params as { partnerId: string };
    if (!consumeRateLimit(`social:${request.ip}`, 60, 60_000)) {
      return reply.status(429).send({ message: "Слишком много запросов" });
    }

    const parsed = socialProfileQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const published = await partnerSiteService.resolvePublishedByPartnerId(partnerId);
    if (!published) {
      return reply.status(404).send({ message: "Сайт не опубликован" });
    }

    const link = resolvePartnerSocialUrl(
      published.config as unknown as Record<string, unknown>,
      parsed.data.platform
    );
    if (!link) {
      return reply.status(404).send({ message: "Ссылка на площадку не настроена" });
    }

    const snapshot = await socialProfileService.getProfile(link);
    logSocialFetch(request, snapshot);
    return toPublicSnapshot(snapshot);
  });

  /** То же самое для превью в кабинете — по черновику сайта, до публикации */
  app.get("/api/partner/social-profile", async (request, reply) => {
    const authResult = await requireAuth(request, reply);
    if (authResult) {
      return authResult;
    }
    const auth = getAuthUser(request)!;
    if (!auth.partnerId) {
      return reply.status(403).send({ message: "Forbidden" });
    }

    const parsed = socialProfileQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const site = await partnerSiteService.getByPartnerId(auth.partnerId);
    const link = resolvePartnerSocialUrl(
      site.config as unknown as Record<string, unknown>,
      parsed.data.platform
    );
    if (!link) {
      return reply.status(404).send({ message: "Ссылка на площадку не настроена" });
    }

    const snapshot = await socialProfileService.getProfile(link);
    logSocialFetch(request, snapshot);
    return toPublicSnapshot(snapshot);
  });

  /**
   * Прокси картинок соцсетей: CDN Telegram и Instagram не отдают их в браузер
   * напрямую из-за referrer-политик, а тянуть их клиентом — светить посетителя.
   */
  app.get("/api/public/social-media", async (request, reply) => {
    if (!consumeRateLimit(`media:${request.ip}`, 300, 60_000)) {
      return reply.status(429).send({ message: "Слишком много запросов" });
    }

    const parsed = socialMediaQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      const media = await fetchProxiedMedia(parsed.data.url, request.headers.range);
      reply
        .status(media.status)
        .header("Content-Type", media.contentType)
        .header("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
        .header("Content-Security-Policy", "default-src 'none'; sandbox")
        .header("X-Content-Type-Options", "nosniff")
        // Без Accept-Ranges плеер не станет перематывать и часто вовсе не начнёт играть
        .header("Accept-Ranges", "bytes");
      if (media.contentRange) {
        reply.header("Content-Range", media.contentRange);
      }
      return reply.send(media.body);
    } catch (error) {
      const errorClass = error instanceof OutboundError ? error.errorClass : "unexpected_error";
      request.log.info({ event: "social_media_proxy_rejected", errorClass });
      return reply.status(errorClass === "host_not_allowed" ? 400 : 502).send({
        message: "Медиа недоступно"
      });
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const user = await portalService.login(parsed.data.email, parsed.data.password);
    if (!user) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const token = await reply.jwtSign({
      sub: user.id,
      partnerId: user.partnerId,
      role: user.role,
      email: user.email,
      fullName: user.fullName
    } satisfies JwtPayload);

    reply.setCookie("b2b_session", token, sessionCookieOptions);

    return { user };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie("b2b_session", sessionCookieOptions);
    return { ok: true };
  });

  app.get("/api/auth/session", async (request, reply) => {
    const authResult = await requireAuth(request, reply);
    if (authResult) {
      return authResult;
    }

    const user = getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    return portalService.getMe(user.sub);
  });

  app.get("/api/notifications", async (request, reply) => {
    const authResult = await requireAuth(request, reply);
    if (authResult) return authResult;
    const user = getAuthUser(request)!;
    const query = request.query as { unreadOnly?: string; limit?: string };
    return notificationService.listForUser(user.sub, {
      unreadOnly: query.unreadOnly === "1" || query.unreadOnly === "true",
      limit: query.limit ? Number(query.limit) : 30
    });
  });

  app.get("/api/notifications/unread-count", async (request, reply) => {
    const authResult = await requireAuth(request, reply);
    if (authResult) return authResult;
    const count = await notificationService.unreadCount(getAuthUser(request)!.sub);
    return { count };
  });

  app.post("/api/notifications/:id/read", async (request, reply) => {
    const authResult = await requireAuth(request, reply);
    if (authResult) return authResult;
    const { id } = request.params as { id: string };
    const row = await notificationService.markRead(getAuthUser(request)!.sub, id);
    if (!row) {
      return reply.status(404).send({ message: "Уведомление не найдено" });
    }
    return row;
  });

  app.post("/api/notifications/read-all", async (request, reply) => {
    const authResult = await requireAuth(request, reply);
    if (authResult) return authResult;
    return notificationService.markAllRead(getAuthUser(request)!.sub);
  });

  app.post("/api/auth/password-reset/request", async (request, reply) => {
    const parsed = passwordResetRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const reset = await portalService.requestPasswordReset(parsed.data.email);
    return { issued: Boolean(reset), token: reset?.token };
  });

  app.post("/api/auth/password-reset/confirm", async (request, reply) => {
    const parsed = passwordResetConfirmSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await portalService.resetPassword(hashResetToken(parsed.data.token), parsed.data.password);
    } catch (error) {
      return reply.status(400).send({ message: error instanceof Error ? error.message : "Reset failed" });
    }
  });

  app.get("/api/company/dashboard", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.getCompanyDashboard();
  });

  app.get("/api/company/applications", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listPartnerApplications();
  });

  app.post("/api/company/applications/:id/approve", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      const reviewInput = {
        applicationId: z.object({ id: z.string() }).parse(request.params).id,
        actorUserId: getAuthUser(request)!.sub,
        action: "approve" as const
      } as {
        applicationId: string;
        actorUserId: string;
        action: "approve" | "reject";
        comment?: string;
      };

      if (parsed.data.comment !== undefined) {
        reviewInput.comment = parsed.data.comment;
      }

      return await portalService.reviewPartnerApplication(reviewInput);
    } catch (error) {
      return reply.status(400).send({ message: error instanceof Error ? error.message : "Approve failed" });
    }
  });

  app.post("/api/company/applications/:id/reject", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      const reviewInput = {
        applicationId: z.object({ id: z.string() }).parse(request.params).id,
        actorUserId: getAuthUser(request)!.sub,
        action: "reject" as const
      } as {
        applicationId: string;
        actorUserId: string;
        action: "approve" | "reject";
        comment?: string;
      };

      if (parsed.data.comment !== undefined) {
        reviewInput.comment = parsed.data.comment;
      }

      return await portalService.reviewPartnerApplication(reviewInput);
    } catch (error) {
      return reply.status(400).send({ message: error instanceof Error ? error.message : "Reject failed" });
    }
  });

  app.post("/api/company/catalog/sync/tilda", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    try {
      return await portalService.syncCatalogFromTilda(getAuthUser(request)!.sub);
    } catch (error) {
      return reply.status(502).send({
        message: error instanceof Error ? error.message : "Tilda sync failed"
      });
    }
  });

  app.get("/api/company/catalog/tilda-status", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const official = await verifyOfficialTildaKeys();
    return {
      officialApi: official,
      storeSources: config.tilda.sources.map((source) => ({
        key: source.key,
        storepartuid: source.storepartuid,
        recid: source.recid,
        catalogPath: source.catalogPath
      }))
    };
  });

  app.get("/api/company/catalog/sync-runs", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listCatalogSyncRuns();
  });

  app.get("/api/company/catalog/projects", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listCatalogProjects();
  });

  // Обновление заводских цен из Excel (модульные / ПКД), без синка Tilda
  app.post("/api/company/catalog/prices/import", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const fileSchema = z.object({
      fileName: z.string().min(1),
      dataBase64: z.string().min(1)
    });
    const parsed = z
      .object({
        modular: fileSchema.optional(),
        panelFrame: fileSchema.optional()
      })
      .safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }
    if (!parsed.data.modular && !parsed.data.panelFrame) {
      return reply.status(400).send({ message: "Прикрепите хотя бы один файл прайса" });
    }

    const files: Array<{
      fileName: string;
      buffer: Buffer;
      technology: "modular" | "panel_frame";
    }> = [];

    try {
      if (parsed.data.modular) {
        files.push({
          fileName: parsed.data.modular.fileName,
          buffer: Buffer.from(parsed.data.modular.dataBase64, "base64"),
          technology: "modular"
        });
      }
      if (parsed.data.panelFrame) {
        files.push({
          fileName: parsed.data.panelFrame.fileName,
          buffer: Buffer.from(parsed.data.panelFrame.dataBase64, "base64"),
          technology: "panel_frame"
        });
      }
    } catch {
      return reply.status(400).send({ message: "Не удалось прочитать файл (base64)" });
    }

    return portalService.importFactoryPricesFromExcel(files);
  });

  app.get("/api/company/catalog/projects/:id", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const { id } = request.params as { id: string };
    const project = await portalService.getCatalogProject(id);
    if (!project) {
      return reply.status(404).send({ message: "Проект не найден" });
    }
    return project;
  });

  app.patch("/api/company/catalog/projects/:id", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = updateCatalogProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const { id } = request.params as { id: string };
    const project = await portalService.updateCatalogProject(id, parsed.data);
    if (!project) {
      return reply.status(404).send({ message: "Проект не найден" });
    }
    return project;
  });

  app.put("/api/company/catalog/projects/:id/factory-offer", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = updateFactoryOfferSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const { id } = request.params as { id: string };
    const project = await portalService.updateFactoryOffer(id, parsed.data);
    if (!project) {
      return reply.status(404).send({ message: "Проект не найден" });
    }
    return project;
  });

  app.post("/api/company/catalog/projects/:id/clear-sync-overrides", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = z
      .object({
        fields: z.array(z.string()).optional()
      })
      .safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const { id } = request.params as { id: string };
    const project = await portalService.clearCatalogSyncOverrides(id, parsed.data.fields);
    if (!project) {
      return reply.status(404).send({ message: "Проект не найден" });
    }
    return project;
  });

  app.patch("/api/company/catalog/assets/:id", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = updateCatalogAssetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    if (
      parsed.data.type === undefined &&
      parsed.data.floorNumber === undefined &&
      parsed.data.isPrimary === undefined &&
      parsed.data.isHidden === undefined
    ) {
      return reply.status(400).send({
        message: "Нужно передать type, floorNumber, isPrimary и/или isHidden"
      });
    }

    const { id } = request.params as { id: string };
    const project = await portalService.updateCatalogAsset(id, parsed.data);
    if (!project) {
      return reply.status(404).send({ message: "Ассет не найден" });
    }
    return project;
  });

  app.post("/api/company/catalog/projects/:id/rooms", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = createProjectRoomSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const { id } = request.params as { id: string };
    const project = await portalService.createProjectRoom(id, parsed.data);
    if (!project) {
      return reply.status(404).send({ message: "Проект не найден" });
    }
    return project;
  });

  app.patch("/api/company/catalog/rooms/:id", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = updateProjectRoomSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    if (
      parsed.data.name === undefined &&
      parsed.data.area === undefined &&
      parsed.data.polygon === undefined &&
      parsed.data.sortOrder === undefined
    ) {
      return reply
        .status(400)
        .send({ message: "Нужно передать name, area, polygon и/или sortOrder" });
    }

    const { id } = request.params as { id: string };
    const project = await portalService.updateProjectRoom(id, parsed.data);
    if (!project) {
      return reply.status(404).send({ message: "Помещение не найдено" });
    }
    return project;
  });

  app.delete("/api/company/catalog/rooms/:id", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const { id } = request.params as { id: string };
    const project = await portalService.deleteProjectRoom(id);
    if (!project) {
      return reply.status(404).send({ message: "Помещение не найдено" });
    }
    return project;
  });

  app.get("/api/company/partners", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listPartners();
  });

  app.get("/api/company/partners/:partnerId", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    const partnerId = (request.params as { partnerId: string }).partnerId;
    const partner = await portalService.getCompanyPartner(partnerId);
    if (!partner) {
      return reply.status(404).send({ message: "Партнёр не найден" });
    }
    return partner;
  });

  app.post("/api/company/partners", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = z
      .object({
        email: z.email(),
        password: z.string().min(8).optional(),
        fullName: z.string().min(1).optional(),
        companyName: z.string().min(2).optional(),
        region: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        inn: z.string().nullable().optional(),
        legalName: z.string().nullable().optional()
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const temporaryPassword =
      parsed.data.password?.trim() || randomBytes(9).toString("base64url");

    try {
      const created = await portalService.createPartnerAccount({
        email: parsed.data.email,
        password: temporaryPassword,
        fullName: parsed.data.fullName,
        companyName: parsed.data.companyName,
        region: parsed.data.region,
        phone: parsed.data.phone,
        inn: parsed.data.inn ?? null,
        legalName: parsed.data.legalName ?? null
      });
      return {
        ...created,
        temporaryPassword
      };
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось создать партнёра"
      });
    }
  });

  app.patch("/api/company/partners/:partnerId/status", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const partnerId = (request.params as { partnerId: string }).partnerId;
    const parsed = z
      .object({ status: z.enum(["active", "suspended"]) })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await portalService.updatePartnerStatus({
        actorUserId: getAuthUser(request)!.sub,
        partnerId,
        status: parsed.data.status
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось обновить статус"
      });
    }
  });

  app.post("/api/company/partners/:partnerId/reset-password", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const partnerId = (request.params as { partnerId: string }).partnerId;
    try {
      return await portalService.resetPartnerOwnerPassword({
        actorUserId: getAuthUser(request)!.sub,
        partnerId
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось сбросить пароль"
      });
    }
  });

  app.get("/api/company/sites", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listCompanySites();
  });

  app.post("/api/company/sites/:partnerId/unpublish", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    const partnerId = (request.params as { partnerId: string }).partnerId;
    try {
      return await partnerSiteService.unpublishByHq({
        partnerId,
        actorUserId: getAuthUser(request)!.sub
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось снять сайт с публикации"
      });
    }
  });

  app.post("/api/company/sites/:partnerId/unlock-publish", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    const partnerId = (request.params as { partnerId: string }).partnerId;
    try {
      return await partnerSiteService.unlockPublishByHq({
        partnerId,
        actorUserId: getAuthUser(request)!.sub
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось разблокировать публикацию"
      });
    }
  });

  app.post("/api/company/sites/:partnerId/approve-republish", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    const partnerId = (request.params as { partnerId: string }).partnerId;
    try {
      return await partnerSiteService.approveRepublishByHq({
        partnerId,
        actorUserId: getAuthUser(request)!.sub
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось одобрить возобновление"
      });
    }
  });

  app.post("/api/company/sites/:partnerId/reject-republish", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    const partnerId = (request.params as { partnerId: string }).partnerId;
    try {
      return await partnerSiteService.rejectRepublishByHq({
        partnerId,
        actorUserId: getAuthUser(request)!.sub
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось отклонить запрос"
      });
    }
  });

  app.get("/api/company/team", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listCompanyTeam();
  });

  app.post("/api/company/team", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = z
      .object({
        fullName: z.string().min(2),
        email: z.email(),
        password: z.string().min(8),
        role: z.enum(["company_admin", "company_manager"])
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await portalService.createCompanyTeamUser({
        actorUserId: getAuthUser(request)!.sub,
        ...parsed.data
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось добавить сотрудника"
      });
    }
  });

  app.patch("/api/company/team/:userId", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin"]);
    if (roleCheck) {
      return roleCheck;
    }

    const userId = (request.params as { userId: string }).userId;
    const parsed = z.object({ isActive: z.boolean() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await portalService.setCompanyTeamUserActive({
        actorUserId: getAuthUser(request)!.sub,
        userId,
        isActive: parsed.data.isActive
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось обновить сотрудника"
      });
    }
  });

  app.get("/api/partner/me", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.getMe(getAuthUser(request)!.sub);
  });

  app.patch("/api/partner/profile", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = z
      .object({
        companyName: z.string().min(2),
        region: z.string().min(1),
        phone: z.string().min(1),
        email: z.email()
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const auth = getAuthUser(request)!;
    try {
      return await portalService.updatePartnerProfile({
        actorUserId: auth.sub,
        partnerId: auth.partnerId!,
        companyName: parsed.data.companyName,
        region: parsed.data.region,
        phone: parsed.data.phone,
        email: parsed.data.email
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось сохранить профиль"
      });
    }
  });

  app.patch("/api/company/partners/:partnerId/legal", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }

    const partnerId = (request.params as { partnerId: string }).partnerId;
    const parsed = z
      .object({
        legalName: z.string().nullable(),
        inn: z.string().nullable()
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await portalService.updatePartnerLegal({
        actorUserId: getAuthUser(request)!.sub,
        partnerId,
        legalName: parsed.data.legalName,
        inn: parsed.data.inn
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось обновить реквизиты"
      });
    }
  });

  app.get("/api/partner/catalog/projects", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    const partnerId = getAuthUser(request)!.partnerId!;
    const projects = (await portalService.listCatalogProjects()).filter(
      (project) => project.active
    );
    const ordered = await portalService.applyPartnerCatalogOrder(partnerId, projects);
    return ordered.map((project) => portalService.withVisibleAssets(project));
  });

  app.put("/api/partner/catalog/order", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = z
      .object({ projectIds: z.array(z.string().min(1)).min(1) })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    const order = await portalService.setPartnerCatalogOrder(
      getAuthUser(request)!.partnerId!,
      parsed.data.projectIds
    );
    return { projectIds: order };
  });

  app.get("/api/partner/catalog/projects/:id", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }

    const { id } = request.params as { id: string };
    const project = await portalService.getCatalogProject(id);
    // Скрытый HQ (active=false) отдаём: партнёр видит карточку в режиме «недоступен к заказу»
    if (!project) {
      return reply.status(404).send({ message: "Проект не найден" });
    }
    return portalService.withVisibleAssets(project);
  });

  app.get("/api/partner/pricing", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listPartnerProjectPrices(getAuthUser(request)!.partnerId!);
  });

  app.get("/api/partner/pricing/library", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.getPartnerExtraOptionLibrary(getAuthUser(request)!.partnerId!);
  });

  app.put("/api/partner/pricing", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = upsertPartnerPriceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await portalService.upsertPartnerProjectPrice({
        partnerId: getAuthUser(request)!.partnerId!,
        projectId: parsed.data.projectId,
        pricingMode: parsed.data.pricingMode,
        ...(parsed.data.markupPercent !== undefined
          ? { markupPercent: parsed.data.markupPercent }
          : {}),
        ...(parsed.data.publicPrice !== undefined ? { publicPrice: parsed.data.publicPrice } : {}),
        ...(parsed.data.isPublished !== undefined ? { isPublished: parsed.data.isPublished } : {}),
        ...(parsed.data.factorySelectedOptions !== undefined
          ? { factorySelectedOptions: parsed.data.factorySelectedOptions }
          : {}),
        ...(parsed.data.extras !== undefined
          ? {
              extras: parsed.data.extras.map((group) => ({
                id: group.id ?? `group_${Math.random().toString(36).slice(2, 10)}`,
                title: group.title,
                items: group.items.map((item) => {
                  const row: {
                    id: string;
                    name: string;
                    price?: number;
                    note?: string;
                  } = {
                    id: item.id ?? `extra_${Math.random().toString(36).slice(2, 10)}`,
                    name: item.name
                  };
                  if (item.price !== undefined) row.price = item.price;
                  if (item.note) row.note = item.note;
                  return row;
                })
              }))
            }
          : {})
      });
    } catch (error) {
      return reply
        .status(400)
        .send({ message: error instanceof Error ? error.message : "Не удалось сохранить цену" });
    }
  });

  app.get("/api/partner/storefront/projects", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listPartnerStorefrontProjects(getAuthUser(request)!.partnerId!);
  });

  app.get("/api/partner/site", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return partnerSiteService.getByPartnerId(getAuthUser(request)!.partnerId!);
  });

  app.put("/api/partner/site", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    const parsed = updatePartnerSiteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }
    try {
      const payload: { config: typeof parsed.data.config; publish?: boolean } = {
        config: parsed.data.config
      };
      if (parsed.data.publish === true) {
        payload.publish = true;
      }
      return await partnerSiteService.updateSite(getAuthUser(request)!.partnerId!, payload);
    } catch (error) {
      return reply
        .status(400)
        .send({ message: error instanceof Error ? error.message : "Не удалось сохранить сайт" });
    }
  });

  app.post("/api/partner/site/publish", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    try {
      return await partnerSiteService.publish(getAuthUser(request)!.partnerId!);
    } catch (error) {
      return reply
        .status(400)
        .send({ message: error instanceof Error ? error.message : "Не удалось опубликовать сайт" });
    }
  });

  app.post("/api/partner/site/unpublish", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    try {
      return await partnerSiteService.unpublishByPartner(getAuthUser(request)!.partnerId!);
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось снять сайт с публикации"
      });
    }
  });

  app.post("/api/partner/site/republish-request", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    const parsed = z
      .object({ comment: z.string().max(1000).optional() })
      .safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }
    try {
      return await partnerSiteService.requestRepublish({
        partnerId: getAuthUser(request)!.partnerId!,
        comment: parsed.data.comment,
        actorUserId: getAuthUser(request)!.sub
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось отправить запрос"
      });
    }
  });

  app.post("/api/partner/site/notice-read", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return partnerSiteService.markPublishLockNoticeRead(getAuthUser(request)!.partnerId!);
  });

  app.get("/api/partner/storefront/projects/:key", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }

    const { key } = request.params as { key: string };
    const project = await portalService.getPartnerStorefrontProject(
      getAuthUser(request)!.partnerId!,
      key
    );
    if (!project) {
      return reply.status(404).send({ message: "Проект не найден" });
    }
    return project;
  });

  app.get("/api/partner/team", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    const user = getAuthUser(request)!;
    return portalService.listPartnerTeam(user.partnerId!);
  });

  app.post("/api/partner/team", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner"]);
    if (roleCheck) {
      return roleCheck;
    }
    const parsed = createTeamUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    return portalService.createPartnerTeamUser({
      actorUserId: getAuthUser(request)!.sub,
      partnerId: getAuthUser(request)!.partnerId!,
      ...parsed.data
    });
  });

  app.get("/api/partner/crm-connections", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listCrmConnections(getAuthUser(request)!.partnerId!);
  });

  app.post("/api/partner/crm-connections", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = createCrmConnectionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await portalService.createCrmConnection({
        actorUserId: getAuthUser(request)!.sub,
        partnerId: getAuthUser(request)!.partnerId!,
        ...parsed.data
      });
    } catch (error) {
      return reply.status(400).send({ message: error instanceof Error ? error.message : "CRM setup failed" });
    }
  });

  app.get("/api/partner/leads", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listPartnerLeads(getAuthUser(request)!.partnerId!);
  });

  app.post("/api/partner/leads", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    const parsed = createLeadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }
    const leadInput = {
      partnerId: getAuthUser(request)!.partnerId!,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone
    } as {
      partnerId: string;
      projectId?: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      message?: string;
    };

    if (parsed.data.projectId !== undefined) {
      leadInput.projectId = parsed.data.projectId;
    }
    if (parsed.data.customerEmail !== undefined) {
      leadInput.customerEmail = parsed.data.customerEmail;
    }
    if (parsed.data.message !== undefined) {
      leadInput.message = parsed.data.message;
    }

    return portalService.createLead(leadInput);
  });

  app.get("/api/partner/inquiries", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listInquiries(getAuthUser(request)!.partnerId!);
  });

  app.post("/api/partner/inquiries", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }

    const parsed = createInquirySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await portalService.createInquiry({
        actorUserId: getAuthUser(request)!.sub,
        partnerId: getAuthUser(request)!.partnerId!,
        subject: parsed.data.subject,
        message: parsed.data.message,
        ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {})
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось создать запрос"
      });
    }
  });

  app.get("/api/messenger/conversations", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    const query = request.query as { type?: string; q?: string; archived?: string };
    const type =
      query.type === "dm" || query.type === "request" || query.type === "channel"
        ? query.type
        : undefined;

    try {
      return await messengerService.listConversations(getAuthUser(request)!, {
        ...(type ? { type } : {}),
        ...(query.q ? { q: query.q } : {}),
        ...(query.archived === "1" || query.archived === "true" ? { archived: true } : {})
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось загрузить диалоги"
      });
    }
  });

  app.get("/api/messenger/conversations/:id", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    try {
      return await messengerService.getConversation(
        getAuthUser(request)!,
        (request.params as { id: string }).id
      );
    } catch (error) {
      return reply.status(404).send({
        message: error instanceof Error ? error.message : "Диалог не найден"
      });
    }
  });

  app.get("/api/messenger/conversations/:id/messages", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    const query = request.query as { before?: string; limit?: string };
    try {
      return await messengerService.listMessages(
        getAuthUser(request)!,
        (request.params as { id: string }).id,
        {
          ...(query.before ? { before: query.before } : {}),
          ...(query.limit ? { limit: Number(query.limit) } : {})
        }
      );
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось загрузить сообщения"
      });
    }
  });

  app.post("/api/messenger/conversations/:id/typing", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    try {
      return await messengerService.setTyping(
        getAuthUser(request)!,
        (request.params as { id: string }).id
      );
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось обновить статус печати"
      });
    }
  });

  app.post("/api/messenger/conversations/:id/archive", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    const body = (request.body ?? {}) as { archived?: boolean };
    try {
      return await messengerService.setArchive(
        getAuthUser(request)!,
        (request.params as { id: string }).id,
        body.archived !== false
      );
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось изменить архив"
      });
    }
  });

  app.post("/api/messenger/conversations/:id/pin", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    const parsed = messengerPinSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await messengerService.setPin(
        getAuthUser(request)!,
        (request.params as { id: string }).id,
        parsed.data.pinned
      );
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось закрепить диалог"
      });
    }
  });

  app.post("/api/messenger/conversations/:id/mute", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    const parsed = messengerMuteSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await messengerService.setMute(
        getAuthUser(request)!,
        (request.params as { id: string }).id,
        parsed.data.muted
      );
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось изменить звук диалога"
      });
    }
  });

  app.get("/api/messenger/archive-count", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;
    try {
      const count = await messengerService.archiveCount(getAuthUser(request)!);
      return { count };
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось получить архив"
      });
    }
  });

  app.get("/api/messenger/unread-count", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;
    try {
      return await messengerService.unreadTotal(getAuthUser(request)!);
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось получить непрочитанные"
      });
    }
  });

  app.post("/api/messenger/conversations/:id/messages", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    const parsed = messengerPostMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await messengerService.postMessage(
        getAuthUser(request)!,
        (request.params as { id: string }).id,
        {
          ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
          ...(parsed.data.attachments ? { attachments: parsed.data.attachments } : {})
        }
      );
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось отправить сообщение"
      });
    }
  });

  app.delete("/api/messenger/messages/:id", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    try {
      return await messengerService.deleteMessage(
        getAuthUser(request)!,
        (request.params as { id: string }).id
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось удалить сообщение";
      const status = message === "Сообщение не найдено" ? 404 : 400;
      return reply.status(status).send({ message });
    }
  });

  app.post("/api/messenger/requests", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    const parsed = messengerCreateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await messengerService.createRequest(getAuthUser(request)!, {
        title: parsed.data.title,
        body: parsed.data.body,
        ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {}),
        ...(parsed.data.partnerId ? { partnerId: parsed.data.partnerId } : {})
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось создать запрос"
      });
    }
  });

  app.post("/api/messenger/channels", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) return roleCheck;

    const parsed = messengerCreateChannelSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await messengerService.createChannel(getAuthUser(request)!, {
        title: parsed.data.title,
        description: parsed.data.description
      });
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось создать канал"
      });
    }
  });

  app.patch("/api/messenger/requests/:id", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    const parsed = messengerUpdateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }

    try {
      return await messengerService.updateRequestStatus(
        getAuthUser(request)!,
        (request.params as { id: string }).id,
        parsed.data.status
      );
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : "Не удалось обновить статус"
      });
    }
  });

  app.get("/api/messenger/attachments/:id", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, [
      "company_admin",
      "company_manager",
      "partner_owner",
      "partner_member"
    ]);
    if (roleCheck) return roleCheck;

    try {
      const file = await messengerService.getAttachmentFile(
        getAuthUser(request)!,
        (request.params as { id: string }).id
      );
      return reply
        .header("Content-Type", file.mimeType)
        .header("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
        .send(file.data);
    } catch (error) {
      return reply.status(404).send({
        message: error instanceof Error ? error.message : "Файл не найден"
      });
    }
  });

  return app;
}
