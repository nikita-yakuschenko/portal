import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const partnerApplicationStatusEnum = pgEnum("partner_application_status", [
  "new",
  "under_review",
  "approved",
  "rejected"
]);

export const partnerStatusEnum = pgEnum("partner_status", ["pending", "active", "suspended"]);
export const roleEnum = pgEnum("role", [
  "company_admin",
  "company_manager",
  "partner_owner",
  "partner_member"
]);
export const catalogSourceEnum = pgEnum("catalog_source", ["tilda"]);
export const crmProviderEnum = pgEnum("crm_provider", ["amocrm", "bitrix24"]);
export const leadTypeEnum = pgEnum("lead_type", [
  "project_view",
  "price_request",
  "contact_request",
  "crm_delivery_succeeded",
  "crm_delivery_failed"
]);
export const leadDeliveryStatusEnum = pgEnum("lead_delivery_status", ["pending", "sent", "failed"]);
export const inquiryStatusEnum = pgEnum("inquiry_status", ["new", "answered"]);
export const syncStatusEnum = pgEnum("sync_status", ["running", "completed", "failed"]);
export const partnerSiteStatusEnum = pgEnum("partner_site_status", ["draft", "published"]);

export const partnerApplications = pgTable(
  "partner_applications",
  {
    id: text("id").primaryKey(),
    inn: text("inn").notNull(),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    region: text("region").notNull(),
    interests: text("interests"),
    message: text("message"),
    passwordHash: text("password_hash"),
    status: partnerApplicationStatusEnum("status").notNull().default("new"),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
  },
  (table) => ({
    emailIdx: uniqueIndex("partner_applications_email_idx").on(table.email)
  })
);

export const partners = pgTable("partners", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  legalName: text("legal_name"),
  /** ИНН юрлица / ИП — для подвала сайта */
  inn: text("inn"),
  status: partnerStatusEnum("status").notNull().default("active"),
  region: text("region").notNull(),
  managerName: text("manager_name"),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  // Порядок проектов на витрине партнёра (без фильтров)
  catalogProjectOrder: jsonb("catalog_project_order").notNull().default([]),
  // Библиотека разделов/опций для подсказок при наполнении проектов
  extraOptionLibrary: jsonb("extra_option_library").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    partnerId: text("partner_id").references(() => partners.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    role: roleEnum("role").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email)
  })
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const catalogProjects = pgTable(
  "catalog_projects",
  {
    id: text("id").primaryKey(),
    source: catalogSourceEnum("source").notNull().default("tilda"),
    sourceUid: text("source_uid").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    technology: text("technology").notNull().default("modular"),
    details: jsonb("details").notNull().default({}),
    area: integer("area"),
    floors: integer("floors"),
    bedrooms: integer("bedrooms"),
    bathrooms: text("bathrooms"),
    basePrice: integer("base_price"),
    currency: text("currency").notNull().default("RUB"),
    projectUrl: text("project_url").notNull(),
    active: boolean("active").notNull().default(true),
    sourcePayload: jsonb("source_payload").notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sourceUidIdx: uniqueIndex("catalog_projects_source_uid_idx").on(table.source, table.sourceUid)
  })
);

export const catalogAssets = pgTable("catalog_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => catalogProjects.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  localPath: text("local_path").notNull().default(""),
  type: text("type").notNull(),
  // Для type=floor_plan при floors>1: номер этажа планировки
  floorNumber: integer("floor_number"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false)
});

export const catalogSyncRuns = pgTable("catalog_sync_runs", {
  id: text("id").primaryKey(),
  status: syncStatusEnum("status").notNull(),
  createdCount: integer("created_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  assetsDiscovered: integer("assets_discovered").notNull().default(0),
  errors: jsonb("errors").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true })
});

export const crmConnections = pgTable("crm_connections", {
  id: text("id").primaryKey(),
  partnerId: text("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  provider: crmProviderEnum("provider").notNull(),
  portalUrl: text("portal_url").notNull(),
  credentials: jsonb("credentials").notNull().default({}),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const leadEvents = pgTable("lead_events", {
  id: text("id").primaryKey(),
  partnerId: text("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => catalogProjects.id, { onDelete: "set null" }),
  type: leadTypeEnum("type").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  message: text("message"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const leadDeliveries = pgTable("lead_deliveries", {
  id: text("id").primaryKey(),
  leadEventId: text("lead_event_id")
    .notNull()
    .references(() => leadEvents.id, { onDelete: "cascade" }),
  crmConnectionId: text("crm_connection_id")
    .notNull()
    .references(() => crmConnections.id, { onDelete: "cascade" }),
  status: leadDeliveryStatusEnum("status").notNull(),
  externalLeadId: text("external_lead_id"),
  errorMessage: text("error_message"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true })
});

export const partnerInquiries = pgTable("partner_inquiries", {
  id: text("id").primaryKey(),
  partnerId: text("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: inquiryStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

/** Розничные цены и допы дилера поверх заводского каталога */
export const partnerProjectPrices = pgTable(
  "partner_project_prices",
  {
    id: text("id").primaryKey(),
    partnerId: text("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => catalogProjects.id, { onDelete: "cascade" }),
    pricingMode: text("pricing_mode").notNull().default("on_request"),
    markupPercent: integer("markup_percent"),
    publicPrice: integer("public_price"),
    priceOnRequest: boolean("price_on_request").notNull().default(true),
    isPublished: boolean("is_published").notNull().default(false),
    extras: jsonb("extras").notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    partnerProjectIdx: uniqueIndex("partner_project_prices_partner_project_idx").on(
      table.partnerId,
      table.projectId
    )
  })
);

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

/** Публичный сайт партнёра: домен + JSON-конфиг витрины */
export const partnerSites = pgTable(
  "partner_sites",
  {
    id: text("id").primaryKey(),
    partnerId: text("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    subdomain: text("subdomain").notNull(),
    domain: text("domain"),
    status: partnerSiteStatusEnum("status").notNull().default("draft"),
    config: jsonb("config").notNull().default({}),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    partnerIdx: uniqueIndex("partner_sites_partner_id_idx").on(table.partnerId),
    subdomainIdx: uniqueIndex("partner_sites_subdomain_idx").on(table.subdomain),
    domainIdx: uniqueIndex("partner_sites_domain_idx").on(table.domain)
  })
);
