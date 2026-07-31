"use client";

import { useCallback, useEffect, useState } from "react";
import { IconFolder } from "@tabler/icons-react";

import { DashboardShell } from "../../components/dashboard-shell";
import { StatCard } from "../../components/stat-card";
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

export default function CompanyPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const dashboard = await apiFetch<Dashboard>("/api/company/dashboard");
      setData(dashboard);
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
      if (result.temporaryPassword) {
        setNotice(`Заявка одобрена. Временный пароль: ${result.temporaryPassword}`);
      } else {
        setNotice(action === "approve" ? "Заявка одобрена." : "Заявка отклонена.");
      }
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось обработать заявку");
    } finally {
      setBusyId(null);
    }
  }

  const pending = data?.applications.filter((item) => item.status === "new") ?? [];

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company"
      navigation={companyNavigation}
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-slate-700">{notice}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Заявки на подключение"
          value={String(pending.length)}
          hint="Новые заявки в очереди"
        />
        <StatCard
          title="Активные партнёры"
          value={String(data?.partners.length ?? "—")}
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

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <IconFolder size={20} className="text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-950">Очередь заявок</h2>
        </div>

        <div className="mt-4 space-y-3">
          {!data ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : data.applications.length === 0 ? (
            <p className="text-sm text-slate-500">Заявок пока нет.</p>
          ) : (
            data.applications.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-950">{item.companyName}</p>
                  <p className="text-sm text-slate-500">
                    {item.contactName} · {item.email} · {item.region} · {item.status}
                  </p>
                </div>
                {item.status === "new" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void review(item.id, "approve")}
                      className="rounded-lg bg-avgst-green px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Одобрить
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void review(item.id, "reject")}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                    >
                      Отклонить
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
