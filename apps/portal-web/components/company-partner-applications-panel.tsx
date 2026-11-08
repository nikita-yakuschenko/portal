"use client";

import { useCallback, useEffect, useState } from "react";
import { IconInbox } from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

export type PartnerCompanyCard = {
  legalName: string;
  phone: string;
  kpp: string | null;
  ogrn: string;
  legalAddress: string;
};

export type PartnerApplication = {
  id: string;
  inn: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  region: string;
  interests: string;
  message: string | null;
  companyCard: PartnerCompanyCard | null;
  status: string;
  reviewComment: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type ReviewAction = "contract" | "edo" | "approve" | "reject";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  new: { label: "Новая", variant: "secondary" },
  under_review: { label: "На рассмотрении", variant: "secondary" },
  contract: { label: "Договор", variant: "secondary" },
  edo: { label: "ЭДО", variant: "secondary" },
  approved: { label: "Доступ открыт", variant: "default" },
  rejected: { label: "Отклонена", variant: "destructive" }
};

const ACTION_LABEL: Record<ReviewAction, string> = {
  contract: "К договору",
  edo: "К ЭДО",
  approve: "Открыть доступ",
  reject: "Отклонить"
};

function nextStep(status: string): ReviewAction | null {
  if (status === "new" || status === "under_review") return "contract";
  if (status === "contract") return "edo";
  if (status === "edo") return "approve";
  return null;
}

const INTEREST_LABELS: Record<string, string> = {
  modular: "Модульные",
  panel_frame: "Панельно-каркасные",
  farms: "Фермы"
};

function parseInterests(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => INTEREST_LABELS[item] ?? item);
  } catch {
    return raw.trim() ? [raw] : [];
  }
}

type CompanyPartnerApplicationsPanelProps = {
  onChanged?: () => void;
};

