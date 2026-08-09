"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { StatCard } from "@/components/stat-card";
import { apiFetch } from "@/lib/api";

export default function PartnerPage() {
  const [counts, setCounts] = useState({ projects: 0, team: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [projects, team] = await Promise.all([
          apiFetch<unknown[]>("/api/partner/catalog/projects"),
          apiFetch<unknown[]>("/api/partner/team")
        ]);
        setCounts({
          projects: projects.length,
          team: team.length
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить кабинет");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PartnerShell currentPath="/partner">
      <PageAlert message={error} variant="destructive" />

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Каталог"
          value={loading ? "…" : String(counts.projects)}
          hint="Проектов с завода"
        />
        <Link href="/partner/settings?tab=team" className="block transition-opacity hover:opacity-90">
          <StatCard
            title="Команда"
            value={loading ? "…" : String(counts.team)}
            hint="Сотрудников · Настройки"
          />
        </Link>
      </div>
    </PartnerShell>
  );
}
