import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "../../db/client.js";
import { notifications, users } from "../../db/schema.js";

export type NotificationAudience = "partner" | "company";

export type NotifyInput = {
  type: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  partnerId?: string | null | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  payload?: Record<string, unknown> | undefined;
  actionUrl?: string | undefined;
  /** Не слать уведомление самому себе */
  excludeUserId?: string | undefined;
};

function mapNotification(row: typeof notifications.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    audience: row.audience,
    partnerId: row.partnerId,
    entityType: row.entityType,
    entityId: row.entityId,
    payload: row.payload as Record<string, unknown>,
    actionUrl: row.actionUrl,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString()
  };
}

export class NotificationService {
  async notifyUsers(userIds: string[], input: NotifyInput) {
    const unique = [...new Set(userIds)].filter((id) => id && id !== input.excludeUserId);
    if (unique.length === 0) return 0;

    await db.insert(notifications).values(
      unique.map((userId) => ({
        id: randomUUID(),
        userId,
        audience: input.audience,
        partnerId: input.partnerId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        payload: input.payload ?? {},
        actionUrl: input.actionUrl ?? null
      }))
    );
    return unique.length;
  }

  async notifyPartnerUsers(partnerId: string, input: Omit<NotifyInput, "audience" | "partnerId">) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.partnerId, partnerId), eq(users.isActive, true)));
    return this.notifyUsers(
      rows.map((r) => r.id),
      { ...input, audience: "partner", partnerId }
    );
  }

  async notifyCompanyUsers(input: Omit<NotifyInput, "audience">) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNull(users.partnerId),
          inArray(users.role, ["company_admin", "company_manager"]),
          eq(users.isActive, true)
        )
      );
    return this.notifyUsers(
      rows.map((r) => r.id),
      { ...input, audience: "company" }
    );
  }

  async listForUser(userId: string, opts?: { unreadOnly?: boolean; limit?: number }) {
    const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
    const where = opts?.unreadOnly
      ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
      : eq(notifications.userId, userId);

    const rows = await db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return rows.map(mapNotification);
  }

  async unreadCount(userId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.count ?? 0;
  }

  async markRead(userId: string, notificationId: string) {
    const [existing] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .limit(1);
    if (!existing) return null;
    if (existing.readAt) return mapNotification(existing);

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, notificationId));

    return mapNotification({ ...existing, readAt: new Date() });
  }

  async markAllRead(userId: string) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { ok: true as const };
  }
}

export const notificationService = new NotificationService();
