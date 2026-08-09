import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
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
/**
 * Судьба заявки на пути в CRM.
 * skipped — CRM не подключена, передавать некуда; pending — подключена и
 * заявка ждёт отправки; sent/failed — итог попытки.
 */
export const crmDeliveryStatusEnum = pgEnum("crm_delivery_status", [
  "skipped",
  "pending",
  "sent",
  "failed"
]);
/** Воронка дилера по заявке — намеренно короткая */
export const siteRequestStatusEnum = pgEnum("site_request_status", [
  "new",
  "in_progress",
  "won",
  "lost"
]);
export const inquiryStatusEnum = pgEnum("inquiry_status", ["new", "answered"]);
export const syncStatusEnum = pgEnum("sync_status", ["running", "completed", "failed"]);
export const partnerSiteStatusEnum = pgEnum("partner_site_status", ["draft", "published"]);
export const messengerConversationTypeEnum = pgEnum("messenger_conversation_type", [
  "dm",
  "request",
  "channel"
]);
export const messengerRequestStatusEnum = pgEnum("messenger_request_status", [
  "open",
  "in_progress",
  "closed"
]);

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
    // Предложение завода дилеру: сборка + допы (из Excel), отдельно от допов дилера
    factoryOffer: jsonb("factory_offer").notNull().default({}),
    currency: text("currency").notNull().default("RUB"),
    projectUrl: text("project_url").notNull(),
    active: boolean("active").notNull().default(true),
    // Ручные правки HQ: поля с true не перезаписываются синком Tilda
    syncOverrides: jsonb("sync_overrides").notNull().default({}),
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

export const catalogProjectRooms = pgTable(
  "catalog_project_rooms",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => catalogProjects.id, { onDelete: "cascade" }),
    // Для одноэтажных домов всегда 1 — см. FloorPlanExplication
    floorNumber: integer("floor_number").notNull().default(1),
    name: text("name").notNull(),
    area: real("area").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    // Контур помещения на схеме этажа: точки в относительных координатах 0..100 (% от картинки)
    polygon: jsonb("polygon").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    projectFloorIdx: index("catalog_project_rooms_project_floor_idx").on(
      table.projectId,
      table.floorNumber
    )
  })
);

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

/**
 * Заявка с сайта партнёра: одна строка на отправленную форму.
 * Статус передачи в CRM держим здесь же — отдельная таблица доставок
 * добавляла join ради одного поля.
 */
export const siteRequests = pgTable("site_requests", {
  id: text("id").primaryKey(),
  partnerId: text("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => catalogProjects.id, { onDelete: "set null" }),
  /** Какая форма сработала: «Консультация», «Расчёт стоимости» и т.п. */
  formName: text("form_name").notNull().default("Форма на сайте"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  message: text("message"),
  /** utm_source и прочие метки рекламы — только если пришли с адресом страницы */
  utm: jsonb("utm").notNull().default({}),
  pageUrl: text("page_url"),
  status: siteRequestStatusEnum("status").notNull().default("new"),
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  /** Заметка менеджера: о чём договорились */
  note: text("note"),
  crmStatus: crmDeliveryStatusEnum("crm_status").notNull().default("skipped"),
  crmError: text("crm_error"),
  crmSentAt: timestamp("crm_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
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
    // Ключи заводских опций (нормализованное name), включённых дилером в базу для наценки
    factorySelectedOptions: jsonb("factory_selected_options").notNull().default([]),
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
    /** Черновик кабинета: правки партнёра, публике не видны */
    config: jsonb("config").notNull().default({}),
    /**
     * Живая версия сайта. Отделена от черновика, иначе сохранение в кабинете
     * немедленно меняет то, что видят покупатели. null — сайт ещё не публиковался.
     */
    publishedConfig: jsonb("published_config"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // HQ снял с публикации — партнёр не может опубликовать без одобрения/разблокировки
    publishLocked: boolean("publish_locked").notNull().default(false),
    publishLockedAt: timestamp("publish_locked_at", { withTimezone: true }),
    publishLockedByUserId: text("publish_locked_by_user_id"),
    publishLockNotice: text("publish_lock_notice"),
    publishLockNoticeReadAt: timestamp("publish_lock_notice_read_at", { withTimezone: true }),
    republishRequestStatus: text("republish_request_status"),
    republishRequestedAt: timestamp("republish_requested_at", { withTimezone: true }),
    republishRequestComment: text("republish_request_comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    partnerIdx: uniqueIndex("partner_sites_partner_id_idx").on(table.partnerId),
    subdomainIdx: uniqueIndex("partner_sites_subdomain_idx").on(table.subdomain),
    domainIdx: uniqueIndex("partner_sites_domain_idx").on(table.domain)
  })
);

/** Мессенджер: чат (dm), тикет-запрос, канал */
export const messengerConversations = pgTable(
  "messenger_conversations",
  {
    id: text("id").primaryKey(),
    type: messengerConversationTypeEnum("type").notNull(),
    partnerId: text("partner_id").references(() => partners.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    description: text("description"),
    requestNumber: text("request_number"),
    projectId: text("project_id").references(() => catalogProjects.id, { onDelete: "set null" }),
    status: messengerRequestStatusEnum("status"),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    partnerTypeIdx: index("messenger_conversations_partner_type_idx").on(table.partnerId, table.type),
    requestNumberIdx: uniqueIndex("messenger_conversations_request_number_idx").on(table.requestNumber),
    lastMessageIdx: index("messenger_conversations_last_message_idx").on(table.lastMessageAt)
  })
);

export const messengerMessages = pgTable(
  "messenger_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => messengerConversations.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    conversationCreatedIdx: index("messenger_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt
    )
  })
);

export const messengerAttachments = pgTable("messenger_attachments", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => messengerMessages.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  storageKey: text("storage_key").notNull()
});

