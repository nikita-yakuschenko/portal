import { randomUUID } from "node:crypto";

import { and, desc, eq, gt, isNull, lt, ne, or, sql, inArray } from "drizzle-orm";

import { db } from "../../db/client.js";
import { config } from "../../config.js";
import {
  catalogProjects,
  messengerAttachments,
  messengerArchives,
  messengerConversations,
  messengerMessages,
  messengerMessageViews,
  messengerMutes,
  messengerPins,
  messengerReads,
  partners,
  partnerSites,
  users
} from "../../db/schema.js";
import {
  assertObjectExists,
  createApiSignedDownloadPath,
  createSignedGetUrl,
  deleteObject,
  openObjectStream,
  UPLOAD_LIMITS
} from "../../lib/object-storage.js";

const NEWS_CHANNEL_TITLE = "Новости и анонсы";
const MAX_ATTACHMENTS_PER_MESSAGE = UPLOAD_LIMITS.messenger.maxFiles;
const TYPING_TTL_MS = 4000;

type TypingEntry = { userId: string; fullName: string; until: number };

/** Эфемерный presence «печатает» (без WS) */
const typingByConversation = new Map<string, Map<string, TypingEntry>>();

type Actor = {
  sub: string;
  partnerId: string | null;
  role: "company_admin" | "company_manager" | "partner_owner" | "partner_member" | "dealer_guest";
  fullName: string;
};

type AttachmentInput = {
  fileName: string;
  mimeType: string;
  byteSize: number;
  storageKey: string;
};

function isCompany(actor: Actor) {
  return actor.role === "company_admin" || actor.role === "company_manager";
}

function previewText(body: string) {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

function partnerAvatarFromSiteConfig(config: unknown): string | null {
  if (!config || typeof config !== "object") return null;
  const row = config as Record<string, unknown>;
  const mobile = typeof row.logoMobileDataUrl === "string" ? row.logoMobileDataUrl.trim() : "";
  const full = typeof row.logoDataUrl === "string" ? row.logoDataUrl.trim() : "";
  return mobile || full || null;
}

type LastMessagePreview = {
  kind: "text" | "image" | "video" | "media" | "document";
  text: string;
  /** Для миниатюры в списке чатов (только image) */
  attachmentId?: string | null;
};

function attachmentPreviewKind(
  mimeType: string
): "image" | "video" | "media" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "media";
  return "document";
}

const ATTACHMENT_PREVIEW_LABEL: Record<
  "image" | "video" | "media" | "document",
  string
> = {
  image: "Изображение",
  video: "Видео",
  media: "Медиафайл",
  document: "Документ"
};

function mapConversation(
  row: typeof messengerConversations.$inferSelect,
  extra: {
    partnerName?: string | null;
    partnerRegion?: string | null;
    projectName?: string | null;
    partnerAvatarUrl?: string | null;
    lastMessagePreview?: LastMessagePreview | null;
    unreadCount?: number;
    pinned?: boolean;
    muted?: boolean;
  } = {}
) {
  const unreadCount = Math.max(0, extra.unreadCount ?? 0);
  return {
    id: row.id,
    type: row.type,
    partnerId: row.partnerId,
    partnerName: extra.partnerName ?? null,
    partnerRegion: extra.partnerRegion ?? null,
    partnerAvatarUrl: extra.partnerAvatarUrl ?? null,
    title: row.title,
    description: row.description ?? null,
    requestNumber: row.requestNumber,
    projectId: row.projectId,
    projectName: extra.projectName ?? null,
    status: row.status,
    createdByUserId: row.createdByUserId,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    lastMessagePreview: extra.lastMessagePreview ?? null,
    unread: unreadCount > 0,
    unreadCount,
    pinned: Boolean(extra.pinned),
    muted: Boolean(extra.muted),
    createdAt: row.createdAt.toISOString()
  };
}

export class MessengerService {
  async ensureBootstrap() {
    const [channel] = await db
      .select()
      .from(messengerConversations)
      .where(and(eq(messengerConversations.type, "channel"), eq(messengerConversations.title, NEWS_CHANNEL_TITLE)))
      .limit(1);

    if (!channel) {
      await db.insert(messengerConversations).values({
        id: randomUUID(),
        type: "channel",
        partnerId: null,
        title: NEWS_CHANNEL_TITLE,
        requestNumber: null,
        projectId: null,
        status: null,
        createdByUserId: null,
        lastMessageAt: null
      });
    }

    const allPartners = await db.select({ id: partners.id }).from(partners);
    for (const partner of allPartners) {
      await this.ensureDm(partner.id);
    }
  }

