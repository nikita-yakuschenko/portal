"use client";

import { useCallback, useEffect, useState } from "react";
import { IconInbox } from "@tabler/icons-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { StatCard } from "@/components/stat-card";
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
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

type Application = {
  id: string;
  inn: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  region: string;
  interests: string;
  message: string | null;
  status: string;
  reviewComment: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type Dashboard = {
  applications: Application[];
  partners: unknown[];
  latestSyncRun: { startedAt?: string; status?: string } | null;
};

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  new: { label: "Новая", variant: "secondary" },
  under_review: { label: "На рассмотрении", variant: "secondary" },
  approved: { label: "Одобрена", variant: "default" },
  rejected: { label: "Отклонена", variant: "destructive" }
};

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

export default function CompanyPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Application | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await apiFetch<Dashboard>("/api/company/dashboard"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить кабинет");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openReview(item: Application, action: "approve" | "reject") {
    setDetail(item);
    setReviewAction(action);
    setComment("");
  }

  async function submitReview() {
    if (!detail || !reviewAction) return;
    setBusyId(detail.id);
    try {
      const result = await apiFetch<{ status: string; temporaryPassword?: string }>(
        `/api/company/applications/${detail.id}/${reviewAction}`,
        {
          method: "POST",
          body: JSON.stringify({ comment: comment.trim() || undefined })
        }
      );
      const password = result.temporaryPassword;
      if (password) {
        toast.success("Заявка одобрена", {
          description: `Временный пароль: ${password}`,
          duration: Infinity,
          closeButton: true,
          action: {
            label: "Скопировать",
            onClick: () => void navigator.clipboard.writeText(password)
          }
        });
      } else {
        toast.success(reviewAction === "approve" ? "Заявка одобрена" : "Заявка отклонена");
      }
      setReviewAction(null);
      setDetail(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обработать заявку");
    } finally {
      setBusyId(null);
    }
  }

  const applications = data?.applications ?? [];
  const pending = applications.filter((item) => item.status === "new");

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company"
      navigation={companyNavigation}
    >
      <PageAlert message={error} variant="destructive" />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Заявки на подключение"
          value={data ? String(pending.length) : "—"}
          hint="Новые заявки в очереди"
        />
        <StatCard
          title="Активные партнёры"
          value={data ? String(data.partners.length) : "—"}
          hint="В дилерской сети"
        />
        <StatCard
          title="Последняя синхронизация"
          value={data?.latestSyncRun?.status ?? "—"}
          hint={
            data?.latestSyncRun?.startedAt
              ? new Date(data.latestSyncRun.startedAt).toLocaleString("ru-RU")
              : "Ещё не запускалась"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Очередь заявок</CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
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
                          <div className="flex justify-end gap-2">
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
                            {item.status === "new" ? (
                              <>
                                <Button
                                  size="sm"
                                  disabled={busyId === item.id}
                                  onClick={() => openReview(item, "approve")}
                                >
                                  Одобрить
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busyId === item.id}
                                  onClick={() => openReview(item, "reject")}
                                >
                                  Отклонить
                                </Button>
                              </>
                            ) : null}
                          </div>
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
                    ? "Одобрение заявки — будет создан кабинет партнёра."
                    : reviewAction === "reject"
                      ? "Отклонение заявки — доступ в кабинет не выдаётся."
                      : "Детали заявки на подключение."}
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
                      {busyId
                        ? "Сохранение…"
                        : reviewAction === "approve"
                          ? "Одобрить"
                          : "Отклонить"}
                    </Button>
                  </>
                ) : detail.status === "new" ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => openReview(detail, "reject")}>
                      Отклонить
                    </Button>
                    <Button type="button" onClick={() => openReview(detail, "approve")}>
                      Одобрить
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
    </DashboardShell>
  );
}
