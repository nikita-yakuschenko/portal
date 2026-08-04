import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { and, desc, eq, gt, isNull, lt, ne, or, sql, inArray } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  catalogProjects,
  messengerAttachments,
  messengerConversations,
  messengerMessages,
  messengerReads,
  partners,
  users
} from "../../db/schema.js";
import { notificationService } from "../notifications/notification-service.js";

const NEWS_CHANNEL_TITLE = "Новости и анонсы";
const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads", "messenger");
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

type Actor = {
  sub: string;
  partnerId: string | null;
  role: "company_admin" | "company_manager" | "partner_owner" | "partner_member";
  fullName: string;
};

type AttachmentInput = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
};

function isCompany(actor: Actor) {
  return actor.role === "company_admin" || actor.role === "company_manager";
}

function previewText(body: string) {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Вложение";
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

function mapConversation(
  row: typeof messengerConversations.$inferSelect,
  extra: {
    partnerName?: string | null;
    projectName?: string | null;
    lastMessagePreview?: string | null;
    unreadCount?: number;
  } = {}
) {
  const unreadCount = Math.max(0, extra.unreadCount ?? 0);
  return {
    id: row.id,
    type: row.type,
    partnerId: row.partnerId,
    partnerName: extra.partnerName ?? null,
    title: row.title,
    requestNumber: row.requestNumber,
    projectId: row.projectId,
    projectName: extra.projectName ?? null,
    status: row.status,
    createdByUserId: row.createdByUserId,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    lastMessagePreview: extra.lastMessagePreview ?? null,
    unread: unreadCount > 0,
    unreadCount,
    createdAt: row.createdAt.toISOString()
  };
}

export class MessengerService {
  async ensureBootstrap() {
    await mkdir(UPLOAD_ROOT, { recursive: true });

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
  }

  async listConversations(
    actor: Actor,
    filters?: { type?: "dm" | "request" | "channel"; q?: string }
  ) {
    if (actor.partnerId) {
      await this.ensureDm(actor.partnerId, actor.sub);
    }

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
        projectName: catalogProjects.name
      })
      .from(messengerConversations)
      .leftJoin(partners, eq(messengerConversations.partnerId, partners.id))
      .leftJoin(catalogProjects, eq(messengerConversations.projectId, catalogProjects.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sql`coalesce(${messengerConversations.lastMessageAt}, ${messengerConversations.createdAt})`));

    const reads = await db
      .select()
      .from(messengerReads)
      .where(eq(messengerReads.userId, actor.sub));
    const readMap = new Map(reads.map((r) => [r.conversationId, r.lastReadAt]));

    const conversationIds = rows.map((r) => r.conversation.id);
    const unreadCountMap = new Map<string, number>();
    const previewMap = new Map<string, string | null>();

    if (conversationIds.length > 0) {
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
            .select({ body: messengerMessages.body })
            .from(messengerMessages)
            .where(eq(messengerMessages.conversationId, id))
            .orderBy(desc(messengerMessages.createdAt))
            .limit(1);
          return [id, last?.body ?? null] as const;
        })
      );
      for (const [id, body] of lastPreviews) {
        previewMap.set(id, body);
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
    const mapped = rows.map(({ conversation, partnerName, projectName }) => {
      const preview = previewMap.get(conversation.id);
      return mapConversation(conversation, {
        partnerName,
        projectName,
        lastMessagePreview: preview ? previewText(preview) : null,
        unreadCount: unreadCountMap.get(conversation.id) ?? 0
      });
    });

    if (!q) return mapped;

    return mapped.filter((item) => {
      const hay = [
        item.title,
        item.requestNumber,
        item.partnerName,
        item.projectName,
        item.lastMessagePreview
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
        projectName: catalogProjects.name
      })
      .from(messengerConversations)
      .leftJoin(partners, eq(messengerConversations.partnerId, partners.id))
      .leftJoin(catalogProjects, eq(messengerConversations.projectId, catalogProjects.id))
      .where(eq(messengerConversations.id, conversationId))
      .limit(1);

    if (!row) throw new Error("Диалог не найден");
    await this.assertCanAccess(actor, row.conversation);
    return mapConversation(row.conversation, {
      partnerName: row.partnerName,
      projectName: row.projectName
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
    await this.markRead(actor.sub, conversationId);

    return rows
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
          attachments: (byMessage.get(message.id) ?? []).map((att) => ({
            id: att.id,
            fileName: att.fileName,
            mimeType: att.mimeType,
            byteSize: att.byteSize
          }))
        };
      })
      .reverse();
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

  async updateRequestStatus(actor: Actor, conversationId: string, status: "open" | "in_progress" | "closed") {
    if (!isCompany(actor)) {
      throw new Error("Статус запроса меняет завод");
    }
    const conversation = await this.requireConversation(conversationId);
    if (conversation.type !== "request") {
      throw new Error("Это не запрос");
    }

    await db
      .update(messengerConversations)
      .set({ status })
      .where(eq(messengerConversations.id, conversationId));

    return this.getConversation(actor, conversationId);
  }

  async getAttachmentFile(actor: Actor, attachmentId: string) {
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
    const conversation = await this.requireConversation(row.conversationId);
    await this.assertCanAccess(actor, conversation);

    const fullPath = path.join(UPLOAD_ROOT, row.attachment.storageKey);
    const data = await readFile(fullPath);
    return {
      fileName: row.attachment.fileName,
      mimeType: row.attachment.mimeType,
      data
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
    const raw = Buffer.from(file.dataBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (raw.byteLength === 0) throw new Error("Пустой файл");
    if (raw.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error("Файл больше 8 МБ");
    }

    const safeName = file.fileName.replace(/[^\w.\-а-яА-ЯёЁ ]+/gi, "_").slice(0, 120) || "file";
    const storageKey = `${messageId}-${randomUUID()}-${safeName}`;
    await mkdir(UPLOAD_ROOT, { recursive: true });
    await writeFile(path.join(UPLOAD_ROOT, storageKey), raw);

    const id = randomUUID();
    await db.insert(messengerAttachments).values({
      id,
      messageId,
      fileName: safeName,
      mimeType: file.mimeType || "application/octet-stream",
      byteSize: raw.byteLength,
      storageKey
    });

    return {
      id,
      fileName: safeName,
      mimeType: file.mimeType || "application/octet-stream",
      byteSize: raw.byteLength
    };
  }

  private async markRead(userId: string, conversationId: string) {
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
      return;
    }

    await db.insert(messengerReads).values({
      id: randomUUID(),
      conversationId,
      userId,
      lastReadAt: new Date()
    });
  }

  private async notifyNewMessage(
    actor: Actor,
    conversation: typeof messengerConversations.$inferSelect,
    preview: string
  ) {
    const title =
      conversation.type === "channel"
        ? conversation.title || "Канал"
        : conversation.type === "request"
          ? conversation.requestNumber || "Запрос"
          : "Сообщение в чате";

    // Получатель: если пишет партнёр — завод; если завод в dm/request — партнёр; канал — все партнёры
    if (conversation.type === "channel") {
      const partnerUsers = await db
        .select({ id: users.id, partnerId: users.partnerId })
        .from(users)
        .where(and(eq(users.isActive, true), sql`${users.partnerId} is not null`));

      const byPartner = new Map<string, string[]>();
      for (const u of partnerUsers) {
        if (!u.partnerId) continue;
        const list = byPartner.get(u.partnerId) ?? [];
        list.push(u.id);
        byPartner.set(u.partnerId, list);
      }

      for (const [partnerId, userIds] of byPartner) {
        await notificationService.notifyUsers(userIds, {
          audience: "partner",
          partnerId,
          type: "messenger.message",
          title,
          body: previewText(preview),
          entityType: "messenger_conversation",
          entityId: conversation.id,
          actionUrl: `/partner/messenger?c=${conversation.id}`,
          excludeUserId: actor.sub
        });
      }
      return;
    }

    if (isCompany(actor) && conversation.partnerId) {
      await notificationService.notifyPartnerUsers(conversation.partnerId, {
        type: "messenger.message",
        title,
        body: previewText(preview),
        entityType: "messenger_conversation",
        entityId: conversation.id,
        actionUrl: `/partner/messenger?c=${conversation.id}`,
        excludeUserId: actor.sub
      });
      return;
    }

    await notificationService.notifyCompanyUsers({
      type: "messenger.message",
      title,
      body: previewText(preview),
      partnerId: conversation.partnerId,
      entityType: "messenger_conversation",
      entityId: conversation.id,
      actionUrl: `/company/messenger?c=${conversation.id}`,
      excludeUserId: actor.sub
    });
  }

  private async notifyNewRequest(
    actor: Actor,
    conversation: typeof messengerConversations.$inferSelect,
    preview: string
  ) {
    const title = `Новый запрос ${conversation.requestNumber}`;
    if (isCompany(actor) && conversation.partnerId) {
      await notificationService.notifyPartnerUsers(conversation.partnerId, {
        type: "messenger.request",
        title,
        body: previewText(preview),
        entityType: "messenger_conversation",
        entityId: conversation.id,
        actionUrl: `/partner/messenger?c=${conversation.id}`,
        excludeUserId: actor.sub
      });
      return;
    }

    await notificationService.notifyCompanyUsers({
      type: "messenger.request",
      title,
      body: previewText(preview),
      partnerId: conversation.partnerId,
      entityType: "messenger_conversation",
      entityId: conversation.id,
      actionUrl: `/company/messenger?c=${conversation.id}`,
      excludeUserId: actor.sub
    });
  }
}

export const messengerService = new MessengerService();
