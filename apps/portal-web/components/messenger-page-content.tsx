"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconArchive,
  IconArrowLeft,
  IconArrowUp,
  IconBell,
  IconBellOff,
  IconCheck,
  IconChecks,
  IconCopy,
  IconDotsVertical,
  IconEye,
  IconFile,
  IconHash,
  IconMessage,
  IconPhoto,
  IconPin,
  IconPinnedOff,
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
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
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
import { setMessengerArchiveMode } from "@/lib/messenger-view";
import { emitPortalEvent, PORTAL_EVENT } from "@/lib/portal-events";
import { playPortalSound } from "@/lib/portal-sounds";
import { cn } from "@/lib/utils";

export type MessengerAudience = "company" | "partner";

type Conversation = {
  id: string;
  type: "dm" | "request" | "channel";
  partnerId: string | null;
  partnerName: string | null;
  partnerRegion?: string | null;
  partnerAvatarUrl?: string | null;
  title: string;
  description?: string | null;
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
  pinned?: boolean;
  /** Звук уведомлений этого диалога отключён пользователем */
  muted?: boolean;
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
  /** Просмотры публикации в канале — приходит только администратору портала */
  viewCount?: number | null;
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
  byteSize: number;
  file: File;
};

type TabKey = "dm" | "request" | "channel";

function parseTab(raw: string | null): TabKey {
  if (raw === "dm" || raw === "request" || raw === "channel") return raw;
  return "dm";
}

const GROUP_WINDOW_MS = 60_000;
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

/** В облачке сообщения всегда только часы:минуты */
function formatClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sameCalendarDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Подпись дня для бейджа-разделителя в ленте */
function formatDayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Сегодня";
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" })
  });
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

/** Локальный превью выбранного изображения до отправки */
function PendingImageThumb({ file, fileName }: { file: File; fileName: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!src) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1">
        <IconPhoto className="size-3.5 shrink-0" />
        <span className="truncate">{fileName}</span>
      </span>
    );
  }
  return (
    <img src={src} alt={fileName} className="h-16 w-16 object-cover" title={fileName} />
  );
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

function MessageReceipt({
  receipt,
  onPrimary = false
}: {
  receipt?: ChatMessage["receipt"];
  onPrimary?: boolean;
}) {
  if (!receipt) return null;
  const read = receipt === "read";
  const Icon = receipt === "sent" ? IconCheck : IconChecks;
  const label =
    receipt === "sent" ? "Отправлено" : receipt === "delivered" ? "Доставлено" : "Прочитано";
  return (
    <Icon
      className={cn(
        "size-3.5 shrink-0",
        read
          ? "text-sky-400"
          : onPrimary
            ? "text-primary-foreground/70"
            : "text-muted-foreground/80"
      )}
      aria-label={label}
    />
  );
}

