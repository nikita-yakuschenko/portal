"use client";

import { useEffect, useState } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CRM_STATUS_LABEL,
  CRM_STATUS_VARIANT,
  REQUEST_STATUSES,
  REQUEST_STATUS_DOT,
  REQUEST_STATUS_LABEL,
  formatRequestDateFull,
  telHref,
  utmPairs,
  type SiteRequest,
  type SiteRequestStatus
} from "@/lib/site-requests";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-muted-foreground shrink-0 text-sm">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}

export function RequestDetailsSheet({
  request,
  open,
  onOpenChange,
  onUpdated
}: {
  request: SiteRequest | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onUpdated: (next: SiteRequest) => void;
}) {
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setNote(request?.note ?? "");
  }, [request?.id, request?.note]);

  if (!request) return null;

  const utm = utmPairs(request.utm);
  const noteDirty = note.trim() !== (request.note ?? "").trim();

  async function patch(body: { status?: SiteRequestStatus; note?: string }) {
    if (!request) return;
    const saved = await apiFetch<SiteRequest>(`/api/partner/requests/${request.id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    onUpdated({ ...request, ...saved });
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{request.customerName}</SheetTitle>
          <SheetDescription>
            {request.formName} · {formatRequestDateFull(request.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={request.status} onValueChange={(v) => void changeStatus(v as SiteRequestStatus)}>
              <SelectTrigger className="w-44" aria-label="Статус заявки">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("size-1.5 shrink-0 rounded-full", REQUEST_STATUS_DOT[status])}
                        aria-hidden
                      />
                      {REQUEST_STATUS_LABEL[status]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {request.crmStatus !== "skipped" ? (
              <Badge
                variant={CRM_STATUS_VARIANT[request.crmStatus]}
                title={request.crmError ?? undefined}
              >
                CRM: {CRM_STATUS_LABEL[request.crmStatus]}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={telHref(request.customerPhone)}>Позвонить</a>
            </Button>
            {request.customerEmail ? (
              <Button asChild size="sm" variant="outline">
                <a href={`mailto:${request.customerEmail}`}>Написать</a>
              </Button>
            ) : null}
          </div>

          <dl className="divide-y">
            <Row label="Телефон">
              <a
                href={telHref(request.customerPhone)}
                className="font-medium tabular-nums underline-offset-4 hover:underline"
              >
                {request.customerPhone}
              </a>
            </Row>
            {request.customerEmail ? (
              <Row label="Почта">
                <a
                  href={`mailto:${request.customerEmail}`}
                  className="break-all underline-offset-4 hover:underline"
                >
                  {request.customerEmail}
                </a>
              </Row>
            ) : null}
            {request.projectName ? <Row label="Проект">{request.projectName}</Row> : null}
            {request.message ? (
              <Row label="Сообщение">
                <span className="text-left whitespace-pre-line">{request.message}</span>
              </Row>
            ) : null}
            {request.pageUrl ? (
              <Row label="Страница">
                <a
                  href={request.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
                >
                  <span className="truncate">{request.pageUrl.replace(/^https?:\/\//, "")}</span>
                  <IconExternalLink className="size-3.5 shrink-0" />
                </a>
              </Row>
            ) : null}
            {utm.map(([key, value]) => (
              <Row key={key} label={key.replace("utm_", "")}>
                <span className="font-mono text-xs">{value}</span>
              </Row>
            ))}
          </dl>

          <div className="flex flex-col gap-2">
            <label htmlFor="request-note" className="text-sm font-medium">
              Заметка
            </label>
            <Textarea
              id="request-note"
              rows={4}
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
      </SheetContent>
    </Sheet>
  );
}
