"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconBell } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";
import { playPortalSound } from "@/lib/portal-sounds";
import { cn } from "@/lib/utils";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsBellProps = {
  /** Базовый путь списка: /partner/notifications или /company/notifications */
  listHref: string;
};

export function NotificationsBell({ listHref }: NotificationsBellProps) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  // null — первая загрузка, на ней не звучим
  const seenUnreadRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [countRes, list] = await Promise.all([
        apiFetch<{ count: number }>("/api/notifications/unread-count"),
        apiFetch<AppNotification[]>("/api/notifications?limit=8")
      ]);
      const seen = seenUnreadRef.current;
      if (seen !== null && countRes.count > seen) {
        playPortalSound("notification");
      }
      seenUnreadRef.current = countRes.count;
      setUnread(countRes.count);
      setItems(list);
    } catch {
      /* сессия/сеть — колокольчик молчит */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8_000);
    const onRefresh = () => void refresh();
    window.addEventListener("b2b:notifications-refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("b2b:notifications-refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [refresh]);

  async function markRead(item: AppNotification) {
    if (!item.readAt) {
      try {
        await apiFetch(`/api/notifications/${item.id}/read`, { method: "POST" });
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row
          )
        );
        setUnread((n) => Math.max(0, n - 1));
      } catch {
        /* ignore */
      }
    }
  }

  async function markAllRead() {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      setItems((prev) => prev.map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-9 shrink-0"
          aria-label="Уведомления"
        >
          <IconBell className="size-5" stroke={1.75} />
          {unread > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Уведомления</span>
          {unread > 0 ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs font-normal"
              onClick={() => void markAllRead()}
            >
              Прочитать все
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="text-muted-foreground px-2 py-6 text-center text-sm">Пока пусто</div>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="flex cursor-pointer flex-col items-start gap-1 p-3"
              onSelect={(event) => {
                event.preventDefault();
                void markRead(item);
                if (item.actionUrl) {
                  setOpen(false);
                  window.location.href = item.actionUrl;
                }
              }}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className={cn("text-sm font-medium", !item.readAt && "text-foreground")}>
                  {item.title}
                </span>
                {!item.readAt ? (
                  <span className="bg-primary mt-1 size-2 shrink-0 rounded-full" aria-hidden />
                ) : null}
              </div>
              <span className="text-muted-foreground line-clamp-2 text-xs">{item.body}</span>
              <span className="text-muted-foreground text-[10px]">
                {new Date(item.createdAt).toLocaleString("ru-RU")}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={listHref} className="justify-center text-sm" onClick={() => setOpen(false)}>
            Все уведомления
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