/** Время, просмотры и галочки — внутри облачка, как в мессенджерах */
function MessageMeta({
  message,
  mine,
  onPrimary
}: {
  message: ChatMessage;
  mine: boolean;
  onPrimary: boolean;
}) {
  return (
    <span
      className={cn(
        "ml-1.5 inline-flex shrink-0 items-center gap-1 self-end text-[11px] leading-none",
        onPrimary ? "text-primary-foreground/75" : "text-muted-foreground"
      )}
    >
      {typeof message.viewCount === "number" ? (
        <span
          className="inline-flex items-center gap-0.5 tabular-nums"
          title="Просмотры публикации"
        >
          <IconEye className="size-3.5" />
          {message.viewCount}
        </span>
      ) : null}
      <span className="tabular-nums">{formatClockTime(message.createdAt)}</span>
      {mine ? <MessageReceipt receipt={message.receipt} onPrimary={onPrimary} /> : null}
    </span>
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

/** Поиск по чатам/запросам/каналам — выносится в шапку раздела */
export function MessengerHeaderSearch({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-0">
      <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Поиск по чатам, запросам и каналам…"
        className="h-9 w-80 pl-8 sm:w-md md:w-xl lg:w-160"
      />
    </div>
  );
}

function typingLabel(typers: Typer[]) {
  if (typers.length === 0) return "";
  if (typers.length === 1) return `${typers[0]!.fullName} печатает`;
  if (typers.length === 2) return `${typers[0]!.fullName} и ${typers[1]!.fullName} печатают`;
  return `${typers[0]!.fullName} и ещё ${typers.length - 1} печатают`;
}

/** Inbox мессенджера: чаты / запросы / каналы */
export function MessengerPageContent({
  audience,
  search
}: {
  audience: MessengerAudience;
  /** Значение поиска — поле ввода живёт в шапке раздела (MessengerHeaderSearch) */
  search: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialId = searchParams.get("c");
  const isCompany = audience === "company";
  const basePath = isCompany ? "/company/messenger" : "/partner/messenger";

  const [tab, setTabState] = useState<TabKey>(() => parseTab(searchParams.get("tab")));
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
  const [channelDescription, setChannelDescription] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [archiveMode, setArchiveMode] = useState(false);
  const [archiveCount, setArchiveCount] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [lightbox, setLightbox] = useState<{ src: string; fileName: string } | null>(null);
  const deletingIdsRef = useRef(deletingIds);
  deletingIdsRef.current = deletingIds;

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const meIdRef = useRef(meId);
  meIdRef.current = meId;

  // Слепки для звука: сколько непрочитанных было в списке и какие сообщения уже видели
  const unreadSeenRef = useRef<Map<string, number> | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const seenThreadIdRef = useRef<string | null>(null);
  const mutedIdsRef = useRef<Set<string>>(new Set());

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
      const list = Array.isArray(rows) ? rows : [];
      setConversations(list);
      setError("");
      emitPortalEvent(PORTAL_EVENT.messengerActivity);

      mutedIdsRef.current = new Set(list.filter((item) => item.muted).map((item) => item.id));

      // Звук нового сообщения по неактивным диалогам (активный озвучит loadMessages)
      const seenUnread = unreadSeenRef.current;
      if (seenUnread) {
        const grew = list.some((item) => {
          if (item.id === activeIdRef.current || item.muted) return false;
          const before = seenUnread.get(item.id);
          return before !== undefined && (item.unreadCount ?? 0) > before;
        });
        if (grew) void playPortalSound("message");
      }
      unreadSeenRef.current = new Map(list.map((item) => [item.id, item.unreadCount ?? 0]));

      try {
        const archiveRes = await apiFetch<{ count: number }>("/api/messenger/archive-count");
        setArchiveCount(archiveRes.count ?? 0);
      } catch {
        setArchiveCount(0);
      }

      return list;
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

      // Звук только на чужие сообщения, пришедшие в уже открытый тред без mute
      const sameThread = seenThreadIdRef.current === conversationId;
      if (silent && sameThread && !mutedIdsRef.current.has(conversationId)) {
        const seenIds = seenMessageIdsRef.current;
        const hasIncoming = nextMessages.some(
          (m) => !seenIds.has(m.id) && m.authorUserId !== meIdRef.current
        );
        if (hasIncoming) void playPortalSound("message");
      }
      seenThreadIdRef.current = conversationId;
      seenMessageIdsRef.current = new Set(nextMessages.map((m) => m.id));

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
            (m, i) =>
              m.id === nextMessages[i]?.id &&
              m.receipt === nextMessages[i]?.receipt &&
              m.viewCount === nextMessages[i]?.viewCount
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
    unreadSeenRef.current = null;
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

  async function togglePin(conversationId: string, pinned: boolean) {
    try {
      await apiFetch(`/api/messenger/conversations/${conversationId}/pin`, {
        method: "POST",
        body: JSON.stringify({ pinned })
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, pinned } : c))
      );
      toast.success(pinned ? "Закреплено" : "Откреплено");
      await loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось закрепить");
    }
  }

  async function toggleMute(conversationId: string, muted: boolean) {
    try {
      await apiFetch(`/api/messenger/conversations/${conversationId}/mute`, {
        method: "POST",
        body: JSON.stringify({ muted })
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, muted } : c))
      );
      if (muted) {
        mutedIdsRef.current.add(conversationId);
      } else {
        mutedIdsRef.current.delete(conversationId);
      }
      toast.success(muted ? "Уведомления отключены" : "Уведомления включены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить звук");
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
      next.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
        file
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
      const uploaded = [];
      for (const pending of pendingFiles) {
        const form = new FormData();
        form.append("file", pending.file, pending.fileName);
        const meta = await apiFetch<{
          storageKey: string;
          fileName: string;
          mimeType: string;
          byteSize: number;
        }>(`/api/uploads?purpose=messenger`, { method: "POST", body: form });
        uploaded.push(meta);
      }

      const created = await apiFetch<ChatMessage>(
        `/api/messenger/conversations/${activeId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            body,
            attachments: uploaded.map((f) => ({
              fileName: f.fileName,
              mimeType: f.mimeType,
              byteSize: f.byteSize,
              storageKey: f.storageKey
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

  // Заголовок раздела в шапке зависит от режима архива
  useEffect(() => {
    setMessengerArchiveMode(archiveMode);
  }, [archiveMode]);

  useEffect(() => () => setMessengerArchiveMode(false), []);

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
        body: JSON.stringify({
          title: channelTitle.trim(),
          description: channelDescription.trim()
        })
      });
      setChannelOpen(false);
      setChannelTitle("");
      setChannelDescription("");
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

  async function reopenRequest(conversationId?: string) {
    if (!isCompany) return;
    const id = conversationId ?? activeId ?? undefined;
    if (!id) return;
    const target = conversations.find((c) => c.id === id);
    if (!target || target.type !== "request" || target.status !== "closed") return;

    setArchiving(true);
    try {
      const updated = await apiFetch<Conversation>(`/api/messenger/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "open" })
      });
      await apiFetch(`/api/messenger/conversations/${id}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived: false })
      });
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      toast.success("Обращение снова открыто");
      setArchiveMode(false);
      setTabState("request");
      setActiveId(id);
      writeMessengerUrl("request", id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось открыть обращение");
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
    const needle = search.trim().toLowerCase();
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
  }, [conversations, filtered, search]);

  const isGlobalSearch = search.trim().length > 0;

  const unreadByTab = useMemo(() => {
    const counts: Record<TabKey, number> = { dm: 0, request: 0, channel: 0 };
    for (const item of conversations) {
      counts[item.type] += item.unreadCount ?? 0;
    }
    return counts;
  }, [conversations]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <PageAlert message={error} variant="destructive" />

      <Card
        className="grid h-full min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden rounded-none border-0 py-0 shadow-none md:grid-cols-[minmax(280px,340px)_1fr]"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden border-b md:border-r md:border-b-0">
          <div className="flex flex-col gap-3 border-b p-4">
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
                  ((isCompany && tab === "channel") || (!isCompany && tab === "request")) &&
                    !archiveMode &&
                    "pb-16"
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
                              <span
                                className={cn(
                                  "line-clamp-1 text-sm",
                                  (item.unreadCount ?? 0) > 0 ? "font-semibold" : "font-medium"
                                )}
                              >
                                {conversationTitle(item, audience)}
                              </span>
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
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <div className="flex items-center gap-1.5">
                                {item.muted ? (
                                  <IconBellOff className="text-muted-foreground size-3.5 shrink-0" />
                                ) : null}
                                {item.pinned ? (
                                  <IconPin className="text-muted-foreground size-3.5 shrink-0" />
                                ) : null}
                                <span className="text-muted-foreground text-xs tabular-nums">
                                  {formatTime(item.lastMessageAt ?? item.createdAt)}
                                </span>
                              </div>
                              <UnreadBadge count={item.unreadCount ?? 0} />
                            </div>
                          </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            className="gap-2"
                            onSelect={() => void toggleMute(item.id, !item.muted)}
                          >
                            {item.muted ? (
                              <IconBell className="size-4" />
                            ) : (
                              <IconBellOff className="size-4" />
                            )}
                            {item.muted ? "Включить уведомления" : "Отключить уведомления"}
                          </ContextMenuItem>
                          {item.type === "dm" ? (
                            <>
                              <ContextMenuItem
                                className="gap-2"
                                onSelect={() => void togglePin(item.id, !item.pinned)}
                              >
                                {item.pinned ? (
                                  <IconPinnedOff className="size-4" />
                                ) : (
                                  <IconPin className="size-4" />
                                )}
                                {item.pinned ? "Открепить" : "Закрепить"}
                              </ContextMenuItem>
                              <ContextMenuItem
                                className="gap-2"
                                disabled={archiving}
                                onSelect={() => void toggleArchive(item.id, !archiveMode)}
                              >
                                <IconArchive className="size-4" />
                                {archiveMode ? "Вернуть из архива" : "В архив"}
                              </ContextMenuItem>
                            </>
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
                          {item.type === "request" || item.type === "channel" ? (
                            <ContextMenuItem
                              className="gap-2"
                              disabled={archiving}
                              onSelect={() => void toggleArchive(item.id, !archiveMode)}
                            >
                              <IconArchive className="size-4" />
                              {archiveMode ? "Вернуть из архива" : "В архив"}
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

            {!isCompany && tab === "request" && !archiveMode ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4">
                <Button
                  type="button"
                  size="sm"
                  className="pointer-events-auto h-9 gap-1.5 rounded-full px-4 shadow-lg"
                  onClick={() => setRequestOpen(true)}
                >
                  <IconPlus className="size-4" />
                  Создать запрос
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-15 items-center border-t px-3 py-2">
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

        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
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
                      {active?.type === "dm" &&
                      isCompany &&
                      active.partnerRegion?.trim() &&
                      active.partnerRegion.trim().toLowerCase() !== "не указан" ? (
                        <span className="truncate">{active.partnerRegion.trim()}</span>
                      ) : null}
                      {active?.type === "channel" && active.description ? (
                        <span className="line-clamp-2">{active.description}</span>
                      ) : null}
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
                  {active?.type === "request" && active.status !== "closed" ? (
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

                  {activeId ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={
                        active?.muted ? "Включить уведомления чата" : "Отключить уведомления чата"
                      }
                      title={
                        active?.muted ? "Уведомления отключены" : "Отключить уведомления"
                      }
                      onClick={() => void toggleMute(activeId, !active?.muted)}
                    >
                      {active?.muted ? (
                        <IconBellOff className="size-4" />
                      ) : (
                        <IconBell className="size-4" />
                      )}
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
                          {messages.map((msg, index) => {
                            const mine = meId != null && msg.authorUserId === meId;
                            const attachments = msg.attachments ?? [];
                            const hasBody = Boolean(msg.body?.trim());
                            const dissolving = deletingIds.has(msg.id);
                            const prev = index > 0 ? messages[index - 1] : undefined;
                            const showDayBadge =
                              !prev || !sameCalendarDay(prev.createdAt, msg.createdAt);
                            // Подряд идущие сообщения одного автора в пределах минуты — одна группа
                            const grouped =
                              !showDayBadge &&
                              prev != null &&
                              prev.authorUserId === msg.authorUserId &&
                              new Date(msg.createdAt).getTime() -
                                new Date(prev.createdAt).getTime() <
                                GROUP_WINDOW_MS;
                            return (
                              <MessageScrollerItem
                                key={msg.id}
                                id={msg.id}
                                className={cn(grouped && "-mt-3")}
                              >
                                {showDayBadge ? (
                                  <div
                                    className="flex items-center gap-3 py-1"
                                    aria-label={formatDayLabel(msg.createdAt)}
                                  >
                                    <div className="bg-border/70 h-px flex-1" />
                                    <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                                      {formatDayLabel(msg.createdAt)}
                                    </span>
                                    <div className="bg-border/70 h-px flex-1" />
                                  </div>
                                ) : null}
                                <ContextMenu>
                                  <ContextMenuTrigger asChild disabled={dissolving}>
                                    <Message
                                      align={mine ? "end" : "start"}
                                      className={cn(dissolving && "animate-message-sand")}
                                    >
                                      <MessageContent>
                                        {active?.type !== "channel" && !grouped ? (
                                          <MessageHeader>{msg.authorName}</MessageHeader>
                                        ) : null}
                                        {hasBody ? (
                                          <Bubble variant={mine ? "default" : "secondary"}>
                                            <BubbleContent className="flex items-end gap-1">
                                              <span className="min-w-0 whitespace-pre-wrap">
                                                {msg.body}
                                              </span>
                                              <MessageMeta
                                                message={msg}
                                                mine={mine}
                                                onPrimary={mine}
                                              />
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
                                            {attachments.map((att, attIndex) => {
                                              const image = isImageMime(att.mimeType);
                                              const src = `/api/messenger/attachments/${att.id}`;
                                              // Без текста время и статус показываем у последнего файла
                                              const showMeta =
                                                !hasBody && attIndex === attachments.length - 1;
                                              if (image) {
                                                return (
                                                  <div
                                                    key={att.id}
                                                    className="relative max-w-full overflow-hidden rounded-2xl"
                                                  >
                                                    <button
                                                      type="button"
                                                      className="block max-w-full overflow-hidden rounded-2xl text-left focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                                                      onClick={() =>
                                                        setLightbox({ src, fileName: att.fileName })
                                                      }
                                                    >
                                                      {/* cookie-auth same-origin — next/image здесь не подходит */}
                                                      <img
                                                        src={src}
                                                        alt={att.fileName}
                                                        className="bg-muted max-h-72 max-w-full cursor-zoom-in object-cover sm:max-h-80"
                                                        loading="lazy"
                                                      />
                                                    </button>
                                                    {showMeta ? (
                                                      <span className="absolute right-2 bottom-2 rounded-md bg-black/55 px-1.5 py-0.5">
                                                        <MessageMeta
                                                          message={msg}
                                                          mine={mine}
                                                          onPrimary
                                                        />
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                );
                                              }
                                              return (
                                                <a
                                                  key={att.id}
                                                  href={src}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                >
                                                  <Attachment
                                                    size="sm"
                                                    className="bg-muted/80 border-border/60"
                                                  >
                                                    <AttachmentMedia>
                                                      <IconFile className="size-4" />
                                                    </AttachmentMedia>
                                                    <AttachmentContent>
                                                      <AttachmentTitle>{att.fileName}</AttachmentTitle>
                                                    </AttachmentContent>
                                                    {showMeta ? (
                                                      <MessageMeta
                                                        message={msg}
                                                        mine={mine}
                                                        onPrimary={false}
                                                      />
                                                    ) : null}
                                                  </Attachment>
                                                </a>
                                              );
                                            })}
                                          </div>
                                        ) : null}
                                      </MessageContent>
                                    </Message>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent>
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
                <div className="flex min-h-15 flex-col justify-center border-t px-3 py-2">
                  {pendingFiles.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {pendingFiles.map((file) => (
                        <div
                          key={file.id}
                          className="bg-muted relative inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-xl text-xs"
                        >
                          {isImageMime(file.mimeType) ? (
                            <PendingImageThumb file={file.file} fileName={file.fileName} />
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1">
                              <IconFile className="size-3.5 shrink-0" />
                              <span className="truncate">{file.fileName}</span>
                            </span>
                          )}
                          <button
                            type="button"
                            className="hover:bg-background/80 absolute top-1 right-1 rounded-full bg-black/50 p-0.5 text-white"
                            aria-label="Убрать файл"
                            onClick={() =>
                              setPendingFiles((prev) => prev.filter((row) => row.id !== file.id))
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
                isCompany ? (
                  <div className="flex min-h-15 items-center justify-center border-t px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 gap-1.5 rounded-full px-4 shadow-lg"
                      disabled={archiving}
                      onClick={() => void reopenRequest()}
                    >
                      Открыть обращение
                    </Button>
                  </div>
                ) : (
                  <div className="text-muted-foreground flex min-h-15 items-center justify-center border-t px-3 py-2 text-center text-sm">
                    Обращение закрыто — писать нельзя
                  </div>
                )
              ) : null}
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
          <div className="space-y-3">
            <Input
              placeholder="Название канала"
              value={channelTitle}
              onChange={(e) => setChannelTitle(e.target.value)}
            />
            <Textarea
              placeholder="Описание — видно под названием в шапке"
              rows={3}
              value={channelDescription}
              onChange={(e) => setChannelDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setChannelOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={
                creatingChannel ||
                channelTitle.trim().length < 2 ||
                channelDescription.trim().length < 2
              }
              onClick={() => void createChannel()}
            >
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(lightbox)}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
      >
        <DialogContent
          showCloseButton
          overlayClassName="bg-black/80"
          className="border-0 bg-transparent p-0 shadow-none sm:max-w-[min(96vw,56rem)]"
        >
          <DialogTitle className="sr-only">{lightbox?.fileName ?? "Изображение"}</DialogTitle>
          <DialogDescription className="sr-only">Просмотр вложения</DialogDescription>
          {lightbox ? (
            <img
              src={lightbox.src}
              alt={lightbox.fileName}
              className="mx-auto max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
