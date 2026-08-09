"use client";

import { useEffect, useState } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CRM_STATUS_LABEL,
  CRM_STATUS_VARIANT,
  REQUEST_STATUSES,
  REQUEST_STATUS_DOT,
  REQUEST_STATUS_LABEL,
  describeEvent,
  formatRequestDateFull,
  telHref,
  utmPairs,
  type SiteRequest,
  type SiteRequestDetails,
  type SiteRequestStatus
} from "@/lib/site-requests";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

/** Вертикальная лента: точка на линии, время и суть события */
function Timeline({ request }: { request: SiteRequestDetails }) {
  if (request.events.length === 0) {
    return <p className="text-muted-foreground text-sm">Событий пока нет.</p>;
  }

  return (
    <ol className="relative flex flex-col">
      {/* Линия идёт через центры точек: первая и последняя обрезают её собой */}
      <span
        className="bg-muted-foreground/25 absolute top-4 bottom-4 left-[3.5px] w-px"
        aria-hidden
      />
      {request.events.map((event) => {
        const { title, detail } = describeEvent(event);
        return (
          <li key={event.id} className="relative flex gap-3 py-2.5 pl-5">
            <span
              className={cn(
                "absolute top-3.5 left-0 z-10 size-2 rounded-full ring-4",
                "ring-background",
                event.type === "status_changed" ? "bg-foreground" : "bg-muted-foreground/40"
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{title}</p>
              {detail ? (
                <p className="text-muted-foreground mt-0.5 text-sm whitespace-pre-line">{detail}</p>
              ) : null}
              <p className="text-muted-foreground mt-1 text-xs">
                {formatRequestDateFull(event.createdAt)}
                {event.authorName ? ` · ${event.authorName}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function RequestCardDialog({
  requestId,
  open,
  onOpenChange,
  onChanged
}: {
  requestId: string | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Списку нужно знать новое состояние, чтобы не перезагружаться целиком */
  onChanged: (next: SiteRequest) => void;
}) {
  const [request, setRequest] = useState<SiteRequestDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!requestId || !open) {
      setRequest(null);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const data = await apiFetch<SiteRequestDetails>(`/api/partner/requests/${requestId}`);
        setRequest(data);
        setNote(data.note ?? "");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Не удалось открыть заявку");
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId, open, onOpenChange]);

  async function patch(body: { status?: SiteRequestStatus; note?: string }) {
    if (!requestId) return;
    const saved = await apiFetch<SiteRequestDetails>(`/api/partner/requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    setRequest(saved);
    setNote(saved.note ?? "");
    onChanged(saved);
  }

  async function changeStatus(next: SiteRequestStatus) {
    try {
      await patch({ status: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить статус");
    }
  }

  async function saveNote() {
    setSavingNote(true);
    try {
      await patch({ note });
      toast.success("Заметка сохранена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить заметку");
    } finally {
      setSavingNote(false);
    }
  }

  const utm = request ? utmPairs(request.utm) : [];
  const noteDirty = request ? note.trim() !== (request.note ?? "").trim() : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-4xl"
        showCloseButton
      >
        {loading || !request ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader className="gap-1 border-b px-6 py-4">
              <DialogTitle className="text-xl">{request.customerName}</DialogTitle>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span>{request.formName}</span>
                <span aria-hidden>·</span>
                <span>{formatRequestDateFull(request.createdAt)}</span>
                {request.crmStatus !== "skipped" ? (
                  <Badge
                    variant={CRM_STATUS_VARIANT[request.crmStatus]}
                    title={request.crmError ?? undefined}
                  >
                    CRM: {CRM_STATUS_LABEL[request.crmStatus]}
                  </Badge>
                ) : null}
              </div>
            </DialogHeader>

            <div className="grid max-h-[calc(90vh-8rem)] grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_20rem] md:overflow-hidden">
              {/* Слева — то, что пришло с заявкой, и работа по ней */}
              <div className="flex min-w-0 flex-col gap-5 p-6 md:overflow-y-auto">
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={request.status}
                    onValueChange={(value) => void changeStatus(value as SiteRequestStatus)}
                  >
                    <SelectTrigger className="w-48" aria-label="Статус заявки">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                REQUEST_STATUS_DOT[status]
                              )}
                              aria-hidden
                            />
                            {REQUEST_STATUS_LABEL[status]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <dl className="grid grid-cols-1 gap-x-6 divide-y sm:grid-cols-2 sm:divide-y-0">
                  <Field label="Телефон">
                    <a
                      href={telHref(request.customerPhone)}
                      className="font-medium tabular-nums underline-offset-4 hover:underline"
                    >
                      {request.customerPhone}
                    </a>
                  </Field>
                  <Field label="Почта">
                    {request.customerEmail ? (
                      <a
                        href={`mailto:${request.customerEmail}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {request.customerEmail}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Field>
                  <Field label="Проект">
                    {request.projectName ?? <span className="text-muted-foreground">—</span>}
                  </Field>
                  <Field label="Страница">
                    {request.pageUrl ? (
                      <a
                        href={request.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
                      >
                        <span className="truncate">
                          {request.pageUrl.replace(/^https?:\/\//, "")}
                        </span>
                        <IconExternalLink className="size-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Field>
                </dl>

                {request.message ? (
                  <div className="bg-muted/40 rounded-lg border p-3">
                    <p className="text-muted-foreground mb-1 text-xs">Сообщение</p>
                    <p className="text-sm whitespace-pre-line">{request.message}</p>
                  </div>
                ) : null}

                {utm.length > 0 ? (
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs">Метки рекламы</p>
                    <dl className="divide-y">
                      {utm.map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-4 py-1.5 text-sm">
                          <dt className="text-muted-foreground">{key.replace("utm_", "")}</dt>
                          <dd className="font-mono text-xs">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <label htmlFor="request-note" className="text-sm font-medium">
                    Заметка
                  </label>
                  <Textarea
                    id="request-note"
                    rows={3}
                    placeholder="О чём договорились, что обещали, когда перезвонить"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="w-fit"
                    disabled={!noteDirty || savingNote}
                    onClick={() => void saveNote()}
                  >
                    {savingNote ? "Сохранение…" : "Сохранить заметку"}
                  </Button>
                </div>
              </div>

              {/* Справа — что с заявкой происходило */}
              <aside className="bg-muted/20 border-t p-6 md:overflow-y-auto md:border-t-0 md:border-l">
                <h3 className="mb-3 text-sm font-medium">История</h3>
                <Timeline request={request} />
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
