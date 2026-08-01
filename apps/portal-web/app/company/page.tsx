"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { StatCard } from "@/components/stat-card";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

type Application = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  region: string;
  status: string;
  createdAt: string;
};

type Dashboard = {
  applications: Application[];
  partners: unknown[];
  latestSyncRun: { startedAt?: string; status?: string } | null;
};

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  new: { label: "Новая", variant: "secondary" },
  approved: { label: "Одобрена", variant: "default" },
  rejected: { label: "Отклонена", variant: "destructive" }
};

export default function CompanyPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

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

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setNotice("");
    try {
      const result = await apiFetch<{ status: string; temporaryPassword?: string }>(
        `/api/company/applications/${id}/${action}`,
        { method: "POST", body: "{}" }
      );
      setNotice(
        result.temporaryPassword
          ? `Заявка одобрена. Временный пароль: ${result.temporaryPassword}`
          : action === "approve"
            ? "Заявка одобрена."
            : "Заявка отклонена."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обработать заявку");
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
      <PageAlert message={notice} />

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
                  <Inbox />
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
                          {item.status === "new" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                disabled={busyId === item.id}
                                onClick={() => void review(item.id, "approve")}
                              >
                                Одобрить
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busyId === item.id}
                                  >
                                    Отклонить
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Отклонить заявку «{item.companyName}»?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Партнёр не получит доступ в кабинет. Заявку можно будет
                                      найти в списке со статусом «Отклонена».
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => void review(item.id, "reject")}
                                    >
                                      Отклонить
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
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
    </DashboardShell>
  );
}
