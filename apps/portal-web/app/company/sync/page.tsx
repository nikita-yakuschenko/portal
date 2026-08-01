"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
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

type SyncRun = {
  id: string;
  status: string;
  createdCount: number;
  updatedCount: number;
  assetsDiscovered: number;
  startedAt: string;
  finishedAt: string | null;
};

type TildaStatus = {
  officialApi: { ok: boolean; message?: string };
  storeSources: Array<{ key: string; catalogPath: string }>;
};

// Значения sync_status на стороне API: running | completed | failed
const runStatusMeta: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  completed: { label: "Завершена", variant: "default" },
  running: { label: "Выполняется", variant: "secondary" },
  failed: { label: "Ошибка", variant: "destructive" }
};

export default function CompanySyncPage() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [status, setStatus] = useState<TildaStatus | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const [nextRuns, nextStatus] = await Promise.all([
        apiFetch<SyncRun[]>("/api/company/catalog/sync-runs"),
        apiFetch<TildaStatus>("/api/company/catalog/tilda-status")
      ]);
      setRuns(nextRuns);
      setStatus(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить синхронизации");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSync() {
    setSyncing(true);
    setNotice("");
    try {
      const result = await apiFetch<{
        createdCount: number;
        updatedCount: number;
        assetsDiscovered: number;
      }>("/api/company/catalog/sync/tilda", { method: "POST", body: "{}" });
      setNotice(
        `Синхронизация завершена: +${result.createdCount} новых, ${result.updatedCount} обновлено, ассетов ${result.assetsDiscovered}`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Синхронизация не удалась");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/sync"
      navigation={companyNavigation}
    >
      <PageAlert message={error} variant="destructive" />
      <PageAlert message={notice} />

      <Card>
        <CardHeader>
          <CardTitle>Синхронизация с Tilda</CardTitle>
          <CardDescription>
            Каталог проектов подтягивается из магазина Tilda вместе с изображениями.
          </CardDescription>
          <CardAction>
            <Button type="button" disabled={syncing} onClick={() => void runSync()}>
              {syncing ? <Spinner /> : <RefreshCw />}
              {syncing ? "Синхронизация…" : "Запустить синхронизацию"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Official API:</span>
            {status ? (
              <Badge variant={status.officialApi.ok ? "default" : "destructive"}>
                {status.officialApi.ok ? "доступен" : status.officialApi.message ?? "ошибка"}
              </Badge>
            ) : (
              <span className="text-muted-foreground">…</span>
            )}
          </div>
          {status?.storeSources?.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Источники:</span>
              {status.storeSources.map((source) => (
                <Badge key={source.key} variant="outline">
                  {source.key}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История запусков</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <History />
                </EmptyMedia>
                <EmptyTitle>Запусков ещё не было</EmptyTitle>
                <EmptyDescription>
                  Нажмите «Запустить синхронизацию», чтобы загрузить каталог с Tilda.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Статус</TableHead>
                    <TableHead>Создано</TableHead>
                    <TableHead>Обновлено</TableHead>
                    <TableHead>Ассеты</TableHead>
                    <TableHead>Начало</TableHead>
                    <TableHead>Завершение</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Badge variant={runStatusMeta[run.status]?.variant ?? "secondary"}>
                          {runStatusMeta[run.status]?.label ?? run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{run.createdCount}</TableCell>
                      <TableCell className="tabular-nums">{run.updatedCount}</TableCell>
                      <TableCell className="tabular-nums">{run.assetsDiscovered}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(run.startedAt).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {run.finishedAt
                          ? new Date(run.finishedAt).toLocaleString("ru-RU")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
