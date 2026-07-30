import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import Fastify from "fastify";
import { z } from "zod";

import { config } from "./config.js";
import { StoreTildaClient, verifyOfficialTildaKeys } from "./modules/catalog/tilda-client.js";
import { hashResetToken } from "./modules/auth/passwords.js";
import { PortalService } from "./modules/portal/portal-service.js";

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
  message: z.string().min(2)
});

const createLeadSchema = z.object({
  projectId: z.string().optional(),
  customerName: z.string().min(2),
  customerPhone: z.string().min(5),
  customerEmail: z.email().optional(),
  message: z.string().optional()
});

const passwordResetRequestSchema = z.object({
  email: z.email()
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
  const app = Fastify({ logger: true });
  const portalService = new PortalService(new StoreTildaClient());

  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: {
      cookieName: "b2b_session",
      signed: false
    }
  });

  await portalService.ensureCompanyAdmin({
    email: config.adminEmail,
    password: config.adminPassword,
    fullName: config.adminFullName
  });

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

    reply.setCookie("b2b_session", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax"
    });

    return { user };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie("b2b_session", { path: "/" });
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

  app.get("/api/company/partners", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["company_admin", "company_manager"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listPartners();
  });

  app.get("/api/partner/me", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.getMe(getAuthUser(request)!.sub);
  });

  app.get("/api/partner/catalog/projects", async (request, reply) => {
    const roleCheck = await requireRoles(request, reply, ["partner_owner", "partner_member"]);
    if (roleCheck) {
      return roleCheck;
    }
    return portalService.listCatalogProjects();
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

    return portalService.createInquiry({
      actorUserId: getAuthUser(request)!.sub,
      partnerId: getAuthUser(request)!.partnerId!,
      ...parsed.data
    });
  });

  return app;
}
