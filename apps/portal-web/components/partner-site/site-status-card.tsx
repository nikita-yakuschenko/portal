"use client";

import { useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconLock,
  IconPointFilled,
  IconWorld
} from "@tabler/icons-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SiteStatusCardProps = {
  host: string;
  status: "draft" | "published";
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  publishLocked: boolean;
  publishLockNotice: string | null;
  noticeRead: boolean;
  republishPending: boolean;
  busy: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onRequestRepublish: () => void;
  onNoticeRead: () => void;
};

type Tone = "neutral" | "live" | "attention" | "blocked";

const TONE_DOT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  live: "text-emerald-600 dark:text-emerald-500",
  attention: "text-amber-600 dark:text-amber-500",
  blocked: "text-destructive"
};

function formatPublishedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/**
 * Отвечает на вопрос «что сейчас видит покупатель» и держит все действия
 * над живым сайтом. Публикация есть только здесь — в форме её нет, чтобы
 * сохранение черновика и выпуск в эфир не путались между собой.
 */
export function SiteStatusCard({
  host,
  status,
  hasUnpublishedChanges,
  publishedAt,
  publishLocked,
  publishLockNotice,
  noticeRead,
  republishPending,
  busy,
  onPublish,
  onUnpublish,
  onRequestRepublish,
  onNoticeRead
}: SiteStatusCardProps) {
  const [copied, setCopied] = useState(false);
  const url = `https://${host}`;
  const publishedLabel = formatPublishedAt(publishedAt);

  const tone: Tone = publishLocked
    ? "blocked"
    : status !== "published"
      ? "neutral"
      : hasUnpublishedChanges
        ? "attention"
        : "live";

  const headline = publishLocked
    ? "Публикация остановлена администратором сети"
    : status !== "published"
      ? publishedAt
        ? "Сайт снят с публикации"
        : "Сайт ещё не опубликован"
      : hasUnpublishedChanges
        ? "На сайте пока старая версия"
        : "Сайт опубликован";

  const explanation = publishLocked
    ? (publishLockNotice ?? "Сайт закрыт до решения администратора сети.")
    : status !== "published"
      ? "Адрес не открывается: покупатели сайт не видят. Проверьте предпросмотр и опубликуйте."
      : hasUnpublishedChanges
        ? "Правки сохранены в кабинете, но на сайт ещё не ушли. Опубликуйте, чтобы их увидели покупатели."
        : publishedLabel
          ? `Всё, что вы сохранили, уже на сайте. Обновлён ${publishedLabel}.`
          : "Всё, что вы сохранили, уже на сайте.";

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать адрес", { description: url });
    }
  }

  return (
    // Полоса статуса, не «карточка ради карточки»: тень и лишний воздух убраны
    <Card
      className={cn(
        "gap-0 py-4 shadow-none",
        tone === "blocked" && "border-destructive/50",
        tone === "attention" && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20",
        tone === "live" && "border-emerald-500/30"
      )}
    >
      <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {publishLocked ? (
              <IconLock className={cn("size-4", TONE_DOT[tone])} aria-hidden />
            ) : tone === "attention" ? (
              <IconAlertTriangle className={cn("size-4", TONE_DOT[tone])} aria-hidden />
            ) : (
              <IconPointFilled className={cn("size-4", TONE_DOT[tone])} aria-hidden />
            )}
            {headline}
          </p>

          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex min-w-0 items-center gap-1">
              <IconWorld className="text-muted-foreground size-4 shrink-0" aria-hidden />
              {status === "published" && !publishLocked ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {host}
                </a>
              ) : (
                <span className="text-muted-foreground truncate text-sm font-medium">{host}</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => void copyUrl()}
                aria-label="Скопировать адрес сайта"
              >
                {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
              </Button>
            </div>
            <p className="text-muted-foreground max-w-prose text-sm">{explanation}</p>
          </div>

          {publishLocked && publishLockNotice && !noticeRead ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={onNoticeRead}
            >
              Понятно
            </Button>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {publishLocked ? (
            <Button
              type="button"
              disabled={busy || republishPending}
              onClick={onRequestRepublish}
            >
              {republishPending ? "Запрос отправлен" : "Запросить возобновление"}
            </Button>
          ) : status !== "published" ? (
            <Button type="button" disabled={busy} onClick={onPublish}>
              {publishedAt ? "Опубликовать снова" : "Опубликовать сайт"}
            </Button>
          ) : (
            <>
              {hasUnpublishedChanges ? (
                <Button type="button" disabled={busy} onClick={onPublish}>
                  Опубликовать изменения
                </Button>
              ) : (
                <Button type="button" variant="outline" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <IconExternalLink />
                    Открыть сайт
                  </a>
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" disabled={busy}>
                    Снять с публикации
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Снять сайт с публикации?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {host} перестанет открываться: покупатели и реклама будут упираться в
                      ошибку. Настройки останутся на месте — вернуть сайт можно кнопкой
                      «Опубликовать».
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Оставить сайт</AlertDialogCancel>
                    <AlertDialogAction onClick={onUnpublish}>Снять с публикации</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