  async ensureDm(partnerId: string, createdByUserId?: string | null) {
    const [existing] = await db
      .select()
      .from(messengerConversations)
      .where(and(eq(messengerConversations.type, "dm"), eq(messengerConversations.partnerId, partnerId)))
      .limit(1);

    if (existing) return existing;

    const id = randomUUID();
    const [partner] = await db
      .select({ companyName: partners.companyName })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);

    await db.insert(messengerConversations).values({
      id,
      type: "dm",
      partnerId,
      title: partner?.companyName ? `Чат: ${partner.companyName}` : "Чат с заводом",
      requestNumber: null,
      projectId: null,
      status: null,
      createdByUserId: createdByUserId ?? null,
      lastMessageAt: null
    });

    const [created] = await db
      .select()
      .from(messengerConversations)
      .where(eq(messengerConversations.id, id))
      .limit(1);
    return created!;
  }

  private async assertCanAccess(actor: Actor, conversation: typeof messengerConversations.$inferSelect) {
    if (isCompany(actor)) return;

    if (!actor.partnerId) {
      throw new Error("Forbidden");
    }

    if (conversation.type === "channel") return;

    if (conversation.partnerId !== actor.partnerId) {
      throw new Error("Forbidden");
    }
  }

  private async assertCanWrite(actor: Actor, conversation: typeof messengerConversations.$inferSelect) {
    await this.assertCanAccess(actor, conversation);
    if (conversation.type === "channel" && !isCompany(actor)) {
      throw new Error("В канал могут писать только сотрудники завода");
    }
    if (conversation.type === "request" && conversation.status === "closed") {
      throw new Error("Обращение закрыто");
    }
  }

  async listConversations(
    actor: Actor,
    filters?: { type?: "dm" | "request" | "channel"; q?: string; archived?: boolean }
  ) {
    if (actor.partnerId) {
      await this.ensureDm(actor.partnerId, actor.sub);
    }

    const archivedRows = await db
      .select({ conversationId: messengerArchives.conversationId })
      .from(messengerArchives)
      .where(eq(messengerArchives.userId, actor.sub));
    const archivedIds = new Set(archivedRows.map((r) => r.conversationId));

    const conditions = [];
    if (isCompany(actor)) {
      if (filters?.type) conditions.push(eq(messengerConversations.type, filters.type));
    } else {
      conditions.push(
        or(
          eq(messengerConversations.type, "channel"),
          eq(messengerConversations.partnerId, actor.partnerId!)
        )!
      );
      if (filters?.type) conditions.push(eq(messengerConversations.type, filters.type));
    }

    const rows = await db
      .select({
        conversation: messengerConversations,
        partnerName: partners.companyName,
        partnerRegion: partners.region,
        projectName: catalogProjects.name,
        siteConfig: partnerSites.config
      })
      .from(messengerConversations)
      .leftJoin(partners, eq(messengerConversations.partnerId, partners.id))
      .leftJoin(partnerSites, eq(partnerSites.partnerId, messengerConversations.partnerId))
      .leftJoin(catalogProjects, eq(messengerConversations.projectId, catalogProjects.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sql`coalesce(${messengerConversations.lastMessageAt}, ${messengerConversations.createdAt})`));

    const wantArchived = Boolean(filters?.archived);
    const scoped = rows.filter(({ conversation }) =>
      wantArchived ? archivedIds.has(conversation.id) : !archivedIds.has(conversation.id)
    );

    const reads = await db
      .select()
      .from(messengerReads)
      .where(eq(messengerReads.userId, actor.sub));
    const readMap = new Map(reads.map((r) => [r.conversationId, r.lastReadAt]));

    const conversationIds = scoped.map((r) => r.conversation.id);
    const unreadCountMap = new Map<string, number>();
    const previewMap = new Map<string, LastMessagePreview | null>();
    const pinnedIds = new Set<string>();
    const mutedIds = new Set<string>();

    if (conversationIds.length > 0) {
      const pinRows = await db
        .select({ conversationId: messengerPins.conversationId })
        .from(messengerPins)
        .where(
          and(eq(messengerPins.userId, actor.sub), inArray(messengerPins.conversationId, conversationIds))
        );
      for (const pin of pinRows) pinnedIds.add(pin.conversationId);

      const muteRows = await db
        .select({ conversationId: messengerMutes.conversationId })
        .from(messengerMutes)
        .where(
          and(eq(messengerMutes.userId, actor.sub), inArray(messengerMutes.conversationId, conversationIds))
        );
      for (const mute of muteRows) mutedIds.add(mute.conversationId);

      // Доставлено уже при опросе списка (страница мессенджера открыта)
      await db
        .update(messengerMessages)
        .set({ deliveredAt: new Date() })
        .where(
          and(
            inArray(messengerMessages.conversationId, conversationIds),
            ne(messengerMessages.authorUserId, actor.sub),
            isNull(messengerMessages.deliveredAt)
          )
        );

      const lastPreviews = await Promise.all(
        conversationIds.map(async (id) => {
          const [last] = await db
            .select({ id: messengerMessages.id, body: messengerMessages.body })
            .from(messengerMessages)
            .where(eq(messengerMessages.conversationId, id))
            .orderBy(desc(messengerMessages.createdAt))
            .limit(1);

          if (!last) return [id, null] as const;

          const text = previewText(last.body);
          if (text) {
            return [id, { kind: "text" as const, text }] as const;
          }

          const [att] = await db
            .select({
              id: messengerAttachments.id,
              mimeType: messengerAttachments.mimeType
            })
            .from(messengerAttachments)
            .where(eq(messengerAttachments.messageId, last.id))
            .limit(1);

          if (!att) return [id, null] as const;

          const kind = attachmentPreviewKind(att.mimeType);
          return [
            id,
            {
              kind,
              text: ATTACHMENT_PREVIEW_LABEL[kind],
              attachmentId: kind === "image" ? att.id : null
            }
          ] as const;
        })
      );
      for (const [id, preview] of lastPreviews) {
        previewMap.set(id, preview);
      }

      await Promise.all(
        conversationIds.map(async (id) => {
          const lastRead = readMap.get(id);
          const conditions = [
            eq(messengerMessages.conversationId, id),
            ne(messengerMessages.authorUserId, actor.sub)
          ];
          if (lastRead) {
            conditions.push(gt(messengerMessages.createdAt, lastRead));
          }
          const [countRow] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(messengerMessages)
            .where(and(...conditions));
          unreadCountMap.set(id, countRow?.count ?? 0);
        })
      );
    }

    const q = filters?.q?.trim().toLowerCase();
    const mapped = scoped.map(({ conversation, partnerName, partnerRegion, projectName, siteConfig }) => {
      return mapConversation(conversation, {
        partnerName,
        partnerRegion,
        projectName,
        partnerAvatarUrl: partnerAvatarFromSiteConfig(siteConfig),
        lastMessagePreview: previewMap.get(conversation.id) ?? null,
        unreadCount: unreadCountMap.get(conversation.id) ?? 0,
        pinned: pinnedIds.has(conversation.id),
        muted: mutedIds.has(conversation.id)
      });
    });

    mapped.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const at = a.lastMessageAt ?? a.createdAt;
      const bt = b.lastMessageAt ?? b.createdAt;
      return bt.localeCompare(at);
    });

    if (!q) return mapped;

    return mapped.filter((item) => {
      const hay = [
        item.title,
        item.requestNumber,
        item.partnerName,
        item.partnerRegion,
        item.projectName,
        item.lastMessagePreview?.text
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  async getConversation(actor: Actor, conversationId: string) {
    const [row] = await db
      .select({
        conversation: messengerConversations,
        partnerName: partners.companyName,
        partnerRegion: partners.region,
        projectName: catalogProjects.name,
        siteConfig: partnerSites.config
      })
      .from(messengerConversations)
      .leftJoin(partners, eq(messengerConversations.partnerId, partners.id))
      .leftJoin(partnerSites, eq(partnerSites.partnerId, messengerConversations.partnerId))
      .leftJoin(catalogProjects, eq(messengerConversations.projectId, catalogProjects.id))
      .where(eq(messengerConversations.id, conversationId))
      .limit(1);

    if (!row) throw new Error("Диалог не найден");
    await this.assertCanAccess(actor, row.conversation);
    return mapConversation(row.conversation, {
      partnerName: row.partnerName,
      partnerRegion: row.partnerRegion,
      projectName: row.projectName,
      partnerAvatarUrl: partnerAvatarFromSiteConfig(row.siteConfig)
    });
  }

  async listMessages(actor: Actor, conversationId: string, opts?: { before?: string; limit?: number }) {
    const conversation = await this.requireConversation(conversationId);
    await this.assertCanAccess(actor, conversation);

    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const conditions = [eq(messengerMessages.conversationId, conversationId)];
    if (opts?.before) {
      conditions.push(lt(messengerMessages.createdAt, new Date(opts.before)));
    }

    // Доставлено: собеседник открыл/поллит тред — помечаем чужие недоставленные
    await db
      .update(messengerMessages)
      .set({ deliveredAt: new Date() })
      .where(
        and(
          eq(messengerMessages.conversationId, conversationId),
          ne(messengerMessages.authorUserId, actor.sub),
          isNull(messengerMessages.deliveredAt)
        )
      );

    const rows = await db
      .select({
        message: messengerMessages,
        authorName: users.fullName,
        authorRole: users.role
      })
      .from(messengerMessages)
      .innerJoin(users, eq(messengerMessages.authorUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(messengerMessages.createdAt))
      .limit(limit);

    const messageIds = rows.map((r) => r.message.id);
    const attachments =
      messageIds.length === 0
        ? []
        : await db
            .select()
            .from(messengerAttachments)
            .where(inArray(messengerAttachments.messageId, messageIds));

    const byMessage = new Map<string, typeof attachments>();
    for (const att of attachments) {
      const list = byMessage.get(att.messageId) ?? [];
      list.push(att);
      byMessage.set(att.messageId, list);
    }

    const counterpartReadAt = await this.counterpartMaxReadAt(actor, conversation);
    const previousReadAt = await this.markRead(actor.sub, conversationId);

    const viewCounts =
      conversation.type === "channel"
        ? await this.trackChannelViews(
            actor,
            rows.map((r) => r.message),
            previousReadAt
          )
        : null;

    const messages = rows
      .map(({ message, authorName, authorRole }) => {
        const mine = message.authorUserId === actor.sub;
        let receipt: "sent" | "delivered" | "read" | null = null;
        if (mine) {
          if (counterpartReadAt && counterpartReadAt >= message.createdAt) {
            receipt = "read";
          } else if (message.deliveredAt) {
            receipt = "delivered";
          } else {
            receipt = "sent";
          }
        }
        return {
          id: message.id,
          conversationId: message.conversationId,
          authorUserId: message.authorUserId,
          authorName,
          authorRole,
          body: message.body,
          createdAt: message.createdAt.toISOString(),
          deliveredAt: message.deliveredAt?.toISOString() ?? null,
          receipt,
          viewCount: viewCounts ? (viewCounts.get(message.id) ?? 0) : null,
          attachments: (byMessage.get(message.id) ?? []).map((att) => ({
            id: att.id,
            fileName: att.fileName,
            mimeType: att.mimeType,
            byteSize: att.byteSize
          }))
        };
      })
      .reverse();

    return {
      messages,
      typing: conversation.type === "channel" ? [] : this.listTyping(conversationId, actor.sub)
    };
  }

  /** Просмотры публикаций канала: фиксируем чужие, счётчик отдаём админу портала */
  private async trackChannelViews(
    actor: Actor,
    messages: Array<typeof messengerMessages.$inferSelect>,
    previousReadAt: Date | null
  ): Promise<Map<string, number> | null> {
    if (messages.length === 0) return null;

    // Пишем только то, что пользователь видит впервые — иначе поллинг долбит БД
    const fresh = messages.filter(
      (m) =>
        m.authorUserId !== actor.sub &&
        (!previousReadAt || m.createdAt > previousReadAt)
    );
    if (fresh.length > 0) {
      await db
        .insert(messengerMessageViews)
        .values(
          fresh.map((m) => ({
            id: randomUUID(),
            messageId: m.id,
            userId: actor.sub
          }))
        )
        .onConflictDoNothing();
    }

    if (actor.role !== "company_admin") return null;

    const rows = await db
      .select({
        messageId: messengerMessageViews.messageId,
        views: sql<number>`count(*)::int`
      })
      .from(messengerMessageViews)
      .where(
        inArray(
          messengerMessageViews.messageId,
          messages.map((m) => m.id)
        )
      )
      .groupBy(messengerMessageViews.messageId);

    return new Map(rows.map((row) => [row.messageId, Number(row.views)]));
  }

  async setTyping(actor: Actor, conversationId: string) {
    const conversation = await this.requireConversation(conversationId);
    await this.assertCanWrite(actor, conversation);
    if (conversation.type === "channel") {
      return { ok: true as const, typing: [] as Array<{ userId: string; fullName: string }> };
    }
    const bucket = typingByConversation.get(conversationId) ?? new Map<string, TypingEntry>();
    bucket.set(actor.sub, {
      userId: actor.sub,
      fullName: actor.fullName,
      until: Date.now() + TYPING_TTL_MS
    });
    typingByConversation.set(conversationId, bucket);
    return { ok: true as const, typing: this.listTyping(conversationId, actor.sub) };
  }

  private listTyping(conversationId: string, excludeUserId: string) {
    const bucket = typingByConversation.get(conversationId);
    if (!bucket) return [] as Array<{ userId: string; fullName: string }>;
    const now = Date.now();
    const alive: Array<{ userId: string; fullName: string }> = [];
    for (const [userId, entry] of bucket) {
      if (entry.until < now) {
        bucket.delete(userId);
        continue;
      }
      if (userId === excludeUserId) continue;
      alive.push({ userId: entry.userId, fullName: entry.fullName });
    }
    if (bucket.size === 0) typingByConversation.delete(conversationId);
    return alive;
  }

  private clearTyping(userId: string, conversationId: string) {
    const bucket = typingByConversation.get(conversationId);
    if (!bucket) return;
    bucket.delete(userId);
    if (bucket.size === 0) typingByConversation.delete(conversationId);
  }

  /** Макс. lastReadAt у «другой стороны» диалога — для галочек прочитано */
  private async counterpartMaxReadAt(
    actor: Actor,
    conversation: typeof messengerConversations.$inferSelect
  ): Promise<Date | null> {
    if (conversation.type === "channel") {
      // Для канала: прочитано, если хотя бы один партнёр открыл
      if (!isCompany(actor)) return null;
      const [row] = await db
        .select({ maxRead: sql<Date | null>`max(${messengerReads.lastReadAt})` })
        .from(messengerReads)
        .innerJoin(users, eq(messengerReads.userId, users.id))
        .where(
          and(
            eq(messengerReads.conversationId, conversation.id),
            sql`${users.partnerId} is not null`
          )
        );
      return row?.maxRead ? new Date(row.maxRead) : null;
    }

    if (!conversation.partnerId) return null;

    if (isCompany(actor)) {
      const [row] = await db
        .select({ maxRead: sql<Date | null>`max(${messengerReads.lastReadAt})` })
        .from(messengerReads)
        .innerJoin(users, eq(messengerReads.userId, users.id))
        .where(
          and(
            eq(messengerReads.conversationId, conversation.id),
            eq(users.partnerId, conversation.partnerId)
          )
        );
      return row?.maxRead ? new Date(row.maxRead) : null;
    }

    const [row] = await db
      .select({ maxRead: sql<Date | null>`max(${messengerReads.lastReadAt})` })
      .from(messengerReads)
      .innerJoin(users, eq(messengerReads.userId, users.id))
      .where(
        and(
          eq(messengerReads.conversationId, conversation.id),
          isNull(users.partnerId)
        )
      );
    return row?.maxRead ? new Date(row.maxRead) : null;
  }

  async postMessage(
    actor: Actor,
    conversationId: string,
    input: { body?: string; attachments?: AttachmentInput[] }
  ) {
    const conversation = await this.requireConversation(conversationId);
    await this.assertCanWrite(actor, conversation);

    const body = (input.body ?? "").trim();
    const attachments = input.attachments ?? [];
    if (!body && attachments.length === 0) {
      throw new Error("Пустое сообщение");
    }
    if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new Error(`Не больше ${MAX_ATTACHMENTS_PER_MESSAGE} вложений в одном сообщении`);
    }

    const messageId = randomUUID();
    const now = new Date();

    await db.insert(messengerMessages).values({
      id: messageId,
      conversationId,
      authorUserId: actor.sub,
      body,
      createdAt: now
    });

    const savedAttachments = [];
    for (const file of attachments) {
      savedAttachments.push(await this.saveAttachment(messageId, file));
    }

    await db
      .update(messengerConversations)
      .set({ lastMessageAt: now })
      .where(eq(messengerConversations.id, conversationId));

    await this.markRead(actor.sub, conversationId);
    this.clearTyping(actor.sub, conversationId);

    return {
      id: messageId,
      conversationId,
      authorUserId: actor.sub,
      authorName: actor.fullName,
      authorRole: actor.role,
      body,
      createdAt: now.toISOString(),
      deliveredAt: null,
      receipt: "sent" as const,
      attachments: savedAttachments
    };
  }

  async deleteMessage(actor: Actor, messageId: string) {
    const [message] = await db
      .select()
      .from(messengerMessages)
      .where(eq(messengerMessages.id, messageId))
      .limit(1);
    if (!message) throw new Error("Сообщение не найдено");
    if (message.authorUserId !== actor.sub) {
      throw new Error("Можно удалить только своё сообщение");
    }

    const conversation = await this.requireConversation(message.conversationId);
    await this.assertCanAccess(actor, conversation);

    const files = await db
      .select()
      .from(messengerAttachments)
      .where(eq(messengerAttachments.messageId, messageId));

    for (const file of files) {
      await deleteObject(file.storageKey);
    }

    await db.delete(messengerMessages).where(eq(messengerMessages.id, messageId));

    const [last] = await db
      .select({ createdAt: messengerMessages.createdAt })
      .from(messengerMessages)
      .where(eq(messengerMessages.conversationId, message.conversationId))
      .orderBy(desc(messengerMessages.createdAt))
      .limit(1);

    await db
      .update(messengerConversations)
      .set({ lastMessageAt: last?.createdAt ?? conversation.createdAt })
      .where(eq(messengerConversations.id, message.conversationId));

    return { ok: true as const, conversationId: message.conversationId };
  }

  async createChannel(actor: Actor, input: { title: string; description: string }) {
    if (!isCompany(actor)) {
      throw new Error("Каналы создаёт завод");
    }

    const title = input.title.trim().replace(/\s+/g, " ");
    const description = input.description.trim().replace(/\s+/g, " ");
    if (title.length < 2) {
      throw new Error("Укажите название канала");
    }
    if (description.length < 2) {
      throw new Error("Укажите описание канала");
    }

    const [existing] = await db
      .select({ id: messengerConversations.id })
      .from(messengerConversations)
      .where(and(eq(messengerConversations.type, "channel"), eq(messengerConversations.title, title)))
      .limit(1);
    if (existing) {
      throw new Error("Канал с таким названием уже есть");
    }

    const conversationId = randomUUID();
    const now = new Date();
    await db.insert(messengerConversations).values({
      id: conversationId,
      type: "channel",
      partnerId: null,
      title,
      description,
      requestNumber: null,
      projectId: null,
      status: null,
      createdByUserId: actor.sub,
      lastMessageAt: null,
      createdAt: now
    });

    return this.getConversation(actor, conversationId);
  }

  async createRequest(
    actor: Actor,
    input: { title: string; body: string; projectId?: string; partnerId?: string }
  ) {
    const partnerId = isCompany(actor) ? input.partnerId : actor.partnerId;
    if (!partnerId) throw new Error("Не указан партнёр");
    if (!isCompany(actor) && actor.partnerId !== partnerId) {
      throw new Error("Forbidden");
    }

    if (input.projectId) {
      const [project] = await db
        .select({ id: catalogProjects.id, name: catalogProjects.name })
        .from(catalogProjects)
        .where(eq(catalogProjects.id, input.projectId))
        .limit(1);
      if (!project) throw new Error("Проект не найден");
    }

    const requestNumber = await this.nextRequestNumber();
    const conversationId = randomUUID();
    const now = new Date();
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length < 2) throw new Error("Укажите тему запроса");
    if (body.length < 2) throw new Error("Укажите текст запроса");

    await db.insert(messengerConversations).values({
      id: conversationId,
      type: "request",
      partnerId,
      title,
      requestNumber,
      projectId: input.projectId ?? null,
      status: "open",
      createdByUserId: actor.sub,
      lastMessageAt: now,
      createdAt: now
    });

    const messageId = randomUUID();
    await db.insert(messengerMessages).values({
      id: messageId,
      conversationId,
      authorUserId: actor.sub,
      body,
      createdAt: now
    });

    await this.markRead(actor.sub, conversationId);

    return this.getConversation(actor, conversationId);
  }

  async setArchive(actor: Actor, conversationId: string, archived: boolean) {
    const conversation = await this.requireConversation(conversationId);
    await this.assertCanAccess(actor, conversation);

    const [existing] = await db
      .select()
      .from(messengerArchives)
      .where(
        and(
          eq(messengerArchives.conversationId, conversationId),
          eq(messengerArchives.userId, actor.sub)
        )
      )
      .limit(1);

    if (archived) {
      if (!existing) {
        await db.insert(messengerArchives).values({
          id: randomUUID(),
          conversationId,
          userId: actor.sub,
          archivedAt: new Date()
        });
      }
    } else if (existing) {
      await db.delete(messengerArchives).where(eq(messengerArchives.id, existing.id));
    }

    return { ok: true as const, archived };
  }

  async setPin(actor: Actor, conversationId: string, pinned: boolean) {
    const conversation = await this.requireConversation(conversationId);
    await this.assertCanAccess(actor, conversation);

    const [existing] = await db
      .select()
      .from(messengerPins)
      .where(
        and(eq(messengerPins.conversationId, conversationId), eq(messengerPins.userId, actor.sub))
      )
      .limit(1);

    if (pinned) {
      if (!existing) {
        await db.insert(messengerPins).values({
          id: randomUUID(),
          conversationId,
          userId: actor.sub,
          pinnedAt: new Date()
        });
      }
    } else if (existing) {
      await db.delete(messengerPins).where(eq(messengerPins.id, existing.id));
    }

    return { ok: true as const, pinned };
  }

  /** Звук диалога — персонально: партнёр и завод глушат свои копии независимо */
  async setMute(actor: Actor, conversationId: string, muted: boolean) {
    const conversation = await this.requireConversation(conversationId);
    await this.assertCanAccess(actor, conversation);

    const [existing] = await db
      .select()
      .from(messengerMutes)
      .where(
        and(eq(messengerMutes.conversationId, conversationId), eq(messengerMutes.userId, actor.sub))
      )
      .limit(1);

    if (muted) {
      if (!existing) {
        await db.insert(messengerMutes).values({
          id: randomUUID(),
          conversationId,
          userId: actor.sub,
          mutedAt: new Date()
        });
      }
    } else if (existing) {
      await db.delete(messengerMutes).where(eq(messengerMutes.id, existing.id));
    }

    return { ok: true as const, muted };
  }

  async archiveCount(actor: Actor) {
    if (actor.partnerId) {
      await this.ensureDm(actor.partnerId, actor.sub);
    }

    const archivedRows = await db
      .select({ conversationId: messengerArchives.conversationId })
      .from(messengerArchives)
      .where(eq(messengerArchives.userId, actor.sub));
    if (archivedRows.length === 0) return 0;

    const ids = archivedRows.map((r) => r.conversationId);
    const visible = await db
      .select({ id: messengerConversations.id, type: messengerConversations.type, partnerId: messengerConversations.partnerId })
      .from(messengerConversations)
      .where(inArray(messengerConversations.id, ids));

    return visible.filter((c) => {
      if (isCompany(actor)) return true;
      return c.type === "channel" || c.partnerId === actor.partnerId;
    }).length;
  }

  async unreadTotal(actor: Actor) {
    if (actor.partnerId) {
      await this.ensureDm(actor.partnerId, actor.sub);
    }

    const archivedRows = await db
      .select({ conversationId: messengerArchives.conversationId })
      .from(messengerArchives)
      .where(eq(messengerArchives.userId, actor.sub));
    const archivedIds = new Set(archivedRows.map((r) => r.conversationId));

    const mutedRows = await db
      .select({ conversationId: messengerMutes.conversationId })
      .from(messengerMutes)
      .where(eq(messengerMutes.userId, actor.sub));
    const mutedIds = new Set(mutedRows.map((r) => r.conversationId));

    const visibility = isCompany(actor)
      ? undefined
      : or(
          eq(messengerConversations.type, "channel"),
          eq(messengerConversations.partnerId, actor.partnerId!)
        );

    const rows = await db
      .select({
        id: messengerConversations.id
      })
      .from(messengerConversations)
      .where(visibility);

    const conversationIds = rows.map((r) => r.id).filter((id) => !archivedIds.has(id));
    if (conversationIds.length === 0) return { count: 0, audible: 0 };

    const reads = await db
      .select()
      .from(messengerReads)
      .where(eq(messengerReads.userId, actor.sub));
    const readMap = new Map(reads.map((r) => [r.conversationId, r.lastReadAt]));

    const counts = await Promise.all(
      conversationIds.map(async (id) => {
        const lastRead = readMap.get(id);
        const conditions = [
          eq(messengerMessages.conversationId, id),
          ne(messengerMessages.authorUserId, actor.sub)
        ];
        if (lastRead) {
          conditions.push(gt(messengerMessages.createdAt, lastRead));
        }
        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(messengerMessages)
          .where(and(...conditions));
        return { id, count: countRow?.count ?? 0 };
      })
    );

    // audible — без заглушённых диалогов: по нему клиент решает, играть ли звук
    return counts.reduce(
      (acc, row) => ({
        count: acc.count + row.count,
        audible: acc.audible + (mutedIds.has(row.id) ? 0 : row.count)
      }),
      { count: 0, audible: 0 }
    );
  }

  async updateRequestStatus(actor: Actor, conversationId: string, status: "open" | "in_progress" | "closed") {
    const conversation = await this.requireConversation(conversationId);
    await this.assertCanAccess(actor, conversation);
    if (conversation.type !== "request") {
      throw new Error("Это не запрос");
    }

    if (!isCompany(actor)) {
      if (status !== "closed") {
        throw new Error("Дилер может только закрыть обращение");
      }
      if (conversation.partnerId !== actor.partnerId) {
        throw new Error("Forbidden");
      }
    }

    await db
      .update(messengerConversations)
      .set({ status })
      .where(eq(messengerConversations.id, conversationId));

    return this.getConversation(actor, conversationId);
  }

  async getAttachmentMeta(attachmentId: string) {
    const [row] = await db
      .select({
        attachment: messengerAttachments,
        conversationId: messengerMessages.conversationId
      })
      .from(messengerAttachments)
      .innerJoin(messengerMessages, eq(messengerAttachments.messageId, messengerMessages.id))
      .where(eq(messengerAttachments.id, attachmentId))
      .limit(1);
    if (!row) throw new Error("Файл не найден");
    return row;
  }

  async assertCanReadAttachment(actor: Actor, attachmentId: string) {
    const row = await this.getAttachmentMeta(attachmentId);
    const conversation = await this.requireConversation(row.conversationId);
    await this.assertCanAccess(actor, conversation);
    return row.attachment;
  }

  async getAttachmentFile(actor: Actor, attachmentId: string) {
    const attachment = await this.assertCanReadAttachment(actor, attachmentId);
    const stream = await openObjectStream(attachment.storageKey);
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      body: stream.body,
      contentType: stream.contentType ?? attachment.mimeType
    };
  }

  /** Signed URL: публичный S3 endpoint или короткоживущая ссылка на наш API. */
  async getAttachmentDownloadUrl(actor: Actor, attachmentId: string) {
    const attachment = await this.assertCanReadAttachment(actor, attachmentId);
    if (config.s3.publicEndpoint) {
      const s3Url = await createSignedGetUrl(attachment.storageKey, attachment.fileName);
      if (s3Url) {
        return { url: s3Url, expiresInSec: 15 * 60 };
      }
    }
    return {
      url: createApiSignedDownloadPath("messenger", attachmentId),
      expiresInSec: 15 * 60
    };
  }

  async getAttachmentFileBySignedId(attachmentId: string) {
    const row = await this.getAttachmentMeta(attachmentId);
    const stream = await openObjectStream(row.attachment.storageKey);
    return {
      fileName: row.attachment.fileName,
      mimeType: row.attachment.mimeType,
      body: stream.body,
      contentType: stream.contentType ?? row.attachment.mimeType
    };
  }

  private async requireConversation(id: string) {
    const [row] = await db
      .select()
      .from(messengerConversations)
      .where(eq(messengerConversations.id, id))
      .limit(1);
    if (!row) throw new Error("Диалог не найден");
    return row;
  }

  private async nextRequestNumber() {
    const year = new Date().getFullYear();
    const prefix = `З-${year}-`;
    const [row] = await db
      .select({ requestNumber: messengerConversations.requestNumber })
      .from(messengerConversations)
      .where(sql`${messengerConversations.requestNumber} like ${`${prefix}%`}`)
      .orderBy(desc(messengerConversations.requestNumber))
      .limit(1);

    const last = row?.requestNumber ? Number(row.requestNumber.slice(prefix.length)) : 0;
    const next = Number.isFinite(last) ? last + 1 : 1;
    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  private async saveAttachment(messageId: string, file: AttachmentInput) {
    if (!file.storageKey.startsWith("messenger/")) {
      throw new Error("Неверный ключ вложения");
    }
    await assertObjectExists(file.storageKey);

    const safeName = file.fileName.replace(/[^\w.\-а-яА-ЯёЁ ]+/gi, "_").slice(0, 120) || "file";
    const mimeType = file.mimeType || "application/octet-stream";
    const byteSize = file.byteSize;

    const id = randomUUID();
    await db.insert(messengerAttachments).values({
      id,
      messageId,
      fileName: safeName,
      mimeType,
      byteSize,
      storageKey: file.storageKey
    });

    return {
      id,
      fileName: safeName,
      mimeType,
      byteSize
    };
  }

  /** Двигает позицию чтения и возвращает предыдущую (null — читает впервые) */
  private async markRead(userId: string, conversationId: string): Promise<Date | null> {
    const [existing] = await db
      .select()
      .from(messengerReads)
      .where(and(eq(messengerReads.userId, userId), eq(messengerReads.conversationId, conversationId)))
      .limit(1);

    if (existing) {
      await db
        .update(messengerReads)
        .set({ lastReadAt: new Date() })
        .where(eq(messengerReads.id, existing.id));
      return existing.lastReadAt;
    }

    await db.insert(messengerReads).values({
      id: randomUUID(),
      conversationId,
      userId,
      lastReadAt: new Date()
    });
    return null;
  }
}

export const messengerService = new MessengerService();