export const messengerReads = pgTable(
  "messenger_reads",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => messengerConversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    conversationUserIdx: uniqueIndex("messenger_reads_conversation_user_idx").on(
      table.conversationId,
      table.userId
    )
  })
);

/** Архив диалога — персонально для пользователя */
export const messengerArchives = pgTable(
  "messenger_archives",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => messengerConversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    conversationUserIdx: uniqueIndex("messenger_archives_conversation_user_idx").on(
      table.conversationId,
      table.userId
    )
  })
);

/** Отключённый звук диалога — персонально для пользователя */
export const messengerMutes = pgTable(
  "messenger_mutes",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => messengerConversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mutedAt: timestamp("muted_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    conversationUserIdx: uniqueIndex("messenger_mutes_conversation_user_idx").on(
      table.conversationId,
      table.userId
    )
  })
);

/** Просмотры публикации в канале — по одному на пользователя */
export const messengerMessageViews = pgTable(
  "messenger_message_views",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => messengerMessages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    messageUserIdx: uniqueIndex("messenger_message_views_message_user_idx").on(
      table.messageId,
      table.userId
    )
  })
);

/** Закрепление диалога — персонально для пользователя */
export const messengerPins = pgTable(
  "messenger_pins",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => messengerConversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    conversationUserIdx: uniqueIndex("messenger_pins_conversation_user_idx").on(
      table.conversationId,
      table.userId
    )
  })
);

/** In-app inbox: адресат — user_id; бизнес-состояние (lock) живёт отдельно на partner_sites */
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    audience: text("audience").notNull(),
    partnerId: text("partner_id").references(() => partners.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    payload: jsonb("payload").notNull().default({}),
    actionUrl: text("action_url"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userCreatedIdx: index("notifications_user_created_idx").on(table.userId, table.createdAt)
  })
);

/**
 * Снимок публичного профиля соцсети. Одна строка на (платформа, username) —
 * общая для всех партнёров, ссылающихся на один и тот же канал.
 * Хранится только удачно полученный snapshot; неудачная попытка обновляет
 * поля last_attempt_* и оставляет прежние данные для отдачи как stale.
 */
export const socialProfileSnapshots = pgTable(
  "social_profile_snapshots",
  {
    id: text("id").primaryKey(),
    platform: text("platform").notNull(),
    /** Нормализованный username в нижнем регистре — часть ключа кэша */
    username: text("username").notNull(),
    profileUrl: text("profile_url").notNull(),
    source: text("source").notNull(),
    payload: jsonb("payload").notNull().default({}),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Последняя попытка обновления — в том числе неудачная */
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastAttemptStatus: text("last_attempt_status"),
    lastErrorClass: text("last_error_class"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    platformUsernameIdx: uniqueIndex("social_profile_snapshots_platform_username_idx").on(
      table.platform,
      table.username
    )
  })
);
