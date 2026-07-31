"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardShell } from "../../components/dashboard-shell";
import { StatCard } from "../../components/stat-card";
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

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath="/partner"
      navigation={partnerNavigation}
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Каталог" value={loading ? "…" : String(counts.projects)} hint="Проектов с завода" />
        <StatCard title="Лиды" value={loading ? "…" : String(counts.leads)} hint="Всего в системе" />
        <StatCard
          title="CRM"
          value={loading ? "…" : String(counts.crm)}
          hint={counts.crm > 0 ? "Подключения активны" : "Нужно подключить"}
        />
        <StatCard title="Команда" value={loading ? "…" : String(counts.team)} hint="Сотрудников" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Компания</h2>
          {me?.partner ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Название</dt>
                <dd className="font-medium text-slate-950">{me.partner.companyName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Регион</dt>
                <dd className="font-medium text-slate-950">{me.partner.region}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Контакт</dt>
                <dd className="font-medium text-slate-950">{me.user.fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-950">{me.user.email}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{loading ? "Загрузка..." : "Нет данных"}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Последние лиды</h2>
            <Link href="/partner/leads" className="text-sm font-medium text-avgst-green hover:underline">
              Все лиды
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Загрузка...</p>
            ) : leads.length === 0 ? (
              <p className="text-sm text-slate-500">Лидов пока нет.</p>
            ) : (
              leads.map((lead) => (
                <div key={lead.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <p className="font-medium text-slate-950">{lead.customerName}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {lead.customerPhone} · {lead.type} ·{" "}
                    {new Date(lead.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Быстрые действия</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/partner/catalog"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Каталог и цены
          </Link>
          <Link
            href="/partner/site"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Настроить сайт
          </Link>
          <Link
            href="/partner/leads"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Добавить лид
          </Link>
          <Link
            href="/partner/crm"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Настроить CRM
          </Link>
          <Link
            href="/partner/inquiries"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Запрос на завод
          </Link>
        </div>
      </section>
    </DashboardShell>
  );
}
