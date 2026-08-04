"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  IconArchive,
  IconArrowLeft,
  IconArrowUp,
  IconCheck,
  IconChecks,
  IconFile,
  IconHash,
  IconMessage,
  IconPaperclip,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconTicket,
  IconX
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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

type Typer = { userId: string; fullName: string };

type PendingFile = {
  id: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
};

type TabKey = "dm" | "request" | "channel";

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MEDIA_ACCEPT = "image/*,video/*,audio/*";
const DOC_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.zip,.rar,.7z";

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

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 px-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="bg-muted-foreground/80 size-1 animate-bounce rounded-full"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

function typingLabel(typers: Typer[]) {
  if (typers.length === 0) return "";
  if (typers.length === 1) return `${typers[0]!.fullName} печатает`;
  if (typers.length === 2) return `${typers[0]!.fullName} и ${typers[1]!.fullName} печатают`;
  return `${typers[0]!.fullName} и ещё ${typers.length - 1} печатают`;
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
  const [typers, setTypers] = useState<Typer[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileAccept, setFileAccept] = useState(MEDIA_ACCEPT);
  const typingTimerRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ title: "", body: "" });
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [archiveMode, setArchiveMode] = useState(false);
  const [archiveCount, setArchiveCount] = useState(0);
  const [archiving, setArchiving] = useState(false);

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
      const [rows, archiveRes] = await Promise.all([
        apiFetch<Conversation[]>(
          `/api/messenger/conversations${archiveMode ? "?archived=1" : ""}`
        ),
        apiFetch<{ count: number }>("/api/messenger/archive-count")
      ]);
      setConversations(rows);
      setArchiveCount(archiveRes.count);
      setError("");
      return rows;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить диалоги");
      return [] as Conversation[];
    } finally {
      setListLoading(false);
    }
  }, [archiveMode]);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setThreadLoading(true);
    try {
      const payload = await apiFetch<{ messages: ChatMessage[]; typing: Typer[] }>(
        `/api/messenger/conversations/${conversationId}/messages`
      );
      setMessages((prev) => {
        if (
          silent &&
          prev.length === payload.messages.length &&
          prev.every(
            (m, i) => m.id === payload.messages[i]?.id && m.receipt === payload.messages[i]?.receipt
          )
        ) {
          return prev;
        }
        return payload.messages;
      });
      setTypers(payload.typing ?? []);
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
    setTypers([]);
    setPendingFiles([]);
    setDraft("");
  }, [activeId]);

  const archiveBootstrapped = useRef(false);
  useEffect(() => {
    if (!archiveBootstrapped.current) {
      archiveBootstrapped.current = true;
      return;
    }
    setListLoading(true);
    void (async () => {
      const rows = await loadList();
      setActiveId((current) =>
        current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null
      );
    })();
  }, [archiveMode, loadList]);

  async function toggleArchive(conversationId: string, archived: boolean) {
    setArchiving(true);
    try {
      await apiFetch(`/api/messenger/conversations/${conversationId}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived })
      });
      toast.success(archived ? "В архиве" : "Убрано из архива");
      const rows = await loadList();
      if (archived) {
        setActiveId((current) =>
          current === conversationId ? rows[0]?.id ?? null : current
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить архив");
    } finally {
      setArchiving(false);
    }
  }

  function pulseTyping() {
    if (!activeId || !canWrite) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    void apiFetch(`/api/messenger/conversations/${activeId}/typing`, { method: "POST" }).catch(
      () => undefined
    );
  }

  function onDraftChange(value: string) {
    setDraft(value);
    if (!value.trim()) return;
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => pulseTyping(), 200);
  }

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const room = MAX_ATTACHMENTS - pendingFiles.length;
    if (room <= 0) {
      toast.error(`Не больше ${MAX_ATTACHMENTS} вложений в одном сообщении`);
      return;
    }

    const next: PendingFile[] = [];
    for (const file of Array.from(fileList).slice(0, room)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`«${file.name}» больше 10 МБ`);
        continue;
      }
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      next.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        dataBase64
      });
    }
    if (next.length === 0) return;
    setPendingFiles((prev) => {
      const merged = [...prev, ...next];
      if (merged.length > MAX_ATTACHMENTS) {
        toast.error(`Не больше ${MAX_ATTACHMENTS} вложений в одном сообщении`);
        return merged.slice(0, MAX_ATTACHMENTS);
      }
      return merged;
    });
  }

  function openFilePicker(kind: "media" | "document") {
    if (pendingFiles.length >= MAX_ATTACHMENTS) {
      toast.error(`Не больше ${MAX_ATTACHMENTS} вложений в одном сообщении`);
      return;
    }
    setFileAccept(kind === "media" ? MEDIA_ACCEPT : DOC_ACCEPT);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  }

  async function sendMessage() {
    if (!activeId || !canWrite) return;
    const body = draft.trim();
    if (!body && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const created = await apiFetch<ChatMessage>(
        `/api/messenger/conversations/${activeId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            body,
            attachments: pendingFiles.map((f) => ({
              fileName: f.fileName,
              mimeType: f.mimeType,
              dataBase64: f.dataBase64
            }))
          })
        }
      );
      setMessages((prev) => [...prev, created]);
      setDraft("");
      setPendingFiles([]);
      void loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

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

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    const tick = () => {
      void (async () => {
        await loadList();
        const id = activeIdRef.current;
        if (id) await loadMessages(id, true);
      })();
    };
    const timer = window.setInterval(tick, 2500);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadList, loadMessages]);

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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageAlert message={error} variant="destructive" />

      <Card className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden py-0 md:grid-cols-[minmax(280px,340px)_1fr]">
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
                {archiveMode ? (
                  <IconArchive className="size-8 opacity-50" />
                ) : tab === "dm" ? (
                  <IconMessage className="size-8 opacity-50" />
                ) : null}
                {!archiveMode && tab === "request" ? <IconTicket className="size-8 opacity-50" /> : null}
                {!archiveMode && tab === "channel" ? <IconHash className="size-8 opacity-50" /> : null}
                <p>{archiveMode ? "Архив пуст" : "Пока пусто"}</p>
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

          <div className="border-t p-2">
            <Button
              type="button"
              variant={archiveMode ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setArchiveMode((v) => !v)}
            >
              {archiveMode ? <IconArrowLeft className="size-4" /> : <IconArchive className="size-4" />}
              {archiveMode ? "К чатам" : "Архив"}
              {!archiveMode && archiveCount > 0 ? (
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">{archiveCount}</span>
              ) : null}
            </Button>
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
                    {archiveMode ? <Badge variant="secondary">Архив</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {activeId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={archiving}
                      onClick={() => void toggleArchive(activeId, !archiveMode)}
                    >
                      <IconArchive className="size-4" />
                      {archiveMode ? "Вернуть" : "В архив"}
                    </Button>
                  ) : null}
                  {isCompany && active?.type === "request" ? (
                    <>
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
                    </>
                  ) : null}
                </div>
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
                <div className="border-t px-3 pt-2 pb-3">
                  <div className="text-muted-foreground mb-1.5 flex h-5 items-center gap-2 px-1 text-xs">
                    {typers.length > 0 ? (
                      <>
                        <TypingDots />
                        <span className="truncate">{typingLabel(typers)}…</span>
                      </>
                    ) : null}
                  </div>

                  {pendingFiles.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-2 px-1">
                      {pendingFiles.map((file) => (
                        <div
                          key={file.id}
                          className="bg-muted inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                        >
                          <IconPaperclip className="size-3.5 shrink-0" />
                          <span className="truncate">{file.fileName}</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Убрать файл"
                            onClick={() =>
                              setPendingFiles((prev) => prev.filter((f) => f.id !== file.id))
                            }
                          >
                            <IconX className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="bg-muted flex items-end gap-1 rounded-3xl p-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept={fileAccept}
                      onChange={(e) => {
                        void addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="size-9 shrink-0 rounded-full"
                          aria-label="Добавить вложение"
                          disabled={pendingFiles.length >= MAX_ATTACHMENTS}
                        >
                          <IconPlus className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="start" className="w-56 rounded-2xl p-1.5">
                        <DropdownMenuItem
                          className="gap-2 rounded-xl"
                          onSelect={() => openFilePicker("media")}
                        >
                          <IconPhoto className="size-4" />
                          Медиафайл
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 rounded-xl"
                          onSelect={() => openFilePicker("document")}
                        >
                          <IconFile className="size-4" />
                          Документ
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Textarea
                      value={draft}
                      onChange={(e) => onDraftChange(e.target.value)}
                      placeholder="Напишите сообщение…"
                      rows={1}
                      className="max-h-32 min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
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
                      className="size-9 shrink-0 rounded-full"
                      disabled={sending || (!draft.trim() && pendingFiles.length === 0)}
                      aria-label="Отправить"
                      onClick={() => void sendMessage()}
                    >
                      <IconArrowUp className="size-4" />
                    </Button>
                  </div>
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
    </div>
  );
}
