"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "../../../components/dashboard-shell";
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
        `Синхронизация завершена: +${result.createdCount} / ~${result.updatedCount}, ассетов ${result.assetsDiscovered}`
      );
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Синхронизация не удалась");
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
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-slate-700">{notice}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Синхронизация с Tilda</h2>
            <p className="mt-1 text-sm text-slate-500">
              Official API:{" "}
              {status ? (status.officialApi.ok ? "доступен" : status.officialApi.message ?? "ошибка") : "…"}
            </p>
            {status?.storeSources?.length ? (
              <p className="mt-1 text-sm text-slate-500">
                Источники: {status.storeSources.map((source) => source.key).join(", ")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={syncing}
            onClick={() => void runSync()}
            className="rounded-lg bg-avgst-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {syncing ? "Синхронизация..." : "Запустить синхронизацию"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">История запусков</h2>
        <div className="mt-4 space-y-3">
          {runs.length === 0 ? (
            <p className="text-sm text-slate-500">Запусков ещё не было.</p>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <p className="font-medium text-slate-950">
                  {run.status} · +{run.createdCount} / ~{run.updatedCount} · ассеты {run.assetsDiscovered}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {new Date(run.startedAt).toLocaleString("ru-RU")}
                  {run.finishedAt ? ` → ${new Date(run.finishedAt).toLocaleString("ru-RU")}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
