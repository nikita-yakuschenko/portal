"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  IconCheck,
  IconChecks,
  IconHash,
  IconMessage,
  IconPaperclip,
  IconPlus,
  IconSearch,
  IconSend,
  IconTicket
} from "@tabler/icons-react";
import { toast } from "sonner";

import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Attachment,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle
} from "@/components/ui/attachment";
import { apiFetch } from "@/lib/api";
import { emitPortalEvent, PORTAL_EVENT } from "@/lib/portal-events";
import { cn } from "@/lib/utils";

export type MessengerAudience = "company" | "partner";

type Conversation = {
  id: string;
  type: "dm" | "request" | "channel";
  partnerId: string | null;
  partnerName: string | null;
  title: string;
  requestNumber: string | null;
  projectId: string | null;
  projectName: string | null;
  status: "open" | "in_progress" | "closed" | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: boolean;
  unreadCount: number;
  createdAt: string;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  authorUserId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
  deliveredAt?: string | null;
  receipt?: "sent" | "delivered" | "read" | null;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
  }>;
};

type TabKey = "dm" | "request" | "channel";

const TAB_LABELS: Record<TabKey, string> = {
  dm: "Чаты",
  request: "Запросы",
  channel: "Каналы"
};

const STATUS_LABELS: Record<string, string> = {
  open: "Открыт",
  in_progress: "В работе",
  closed: "Закрыт"
};

function formatTime(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function conversationTitle(item: Conversation, audience: MessengerAudience) {
  if (item.type === "request") {
    return item.requestNumber ? `${item.requestNumber} · ${item.title}` : item.title;
  }
  if (item.type === "dm") {
    return audience === "company"
      ? item.partnerName || item.title || "Чат"
      : "Чат с заводом";
  }
  return item.title || "Канал";
}

function MessageReceipt({ receipt }: { receipt?: ChatMessage["receipt"] }) {
  if (!receipt) return null;
  const read = receipt === "read";
  const Icon = receipt === "sent" ? IconCheck : IconChecks;
  return (
    <Icon
      className={cn("size-3.5 shrink-0", read ? "text-sky-400" : "text-muted-foreground/80")}
      aria-label={receipt === "sent" ? "Отправлено" : receipt === "delivered" ? "Доставлено" : "Прочитано"}
    />
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge
      variant="default"
      className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] tabular-nums"
    >
      {count > 99 ? "99+" : count}
    </Badge>
  );
}

