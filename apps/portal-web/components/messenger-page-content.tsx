"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconArchive,
  IconArrowLeft,
  IconArrowUp,
  IconCheck,
  IconChecks,
  IconCopy,
  IconDotsVertical,
  IconFile,
  IconHash,
  IconMessage,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconTicket,
  IconTrash,
  IconX
} from "@tabler/icons-react";
import { toast } from "sonner";

import { PageAlert } from "@/components/page-alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
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
import { emitPortalEvent, PORTAL_EVENT } from "@/lib/portal-events";
import { cn } from "@/lib/utils";

export type MessengerAudience = "company" | "partner";

type Conversation = {
  id: string;
  type: "dm" | "request" | "channel";
  partnerId: string | null;
  partnerName: string | null;
  partnerAvatarUrl?: string | null;
  title: string;
  requestNumber: string | null;
  projectId: string | null;
  projectName: string | null;
  status: "open" | "in_progress" | "closed" | null;
  lastMessageAt: string | null;
  lastMessagePreview:
    | { kind: "text" | "media" | "file"; text: string }
    | string
    | null;
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

function parseTab(raw: string | null): TabKey {
  if (raw === "dm" || raw === "request" || raw === "channel") return raw;
  return "dm";
}

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

function dealerInitials(name: string | null | undefined) {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ListDealerAvatar({
  audience,
  item
}: {
  audience: MessengerAudience;
  item: Conversation;
}) {
  if (item.type !== "dm") return null;

  const label =
    audience === "company" ? item.partnerName || item.title || "Дилер" : "Завод";
  const src =
    audience === "company"
      ? item.partnerAvatarUrl?.trim() || null
      : "/logo.svg";

  return (
    <Avatar size="default" className="bg-muted size-10 rounded-lg">
      {src ? <AvatarImage src={src} alt={label} className="object-contain p-1" /> : null}
      <AvatarFallback className="rounded-lg text-[11px] font-medium">
        {dealerInitials(label)}
      </AvatarFallback>
    </Avatar>
  );
}

function isImageMime(mimeType: string) {
  return mimeType.startsWith("image/");
}

function previewMeta(preview: Conversation["lastMessagePreview"]) {
  if (!preview) return null;
  if (typeof preview === "string") {
    const text = preview.trim();
    return text ? ({ kind: "text" as const, text }) : null;
  }
  const text = preview.text?.trim();
  if (!text) return null;
  return { kind: preview.kind, text };
}

function MessageListPreview({ preview }: { preview: Conversation["lastMessagePreview"] }) {
  const meta = previewMeta(preview);
  if (!meta) {
    return <span className="text-muted-foreground">Нет сообщений</span>;
  }
  if (meta.kind === "media") {
    return (
      <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1">
        <IconPhoto className="size-3.5 shrink-0" />
        <span className="truncate">{meta.text}</span>
      </span>
    );
  }
  if (meta.kind === "file") {
    return (
      <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1">
        <IconFile className="size-3.5 shrink-0" />
        <span className="truncate">{meta.text}</span>
      </span>
    );
  }
  return <span className="text-muted-foreground truncate">{meta.text}</span>;
}

function MessageReceipt({ receipt }: { receipt?: ChatMessage["receipt"] }) {
  if (!receipt) return null;
  const read = receipt === "read";
  const Icon = receipt === "sent" ? IconCheck : IconChecks;
  const label =
    receipt === "sent" ? "Отправлено" : receipt === "delivered" ? "Доставлено" : "Прочитано";
  return (
    <Icon
      className={cn("size-3.5 shrink-0", read ? "text-sky-400" : "text-muted-foreground/80")}
      aria-label={label}
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
          className="bg-primary size-1 animate-bounce rounded-full"
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialId = searchParams.get("c");
  const isCompany = audience === "company";
  const basePath = isCompany ? "/company/messenger" : "/partner/messenger";

  const [tab, setTabState] = useState<TabKey>(() => parseTab(searchParams.get("tab")));
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
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelTitle, setChannelTitle] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [archiveMode, setArchiveMode] = useState(false);
  const [archiveCount, setArchiveCount] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const deletingIdsRef = useRef(deletingIds);
  deletingIdsRef.current = deletingIds;

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const filtered = useMemo(
    () => conversations.filter((c) => c.type === tab),
    [conversations, tab]
  );

  const canWrite =
    Boolean(active) &&
    (active?.type !== "channel" || isCompany) &&
    !(active?.type === "request" && active.status === "closed");

  function writeMessengerUrl(nextTab: TabKey, nextId: string | null) {
    const params = new URLSearchParams();
    params.set("tab", nextTab);
    if (nextId) params.set("c", nextId);
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }

  function setTab(next: TabKey) {
    setTabState(next);
    writeMessengerUrl(next, activeId);
  }

  function openConversation(id: string, type: TabKey) {
    setTabState(type);
    setActiveId(id);
    writeMessengerUrl(type, id);
  }

  function closeConversation() {
    setActiveId(null);
    setMessages([]);
    setTypers([]);
    setDraft("");
    setPendingFiles([]);
    writeMessengerUrl(tab, null);
  }

  useEffect(() => {
    if (!activeId || requestOpen || channelOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          '[role="dialog"], [data-radix-menu-content], [data-slot="dropdown-menu-content"], [data-slot="context-menu-content"]'
        )
      ) {
        return;
      }
      event.preventDefault();
      closeConversation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // closeConversation замыкает актуальный tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, requestOpen, channelOpen, tab]);

  const loadList = useCallback(async () => {
    try {
      const rows = await apiFetch<Conversation[]>(
        `/api/messenger/conversations${archiveMode ? "?archived=1" : ""}`
      );
      setConversations(Array.isArray(rows) ? rows : []);
      setError("");
      emitPortalEvent(PORTAL_EVENT.messengerActivity);

      try {
        const archiveRes = await apiFetch<{ count: number }>("/api/messenger/archive-count");
        setArchiveCount(archiveRes.count ?? 0);
      } catch {
        setArchiveCount(0);
      }

      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить диалоги");
      setConversations([]);
      return [] as Conversation[];
    } finally {
      setListLoading(false);
    }
  }, [archiveMode]);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setThreadLoading(true);
    try {
      const payload = await apiFetch<
        ChatMessage[] | { messages?: ChatMessage[]; typing?: Typer[] }
      >(`/api/messenger/conversations/${conversationId}/messages`);

      const nextMessages = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.messages)
          ? payload.messages
          : [];
      const nextTyping = Array.isArray(payload)
        ? []
        : Array.isArray(payload.typing)
          ? payload.typing
          : [];

      setMessages((prev) => {
        const deleting = deletingIdsRef.current;
        if (deleting.size > 0) {
          const byId = new Map(nextMessages.map((m) => [m.id, m]));
          const kept = prev
            .filter((m) => byId.has(m.id) || deleting.has(m.id))
            .map((m) => byId.get(m.id) ?? m);
          const added = nextMessages.filter(
            (m) => !prev.some((p) => p.id === m.id) && !deleting.has(m.id)
          );
          return added.length ? [...kept, ...added] : kept;
        }
        if (
          silent &&
          prev.length === nextMessages.length &&
          prev.every(
            (m, i) => m.id === nextMessages[i]?.id && m.receipt === nextMessages[i]?.receipt
          )
        ) {
          return prev;
        }
        return nextMessages;
      });
      setTypers(nextTyping);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unread: false, unreadCount: 0 } : c
        )
      );
      emitPortalEvent(PORTAL_EVENT.messengerActivity);
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
      setActiveId((current) => {
        const next =
          current && rows.some((row) => row.id === current) ? current : null;
        writeMessengerUrl(tab, next);
        return next;
      });
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
      await loadList();
      if (archived && activeId === conversationId) {
        closeConversation();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить архив");
    } finally {
      setArchiving(false);
    }
  }

  function pulseTyping() {
    if (!activeId || !canWrite || active?.type === "channel") return;
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

  async function deleteMessage(messageId: string) {
    if (deletingIds.has(messageId)) return;
    setDeletingIds((prev) => new Set(prev).add(messageId));
    try {
      await apiFetch<{ ok: true }>(`/api/messenger/messages/${messageId}`, {
        method: "DELETE"
      });
      window.setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        void loadList();
      }, 700);
    } catch (err) {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
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
        if (found) {
          setTabState(found.type);
          writeMessengerUrl(found.type, prefer);
        }
        setActiveId(prefer);
      }
      // Без автовыбора первого чата — можно остаться на «Выберите диалог»
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
      setTabState("request");
      setActiveId(created.id);
      writeMessengerUrl("request", created.id);
      await loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать запрос");
    } finally {
      setCreatingRequest(false);
    }
  }

  async function createChannel() {
    setCreatingChannel(true);
    try {
      const created = await apiFetch<Conversation>("/api/messenger/channels", {
        method: "POST",
        body: JSON.stringify({ title: channelTitle.trim() })
      });
      setChannelOpen(false);
      setChannelTitle("");
      toast.success("Канал создан");
      openConversation(created.id, "channel");
      await loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать канал");
    } finally {
      setCreatingChannel(false);
    }
  }

  async function closeRequest(conversationId?: string) {
    const id = conversationId ?? activeId ?? undefined;
    if (!id) return;
    const target = conversations.find((c) => c.id === id);
    if (!target || target.type !== "request" || target.status === "closed") return;

    setArchiving(true);
    try {
      const updated = await apiFetch<Conversation>(`/api/messenger/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" })
      });
      await apiFetch(`/api/messenger/conversations/${id}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived: true })
      });
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      toast.success("Обращение закрыто и отправлено в архив");
      await loadList();
      if (activeId === id && !archiveMode) {
        closeConversation();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось закрыть обращение");
    } finally {
      setArchiving(false);
    }
  }

  async function copyMessageText(text: string) {
    const value = text.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Скопировано");
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  const searchFiltered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // Поиск индексирует все типы; без запроса — только активный таб
    const pool = needle ? conversations : filtered;
    if (!needle) return pool;
    return pool.filter((item) =>
      [item.title, item.requestNumber, item.partnerName, item.projectName, previewMeta(item.lastMessagePreview)?.text]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [conversations, filtered, q]);

  const isGlobalSearch = q.trim().length > 0;

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

      <Card
        className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden py-0 md:grid-cols-[minmax(280px,340px)_1fr]"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
          <div className="flex flex-col gap-3 border-b p-4">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Поиск по чатам, запросам и каналам…"
                  className="pl-8"
                />
              </div>
              {!isCompany ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
                  <IconPlus className="size-4" />
                  <span className="hidden sm:inline">Запрос</span>
                </Button>
              ) : null}
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList className="grid w-full grid-cols-3">
                {(Object.keys(TAB_LABELS) as TabKey[]).map((key) => (
                  <TabsTrigger key={key} value={key} className="gap-1.5 text-xs sm:text-sm">
                    {TAB_LABELS[key]}
                    <UnreadBadge count={unreadByTab[key]} />
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto">
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
              <ul
                className={cn(
                  "divide-y",
                  isCompany && tab === "channel" && !archiveMode && "pb-16"
                )}
              >
                {searchFiltered.map((item) => {
                  const selected = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={() => openConversation(item.id, item.type)}
                            className={cn(
                              "hover:bg-muted/60 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                              selected && "bg-muted"
                            )}
                          >
                            <ListDealerAvatar audience={audience} item={item} />
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
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
                              {isGlobalSearch ? (
                                <Badge variant="outline" className="text-[10px]">
                                  {TAB_LABELS[item.type]}
                                </Badge>
                              ) : null}
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
                            <p className="line-clamp-2 text-xs">
                              <MessageListPreview preview={item.lastMessagePreview} />
                            </p>
                            </div>
                          </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem
                            className="gap-2"
                            onSelect={() => openConversation(item.id, item.type)}
                          >
                            <IconMessage className="size-4" />
                            Открыть
                          </ContextMenuItem>
                          {item.type === "dm" ? (
                            <ContextMenuItem
                              className="gap-2"
                              disabled={archiving}
                              onSelect={() => void toggleArchive(item.id, !archiveMode)}
                            >
                              <IconArchive className="size-4" />
                              {archiveMode ? "Вернуть из архива" : "В архив"}
                            </ContextMenuItem>
                          ) : null}
                          {item.type === "request" &&
                          !archiveMode &&
                          item.status !== "closed" ? (
                            <ContextMenuItem
                              className="gap-2"
                              onSelect={() => void closeRequest(item.id)}
                            >
                              <IconTicket className="size-4" />
                              Закрыть обращение
                            </ContextMenuItem>
                          ) : null}
                          {selected ? (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem className="gap-2" onSelect={closeConversation}>
                                <IconX className="size-4" />
                                Свернуть диалог
                              </ContextMenuItem>
                            </>
                          ) : null}
                        </ContextMenuContent>
                      </ContextMenu>
                    </li>
                  );
                })}
              </ul>
            )}

            {isCompany && tab === "channel" && !archiveMode ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4">
                <Button
                  type="button"
                  size="sm"
                  className="pointer-events-auto h-9 gap-1.5 rounded-full px-4 shadow-lg"
                  onClick={() => setChannelOpen(true)}
                >
                  <IconPlus className="size-4" />
                  Создать канал
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-[3.75rem] items-center border-t px-3 py-2">
            <Button
              type="button"
              variant={archiveMode ? "secondary" : "ghost"}
              className="h-9 w-full justify-start gap-2"
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
                  {active?.type !== "channel" && typers.length > 0 ? (
                    <p className="text-primary flex min-h-4 items-center gap-1.5 text-xs font-medium">
                      <TypingDots />
                      <span className="truncate">{typingLabel(typers)}</span>
                    </p>
                  ) : (
                    <div className="text-muted-foreground flex min-h-4 flex-wrap items-center gap-2 text-xs">
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
                      {archiveMode ? <Badge variant="secondary">Архив</Badge> : null}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {active?.type === "request" && !archiveMode && active.status !== "closed" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={archiving}
                      onClick={() => void closeRequest()}
                    >
                      Закрыть обращение
                    </Button>
                  ) : null}

                  {active?.type === "dm" && activeId ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label="Действия"
                          disabled={archiving}
                        >
                          <IconDotsVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() => void toggleArchive(activeId, !archiveMode)}
                        >
                          <IconArchive className="size-4" />
                          {archiveMode ? "Вернуть из архива" : "В архив"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Закрыть диалог"
                    onClick={closeConversation}
                  >
                    <IconX className="size-4" />
                  </Button>
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
                            const attachments = msg.attachments ?? [];
                            const hasBody = Boolean(msg.body?.trim());
                            const dissolving = deletingIds.has(msg.id);
                            return (
                              <MessageScrollerItem key={msg.id} id={msg.id}>
                                <ContextMenu>
                                  <ContextMenuTrigger asChild disabled={dissolving}>
                                    <Message
                                      align={mine ? "end" : "start"}
                                      className={cn(dissolving && "animate-message-sand")}
                                    >
                                      <MessageContent>
                                        {active?.type !== "channel" ? (
                                          <MessageHeader>{msg.authorName}</MessageHeader>
                                        ) : null}
                                        {hasBody ? (
                                          <Bubble variant={mine ? "default" : "secondary"}>
                                            <BubbleContent className="whitespace-pre-wrap">
                                              {msg.body}
                                            </BubbleContent>
                                          </Bubble>
                                        ) : null}
                                        {attachments.length > 0 ? (
                                          <div
                                            data-slot="message-attachments"
                                            className={cn(
                                              "flex max-w-[80%] flex-col gap-2",
                                              hasBody && "mt-0.5"
                                            )}
                                          >
                                            {attachments.map((att) => {
                                              const image = isImageMime(att.mimeType);
                                              return (
                                                <a
                                                  key={att.id}
                                                  href={`/api/messenger/attachments/${att.id}`}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                >
                                                  <Attachment
                                                    size="sm"
                                                    className="bg-muted/80 border-border/60"
                                                  >
                                                    <AttachmentMedia>
                                                      {image ? (
                                                        <IconPhoto className="size-4" />
                                                      ) : (
                                                        <IconFile className="size-4" />
                                                      )}
                                                    </AttachmentMedia>
                                                    <AttachmentContent>
                                                      <AttachmentTitle>{att.fileName}</AttachmentTitle>
                                                    </AttachmentContent>
                                                  </Attachment>
                                                </a>
                                              );
                                            })}
                                          </div>
                                        ) : null}
                                        <MessageFooter className="gap-1.5">
                                          <span>{formatTime(msg.createdAt)}</span>
                                          {mine ? <MessageReceipt receipt={msg.receipt} /> : null}
                                        </MessageFooter>
                                      </MessageContent>
                                    </Message>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-44">
                                    {hasBody ? (
                                      <ContextMenuItem
                                        className="gap-2"
                                        onSelect={() => void copyMessageText(msg.body)}
                                      >
                                        <IconCopy className="size-4" />
                                        Копировать
                                      </ContextMenuItem>
                                    ) : attachments[0] ? (
                                      <ContextMenuItem
                                        className="gap-2"
                                        onSelect={() =>
                                          void copyMessageText(attachments[0]!.fileName)
                                        }
                                      >
                                        <IconCopy className="size-4" />
                                        Копировать имя файла
                                      </ContextMenuItem>
                                    ) : null}
                                    {mine ? (
                                      <ContextMenuItem
                                        variant="destructive"
                                        className="gap-2"
                                        onSelect={() => void deleteMessage(msg.id)}
                                      >
                                        <IconTrash className="size-4" />
                                        Удалить
                                      </ContextMenuItem>
                                    ) : null}
                                  </ContextMenuContent>
                                </ContextMenu>
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
                <div className="flex min-h-[3.75rem] flex-col justify-center border-t px-3 py-2">
                  {pendingFiles.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {pendingFiles.map((file) => (
                        <div
                          key={file.id}
                          className="bg-muted inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                        >
                          {isImageMime(file.mimeType) ? (
                            <IconPhoto className="size-3.5 shrink-0" />
                          ) : (
                            <IconFile className="size-3.5 shrink-0" />
                          )}
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

                  <div className="flex min-h-9 items-end gap-2">
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
                          variant="ghost"
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
                      className="bg-muted max-h-32 min-h-9 flex-1 resize-none rounded-2xl border-0 px-3 py-2 shadow-none focus-visible:ring-0"
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
              ) : active?.type === "request" && active.status === "closed" ? (
                <div className="text-muted-foreground flex min-h-[3.75rem] items-center justify-center border-t px-3 py-2 text-center text-sm">
                  Обращение закрыто — писать нельзя
                </div>
              ) : (
                <div className="min-h-[3.75rem] border-t" />
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

      <Dialog open={channelOpen} onOpenChange={setChannelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый канал</DialogTitle>
            <DialogDescription>
              Канал виден всем дилерам. Писать в него могут только сотрудники завода.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Название канала"
            value={channelTitle}
            onChange={(e) => setChannelTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && channelTitle.trim().length >= 2) {
                e.preventDefault();
                void createChannel();
              }
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setChannelOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={creatingChannel || channelTitle.trim().length < 2}
              onClick={() => void createChannel()}
            >
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
