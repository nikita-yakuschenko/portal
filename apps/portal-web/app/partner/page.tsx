"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import {
  PARTNER_MODULES_CHANGED,
  readPartnerModules
} from "@/lib/partner-modules";

type Lead = {
  id: string;
  customerName: string;
  customerPhone: string;
  type: string;
  createdAt: string;
};

type LeadsResponse = {
  events: Lead[];
};

export default function PartnerPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState({ projects: 0, leads: 0, team: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [leadsEnabled, setLeadsEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setLeadsEnabled(readPartnerModules().leadsEnabled);
    sync();
    window.addEventListener(PARTNER_MODULES_CHANGED, sync);
    return () => window.removeEventListener(PARTNER_MODULES_CHANGED, sync);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [projects, team] = await Promise.all([
          apiFetch<unknown[]>("/api/partner/catalog/projects"),
          apiFetch<unknown[]>("/api/partner/team")
        ]);

        let leadCount = 0;
        let recent: Lead[] = [];
        if (readPartnerModules().leadsEnabled) {
          const leadsPayload = await apiFetch<LeadsResponse>("/api/partner/leads");
          leadCount = leadsPayload.events.length;
          recent = leadsPayload.events.slice(0, 5);
        }

        setLeads(recent);
        setCounts({
          projects: projects.length,
          leads: leadCount,
          team: team.length
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить кабинет");
      } finally {
        setLoading(false);
      }
    })();
  }, [leadsEnabled]);

  return (
    <PartnerShell currentPath="/partner">
      <PageAlert message={error} variant="destructive" />

      <div
        className={
          leadsEnabled ? "grid gap-4 md:grid-cols-3" : "grid gap-4 md:grid-cols-2"
        }
      >
        <StatCard
          title="Каталог"
          value={loading ? "…" : String(counts.projects)}
          hint="Проектов с завода"
        />
        {leadsEnabled ? (
          <StatCard
            title="Лиды"
            value={loading ? "…" : String(counts.leads)}
            hint="Всего в системе"
          />
        ) : null}
        <Link href="/partner/settings?tab=company" className="block transition-opacity hover:opacity-90">
          <StatCard
            title="Команда"
            value={loading ? "…" : String(counts.team)}
            hint="Сотрудников · Настройки"
          />
        </Link>
      </div>

      {leadsEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Последние лиды</CardTitle>
            <CardAction>
              <Button variant="link" size="sm" asChild>
                <Link href="/partner/leads">Все лиды</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((row) => (
                  <Skeleton key={row} className="h-12 w-full" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Лидов пока нет. Они появятся здесь после заявок с вашего сайта.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {leads.map((lead) => (
                  <li key={lead.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">{lead.customerName}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {lead.customerPhone} · {lead.type} ·{" "}
                      {new Date(lead.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </PartnerShell>
  );
}
