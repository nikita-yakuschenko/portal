"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IconBell } from "@tabler/icons-react";
import { toast } from "sonner";

import type { AppNotification } from "@/components/notifications-bell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export function NotificationsPageContent() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError("");
      setItems(await apiFetch<AppNotification[]>("/api/notifications?limit=50"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить уведомления");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(item: AppNotification) {
    if (item.readAt) return;
    try {
      await apiFetch(`/api/notifications/${item.id}/read`, { method: "POST" });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отметить");
    }
  }

  async function markAllRead() {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      setItems((prev) =>
        prev.map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() }))
      );
      toast.success("Все прочитаны");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отметить");
    }
  }

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <>
      <PageAlert message={error} variant="destructive" />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Уведомления</CardTitle>
          {unread > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void markAllRead()}>
              Прочитать все ({unread})
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconBell />
                </EmptyMedia>
                <EmptyTitle>Пока нет уведомлений</EmptyTitle>
                <EmptyDescription>
                  Здесь появятся сообщения о сайте, заявках и действиях сети.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y">
              {items.map((item) => {
                const content = (
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      {!item.readAt ? <Badge variant="default">Новое</Badge> : null}
                    </div>
                    <p className="text-muted-foreground text-sm">{item.body}</p>
                    <span className="text-muted-foreground text-xs">
                      {new Date(item.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                );

                return (
                  <li
                    key={item.id}
                    className={cn("py-4", !item.readAt && "bg-muted/30 -mx-2 rounded-md px-2")}
                  >
                    {item.actionUrl ? (
                      <Link
                        href={item.actionUrl}
                        className="block hover:opacity-90"
                        onClick={() => void markRead(item)}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => void markRead(item)}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
