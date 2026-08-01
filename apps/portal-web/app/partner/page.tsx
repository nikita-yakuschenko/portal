"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, CircleHelp, Globe, MessagesSquare, Plug } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
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
import { partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";

type MeResponse = {
  user: { fullName: string; email: string; role: string };
  partner: { companyName: string; region: string; email: string; phone: string } | null;
};

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

const QUICK_ACTIONS = [
  { href: "/partner/catalog", label: "Каталог и цены", icon: BookOpen },
  { href: "/partner/site", label: "Настроить сайт", icon: Globe },
  { href: "/partner/leads", label: "Добавить лид", icon: MessagesSquare },
  { href: "/partner/crm", label: "Настроить CRM", icon: Plug },
  { href: "/partner/inquiries", label: "Запрос на завод", icon: CircleHelp }
];

export default function PartnerPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState({ projects: 0, leads: 0, crm: 0, team: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [profile, projects, leadsPayload, crm, team] = await Promise.all([
          apiFetch<MeResponse>("/api/partner/me"),
          apiFetch<unknown[]>("/api/partner/catalog/projects"),
          apiFetch<LeadsResponse>("/api/partner/leads"),
          apiFetch<unknown[]>("/api/partner/crm-connections"),
          apiFetch<unknown[]>("/api/partner/team")
        ]);
        setMe(profile);
        setLeads(leadsPayload.events.slice(0, 5));
        setCounts({
          projects: projects.length,
          leads: leadsPayload.events.length,
          crm: crm.length,
          team: team.length
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить кабинет");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const companyRows = me?.partner
    ? [
        { label: "Название", value: me.partner.companyName },
        { label: "Регион", value: me.partner.region },
        { label: "Контакт", value: me.user.fullName },
        { label: "Email", value: me.user.email }
      ]
    : [];

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath="/partner"
      navigation={partnerNavigation}
    >
      <PageAlert message={error} variant="destructive" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Каталог"
          value={loading ? "…" : String(counts.projects)}
          hint="Проектов с завода"
        />
        <StatCard
          title="Лиды"
          value={loading ? "…" : String(counts.leads)}
          hint="Всего в системе"
        />
        <StatCard
          title="CRM"
          value={loading ? "…" : String(counts.crm)}
          hint={counts.crm > 0 ? "Подключения активны" : "Нужно подключить"}
        />
        <StatCard
          title="Команда"
          value={loading ? "…" : String(counts.team)}
          hint="Сотрудников"
        />
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Компания</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-5 w-full" />
                ))}
              </div>
            ) : companyRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">Нет данных о компании.</p>
            ) : (
              <dl className="divide-border divide-y text-sm">
                {companyRows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4 py-2 first:pt-0">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="text-right font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Быстрые действия</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Button key={action.href} variant="outline" asChild>
                <Link href={action.href}>
                  <Icon />
                  {action.label}
                </Link>
              </Button>
            );
          })}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