export function CompanyPartnerApplicationsPanel({
  onChanged
}: CompanyPartnerApplicationsPanelProps) {
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PartnerApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setApplications(await apiFetch<PartnerApplication[]>("/api/company/applications"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openReview(item: PartnerApplication, action: ReviewAction) {
    setDetail(item);
    setReviewAction(action);
    setComment("");
  }

  async function submitReview() {
    if (!detail || !reviewAction) return;
    setBusyId(detail.id);
    try {
      const result = await apiFetch<{ status: string; mailSent?: boolean }>(
        `/api/company/applications/${detail.id}/${reviewAction}`,
        {
          method: "POST",
          body: JSON.stringify({ comment: comment.trim() || undefined })
        }
      );
      const sent = result.mailSent
        ? "Письмо отправлено."
        : "Статус обновлён, письмо не отправилось.";
      if (reviewAction === "approve") {
        toast.success("Доступ открыт", {
          description: result.mailSent
            ? "Письмо с доступом отправлено партнёру."
            : "Партнёр создан, но письмо не ушло. Сбросьте пароль на карточке партнёра."
        });
      } else if (reviewAction === "contract") {
        toast.success("Заявка переведена к договору", { description: sent });
      } else if (reviewAction === "edo") {
        toast.success("Заявка переведена к ЭДО", { description: sent });
      } else {
        toast.success("Заявка отклонена", { description: sent });
      }
      setReviewAction(null);
      setDetail(null);
      setLoading(true);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обработать заявку");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {error ? (
        <p className="text-destructive mb-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Заявки на подключение</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-12 w-full" />
              ))}
            </div>
          ) : applications.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconInbox />
                </EmptyMedia>
                <EmptyTitle>Заявок пока нет</EmptyTitle>
                <EmptyDescription>
                  Новые заявки на подключение появятся здесь сразу после отправки формы на сайте.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Компания</TableHead>
                    <TableHead>Контакт</TableHead>
                    <TableHead>Регион</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Создана</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((item) => {
                    const status = STATUS[item.status] ?? {
                      label: item.status,
                      variant: "secondary" as const
                    };

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.companyName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{item.contactName}</span>
                            <span className="text-muted-foreground text-xs">{item.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>{item.region}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDetail(item);
                              setReviewAction(null);
                              setComment("");
                            }}
                          >
                            Открыть
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open && !busyId) {
            setDetail(null);
            setReviewAction(null);
            setComment("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>{detail.companyName}</DialogTitle>
                <DialogDescription>
                  {reviewAction === "approve"
                    ? "Договор и ЭДО отмечены. Сейчас откроется кабинет партнёра."
                    : reviewAction === "contract"
                      ? "Заявка перейдёт к договору. Кабинет ещё не создаётся."
                      : reviewAction === "edo"
                        ? "Договор отмечен. Заявка перейдёт к подключению ЭДО."
                        : reviewAction === "reject"
                          ? "Отклонение заявки — доступ в кабинет не выдаётся."
                          : "Сначала карточка компании, затем договор и ЭДО, и только потом доступ."}
                </DialogDescription>
              </DialogHeader>

              <dl className="divide-border divide-y text-sm">
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Контакт</dt>
                  <dd className="text-right font-medium">{detail.contactName}</dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="text-right font-medium">{detail.email}</dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Телефон</dt>
                  <dd className="text-right font-medium">{detail.phone?.trim() || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">ИНН</dt>
                  <dd className="text-right font-medium">{detail.inn || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Юридическое название</dt>
                  <dd className="text-right font-medium">{detail.companyCard?.legalName || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{detail.inn.length === 12 ? "ОГРНИП" : "ОГРН"}</dt>
                  <dd className="text-right font-medium">{detail.companyCard?.ogrn || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">КПП</dt>
                  <dd className="text-right font-medium">{detail.companyCard?.kpp || "—"}</dd>
                </div>
                <div className="flex flex-col gap-1 py-2">
                  <dt className="text-muted-foreground">Юридический адрес</dt>
                  <dd className="font-medium">{detail.companyCard?.legalAddress || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Регион</dt>
                  <dd className="text-right font-medium">{detail.region}</dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Интересы</dt>
                  <dd className="text-right font-medium">
                    {parseInterests(detail.interests).join(", ") || "—"}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 py-2">
                  <dt className="text-muted-foreground">Сообщение</dt>
                  <dd className="whitespace-pre-wrap font-medium">
                    {detail.message?.trim() || "—"}
                  </dd>
                </div>
                {detail.reviewComment ? (
                  <div className="flex flex-col gap-1 py-2">
                    <dt className="text-muted-foreground">Комментарий ревью</dt>
                    <dd className="whitespace-pre-wrap font-medium">{detail.reviewComment}</dd>
                  </div>
                ) : null}
              </dl>

              {reviewAction ? (
                <div className="space-y-2">
                  <Label htmlFor="review-comment">Комментарий (необязательно)</Label>
                  <Textarea
                    id="review-comment"
                    rows={3}
                    value={comment}
                    disabled={Boolean(busyId)}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Внутренняя пометка к решению"
                  />
                </div>
              ) : null}

              <DialogFooter>
                {reviewAction ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={Boolean(busyId)}
                      onClick={() => setReviewAction(null)}
                    >
                      Назад
                    </Button>
                    <Button
                      type="button"
                      variant={reviewAction === "reject" ? "destructive" : "default"}
                      disabled={Boolean(busyId)}
                      onClick={() => void submitReview()}
                    >
                      {busyId ? "Сохранение…" : ACTION_LABEL[reviewAction]}
                    </Button>
                  </>
                ) : nextStep(detail.status) ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => openReview(detail, "reject")}>
                      Отклонить
                    </Button>
                    <Button type="button" onClick={() => openReview(detail, nextStep(detail.status)!)}>
                      {ACTION_LABEL[nextStep(detail.status)!]}
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setDetail(null)}>
                    Закрыть
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
