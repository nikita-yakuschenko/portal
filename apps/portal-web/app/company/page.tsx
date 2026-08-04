"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

type Application = {
  id: string;
  status: string;
};

type Dashboard = {
  applications: Application[];
  partners: unknown[];
  latestSyncRun: { startedAt?: string; status?: string } | null;
};

export default function CompanyPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

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

  const pending = (data?.applications ?? []).filter((item) => item.status === "new");

  return (
    <DashboardShell
      cabinetKind="company"
      cabinetLabel={companyCabinetLabel}
      currentPath="/company"
      navigation={companyNavigation}
      title="Главная"
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
          <CardTitle>Партнёры и заявки</CardTitle>
          <CardDescription>
            Очередь заявок на подключение и список дилеров — в разделе «Партнёры».
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/company/partners?tab=applications">
              Заявки на подключение
              {data && pending.length > 0 ? ` (${pending.length})` : ""}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/company/partners">Список партнёров</Link>
          </Button>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
