"use client";

import { useEffect, useState } from "react";
import { IconExternalLink, IconPencil } from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  DEAL_STATUSES,
  DEAL_STATUS_DOT,
  DEAL_STATUS_LABEL,
  describeEvent,
  formatAmount,
  formatDealDateFull,
  utmPairs,
  type Contact,
  type Deal,
  type DealDetails,
  type DealStatus
} from "@/lib/deals";

const NO_ASSIGNEE = "__none__";

type Assignee = { id: string; fullName: string };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

/** Поле, которое правится на месте: показ → клик по карандашу → ввод */
function InlineText({
  value,
  placeholder,
  ariaLabel,
  inputMode,
  onSave,
  render
}: {
  value: string;
  placeholder?: string;
  ariaLabel: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  onSave: (next: string) => Promise<void>;
  render?: (value: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  async function commit() {
    if (draft.trim() === value.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
      setDraft(value);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span className="group/inline inline-flex max-w-full items-center gap-1.5">
        <span className="min-w-0 truncate">
          {value ? (render ? render(value) : value) : (
            <span className="text-muted-foreground">{placeholder ?? "—"}</span>
          )}
        </span>
        <button
          type="button"
          // Приглушённый, но видимый: иначе не догадаться, что поле правится
          className="text-muted-foreground/50 hover:text-foreground shrink-0 transition-opacity"
          aria-label={`Изменить: ${ariaLabel}`}
          onClick={() => setEditing(true)}
        >
          <IconPencil className="size-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <Input
        autoFocus
        value={draft}
        disabled={saving}
        inputMode={inputMode ?? "text"}
        aria-label={ariaLabel}
        className="h-8"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    </span>
  );
}

/** Вертикальная лента: точка на линии, суть события, время и автор */
function Timeline({ deal }: { deal: DealDetails }) {
  if (deal.events.length === 0) {
    return <p className="text-muted-foreground text-sm">Событий пока нет.</p>;
  }

  return (
    <ol className="relative flex flex-col">
      {/* Линия идёт через центры точек: крайние обрезают её собой */}
      <span className="bg-muted-foreground/25 absolute top-4 bottom-4 left-[3.5px] w-px" aria-hidden />
      {deal.events.map((event) => {
        const { title, detail } = describeEvent(event);
        return (
          <li key={event.id} className="relative flex gap-3 py-2.5 pl-5">
            <span
              className={cn(
                "ring-background absolute top-3.5 left-0 z-10 size-2 rounded-full ring-4",
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
                {formatDealDateFull(event.createdAt)}
                {event.authorName ? ` · ${event.authorName}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function DealCardDialog({
  dealId,
  open,
  onOpenChange,
  onChanged
}: {
  dealId: string | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Списку нужно новое состояние, чтобы не перезагружаться целиком */
  onChanged: (next: Deal) => void;
}) {
  const [deal, setDeal] = useState<DealDetails | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!dealId || !open) {
      setDeal(null);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const [data, team] = await Promise.all([
          apiFetch<DealDetails>(`/api/partner/deals/${dealId}`),
          apiFetch<Assignee[]>("/api/partner/deals/assignees").catch(() => [] as Assignee[])
        ]);
        setDeal(data);
        setAssignees(team);
        setNote(data.note ?? "");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Не удалось открыть сделку");
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [dealId, open, onOpenChange]);

  async function patchDeal(body: Record<string, unknown>) {
    if (!dealId) return;
    const saved = await apiFetch<DealDetails>(`/api/partner/deals/${dealId}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    setDeal(saved);
    setNote(saved.note ?? "");
    onChanged(saved);
  }

  /** Контакт правится отдельно: он общий для всех сделок этого человека */
  async function patchContact(body: Partial<Contact>) {
    if (!deal?.contact || !dealId) return;
    await apiFetch(`/api/partner/contacts/${deal.contact.id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    const fresh = await apiFetch<DealDetails>(`/api/partner/deals/${dealId}`);
    setDeal(fresh);
    onChanged(fresh);
  }

  async function saveNote() {
    setSavingNote(true);
    try {
      await patchDeal({ note });
      toast.success("Заметка сохранена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить заметку");
    } finally {
      setSavingNote(false);
    }
  }

  const utm = deal ? utmPairs(deal.utm) : [];
  const noteDirty = deal ? note.trim() !== (deal.note ?? "").trim() : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-4xl" showCloseButton>
        {loading || !deal ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader className="gap-1 border-b px-6 py-4 pr-14">
              <DialogTitle className="text-xl">
                <InlineText
                  value={deal.title}
                  ariaLabel="Название сделки"
                  onSave={(next) => patchDeal({ title: next })}
                />
              </DialogTitle>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span>{deal.formName}</span>
                <span aria-hidden>·</span>
                <span>{formatDealDateFull(deal.createdAt)}</span>
                {deal.crmStatus !== "skipped" ? (
                  <Badge
                    variant={CRM_STATUS_VARIANT[deal.crmStatus]}
                    title={deal.crmError ?? undefined}
                  >
                    CRM: {CRM_STATUS_LABEL[deal.crmStatus]}
                  </Badge>
                ) : null}
              </div>
            </DialogHeader>

            <div className="grid max-h-[calc(90vh-8rem)] grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_20rem] md:overflow-hidden">
              <div className="flex min-w-0 flex-col gap-5 p-6 md:overflow-y-auto">
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={deal.status}
                    onValueChange={(value) => void patchDeal({ status: value as DealStatus })}
                  >
                    <SelectTrigger className="w-44" aria-label="Статус сделки">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                DEAL_STATUS_DOT[status]
                              )}
                              aria-hidden
                            />
                            {DEAL_STATUS_LABEL[status]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={deal.assigneeUserId ?? NO_ASSIGNEE}
                    onValueChange={(value) =>
                      void patchDeal({ assigneeUserId: value === NO_ASSIGNEE ? null : value })
                    }
                  >
                    <SelectTrigger className="w-52" aria-label="Ответственный">
                      <SelectValue placeholder="Ответственный" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ASSIGNEE}>Без ответственного</SelectItem>
                      {assignees.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <section className="rounded-lg border">
                  <h3 className="border-b px-4 py-2 text-sm font-medium">Контакт</h3>
                  <dl className="grid grid-cols-1 gap-x-6 px-4 pb-3 sm:grid-cols-2">
                    <Row label="Имя">
                      {deal.contact ? (
                        <InlineText
                          value={deal.contact.name}
                          ariaLabel="Имя контакта"
                          onSave={(next) => patchContact({ name: next })}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Row>
                    <Row label="Телефон">
                      {deal.contact ? (
                        <InlineText
                          value={deal.contact.phone}
                          ariaLabel="Телефон контакта"
                          inputMode="tel"
                          onSave={(next) => patchContact({ phone: next })}
                          render={(value) => <span className="tabular-nums">{value}</span>}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Row>
                    <Row label="Почта">
                      {deal.contact ? (
                        <InlineText
                          value={deal.contact.email ?? ""}
                          placeholder="не указана"
                          ariaLabel="Почта контакта"
                          inputMode="email"
                          onSave={(next) => patchContact({ email: next || null })}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Row>
                    <Row label="Сумма сделки">
                      <InlineText
                        value={deal.amount === null ? "" : String(deal.amount)}
                        placeholder="не оценена"
                        ariaLabel="Сумма сделки"
                        inputMode="numeric"
                        render={() => formatAmount(deal.amount)}
                        onSave={(next) => {
                          const digits = next.replace(/\D/g, "");
                          return patchDeal({ amount: digits ? Number(digits) : null });
                        }}
                      />
                    </Row>
                  </dl>
                </section>

                <dl className="grid grid-cols-1 gap-x-6 divide-y sm:grid-cols-2 sm:divide-y-0">
                  <Row label="Проект">
                    {deal.projectName ?? <span className="text-muted-foreground">—</span>}
                  </Row>
                  <Row label="Страница">
                    {deal.pageUrl ? (
                      <a
                        href={deal.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
                      >
                        <span className="truncate">{deal.pageUrl.replace(/^https?:\/\//, "")}</span>
                        <IconExternalLink className="size-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Row>
                </dl>

                {deal.message ? (
                  <div className="bg-muted/40 rounded-lg border p-3">
                    <p className="text-muted-foreground mb-1 text-xs">Сообщение с формы</p>
                    <p className="text-sm whitespace-pre-line">{deal.message}</p>
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
                  <label htmlFor="deal-note" className="text-sm font-medium">
                    Заметка
                  </label>
                  <Textarea
                    id="deal-note"
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

              <aside className="bg-muted/20 border-t p-6 md:overflow-y-auto md:border-t-0 md:border-l">
                <h3 className="mb-3 text-sm font-medium">История</h3>
                <Timeline deal={deal} />
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