/** Inbox мессенджера: чаты / запросы / каналы */
export function MessengerPageContent({ audience }: { audience: MessengerAudience }) {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("c");

  const [tab, setTab] = useState<TabKey>("dm");
  const [q, setQ] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ title: "", body: "" });
  const [creatingRequest, setCreatingRequest] = useState(false);

  const isCompany = audience === "company";
  const basePath = isCompany ? "/company/messenger" : "/partner/messenger";

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const filtered = useMemo(
    () => conversations.filter((c) => c.type === tab),
    [conversations, tab]
  );

  const canWrite = Boolean(active) && (active?.type !== "channel" || isCompany);

  const loadList = useCallback(async () => {
    try {
      const rows = await apiFetch<Conversation[]>("/api/messenger/conversations");
      setConversations(rows);
      setError("");
      return rows;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить диалоги");
      return [] as Conversation[];
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setThreadLoading(true);
    try {
      const rows = await apiFetch<ChatMessage[]>(
        `/api/messenger/conversations/${conversationId}/messages`
      );
      setMessages((prev) => {
        if (
          silent &&
          prev.length === rows.length &&
          prev.every((m, i) => m.id === rows[i]?.id && m.receipt === rows[i]?.receipt)
        ) {
          return prev;
        }
        return rows;
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unread: false, unreadCount: 0 } : c
        )
      );
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof Error ? err.message : "Не удалось загрузить сообщения");
      }
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const session = await apiFetch<{ user: { id: string } }>("/api/auth/session");
        setMeId(session.user.id);
      } catch {
        /* ignore */
      }
      const rows = await loadList();
      const prefer = initialId && rows.some((r) => r.id === initialId) ? initialId : null;
      if (prefer) {
        const found = rows.find((r) => r.id === prefer);
        if (found) setTab(found.type);
        setActiveId(prefer);
      } else if (!activeId && rows.length > 0) {
        const firstOfTab = rows.find((r) => r.type === "dm") ?? rows[0];
        if (firstOfTab) {
          setTab(firstOfTab.type);
          setActiveId(firstOfTab.id);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
  }, [activeId, loadMessages]);

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  // Живое обновление: список + активный тред + колокольчик
  useEffect(() => {
    const tick = () => {
      void (async () => {
        const prevById = new Map(conversationsRef.current.map((c) => [c.id, c]));
        const rows = await loadList();
        const grew = rows.some((row) => {
          const prev = prevById.get(row.id);
          return (
            !prev ||
            (row.lastMessageAt && row.lastMessageAt !== prev.lastMessageAt) ||
            (row.unreadCount ?? 0) > (prev.unreadCount ?? 0)
          );
        });
        if (grew) emitPortalEvent(PORTAL_EVENT.messengerActivity);
        if (activeId) await loadMessages(activeId, true);
      })();
    };
    const timer = window.setInterval(tick, 2500);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [activeId, loadList, loadMessages]);

  async function sendMessage() {
    if (!activeId || !canWrite) return;
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const created = await apiFetch<ChatMessage>(
        `/api/messenger/conversations/${activeId}/messages`,
        { method: "POST", body: JSON.stringify({ body }) }
      );
      setMessages((prev) => [...prev, created]);
      setDraft("");
      emitPortalEvent(PORTAL_EVENT.notificationsRefresh);
      void loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  async function createRequest() {
    setCreatingRequest(true);
    try {
      const created = await apiFetch<Conversation>("/api/messenger/requests", {
        method: "POST",
        body: JSON.stringify({
          title: requestForm.title.trim(),
          body: requestForm.body.trim()
        })
      });
      setRequestOpen(false);
      setRequestForm({ title: "", body: "" });
      toast.success(
        created.requestNumber
          ? `Запрос ${created.requestNumber} создан`
          : "Запрос создан"
      );
      emitPortalEvent(PORTAL_EVENT.notificationsRefresh);
      setTab("request");
      setActiveId(created.id);
      await loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать запрос");
    } finally {
      setCreatingRequest(false);
    }
  }

  async function updateStatus(status: "open" | "in_progress" | "closed") {
    if (!active || active.type !== "request" || !isCompany) return;
    try {
      const updated = await apiFetch<Conversation>(`/api/messenger/requests/${active.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      toast.success("Статус обновлён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить статус");
    }
  }

  const searchFiltered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return filtered;
    return filtered.filter((item) =>
      [item.title, item.requestNumber, item.partnerName, item.projectName, item.lastMessagePreview]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [filtered, q]);

  const unreadByTab = useMemo(() => {
    const counts: Record<TabKey, number> = { dm: 0, request: 0, channel: 0 };
    for (const item of conversations) {
      counts[item.type] += item.unreadCount ?? 0;
    }
    return counts;
  }, [conversations]);

  return (
    <>
      <PageAlert message={error} variant="destructive" />

      <Card className="grid h-[min(78vh,820px)] grid-cols-1 overflow-hidden py-0 md:grid-cols-[minmax(280px,340px)_1fr]">
        <div className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
          <div className="flex flex-col gap-3 border-b p-4">
            <div className="flex items-center gap-2">
              <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="min-w-0 flex-1">
                <TabsList className="grid w-full grid-cols-3">
                  {(Object.keys(TAB_LABELS) as TabKey[]).map((key) => (
                    <TabsTrigger key={key} value={key} className="gap-1.5 text-xs sm:text-sm">
                      {TAB_LABELS[key]}
                      <UnreadBadge count={unreadByTab[key]} />
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {!isCompany ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
                  <IconPlus className="size-4" />
                  <span className="hidden sm:inline">Запрос</span>
                </Button>
              ) : null}
            </div>
            <div className="relative">
              <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск…"
                className="pl-8"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : searchFiltered.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 p-8 text-center text-sm">
                {tab === "dm" ? <IconMessage className="size-8 opacity-50" /> : null}
                {tab === "request" ? <IconTicket className="size-8 opacity-50" /> : null}
                {tab === "channel" ? <IconHash className="size-8 opacity-50" /> : null}
                <p>Пока пусто</p>
              </div>
            ) : (
              <ul className="divide-y">
                {searchFiltered.map((item) => {
                  const selected = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveId(item.id);
                          window.history.replaceState(null, "", `${basePath}?c=${item.id}`);
                        }}
                        className={cn(
                          "hover:bg-muted/60 flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                          selected && "bg-muted"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "line-clamp-1 text-sm",
                              (item.unreadCount ?? 0) > 0 ? "font-semibold" : "font-medium"
                            )}
                          >
                            {conversationTitle(item, audience)}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {formatTime(item.lastMessageAt ?? item.createdAt)}
                            </span>
                            <UnreadBadge count={item.unreadCount ?? 0} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.type === "request" && item.status ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {STATUS_LABELS[item.status] ?? item.status}
                            </Badge>
                          ) : null}
                          {item.projectName ? (
                            <span className="text-muted-foreground line-clamp-1 text-xs">
                              {item.projectName}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {item.lastMessagePreview || "Нет сообщений"}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col">
          {!activeId ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-sm">
              Выберите диалог
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate font-semibold">
                    {active ? conversationTitle(active, audience) : "…"}
                  </h3>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    {active?.type === "request" && active.projectId ? (
                      <Link
                        href={
                          isCompany
                            ? `/company/catalog/${active.projectId}`
                            : `/partner/catalog/${active.projectId}`
                        }
                        className="hover:text-foreground underline-offset-2 hover:underline"
                      >
                        {active.projectName || "Проект"}
                      </Link>
                    ) : null}
                    {active?.type === "request" && active.status ? (
                      <Badge variant="outline">{STATUS_LABELS[active.status]}</Badge>
                    ) : null}
                    {active?.type === "channel" ? (
                      <span>Только чтение для дилеров</span>
                    ) : null}
                  </div>
                </div>
                {isCompany && active?.type === "request" ? (
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => void updateStatus("open")}>
                      Открыт
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void updateStatus("in_progress")}
                    >
                      В работе
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void updateStatus("closed")}>
                      Закрыт
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1">
                {threadLoading ? (
                  <div className="space-y-4 p-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-[70%] rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <MessageScrollerProvider>
                    <MessageScroller className="h-full">
                      <MessageScrollerViewport className="p-4">
                        <MessageScrollerContent className="gap-4">
                          {messages.map((msg) => {
                            const mine = meId != null && msg.authorUserId === meId;
                            return (
                              <MessageScrollerItem key={msg.id} id={msg.id}>
                                <Message align={mine ? "end" : "start"}>
                                  <MessageContent>
                                    <MessageHeader>{msg.authorName}</MessageHeader>
                                    <Bubble variant={mine ? "default" : "secondary"}>
                                      <BubbleContent className="whitespace-pre-wrap">
                                        {msg.body || null}
                                        {msg.attachments.length > 0 ? (
                                          <div className="mt-2 flex flex-col gap-2">
                                            {msg.attachments.map((att) => (
                                              <a
                                                key={att.id}
                                                href={`/api/messenger/attachments/${att.id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                              >
                                                <Attachment size="sm">
                                                  <AttachmentMedia>
                                                    <IconPaperclip className="size-4" />
                                                  </AttachmentMedia>
                                                  <AttachmentContent>
                                                    <AttachmentTitle>{att.fileName}</AttachmentTitle>
                                                  </AttachmentContent>
                                                </Attachment>
                                              </a>
                                            ))}
                                          </div>
                                        ) : null}
                                      </BubbleContent>
                                    </Bubble>
                                    <MessageFooter className="gap-1.5">
                                      <span>{formatTime(msg.createdAt)}</span>
                                      {mine ? <MessageReceipt receipt={msg.receipt} /> : null}
                                    </MessageFooter>
                                  </MessageContent>
                                </Message>
                              </MessageScrollerItem>
                            );
                          })}
                        </MessageScrollerContent>
                      </MessageScrollerViewport>
                    </MessageScroller>
                  </MessageScrollerProvider>
                )}
              </div>

              {canWrite ? (
                <div className="flex gap-2 border-t p-3">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Напишите сообщение…"
                    rows={2}
                    className="min-h-12 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="shrink-0 self-end"
                    disabled={sending || !draft.trim()}
                    onClick={() => void sendMessage()}
                  >
                    <IconSend className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-muted-foreground border-t px-4 py-3 text-center text-sm">
                  Канал только для чтения
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Новый запрос</DialogTitle>
            <DialogDescription>
              Создастся отдельный тред с номером. Можно уточнить сроки, комплектацию или отгрузку.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Тема"
              value={requestForm.title}
              onChange={(e) => setRequestForm((p) => ({ ...p, title: e.target.value }))}
            />
            <Textarea
              placeholder="Опишите запрос…"
              rows={5}
              value={requestForm.body}
              onChange={(e) => setRequestForm((p) => ({ ...p, body: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRequestOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={
                creatingRequest ||
                requestForm.title.trim().length < 2 ||
                requestForm.body.trim().length < 2
              }
              onClick={() => void createRequest()}
            >
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
