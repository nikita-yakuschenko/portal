"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardShell } from "../../../components/dashboard-shell";
import { apiFetch } from "@/lib/api";
import { partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";

type Lead = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  message?: string | null;
  type: string;
  projectId?: string | null;
  createdAt: string;
};

type LeadsResponse = {
  events: Lead[];
  deliveries: Array<{ leadEventId: string; status: string; externalLeadId?: string | null }>;
};

type Project = {
  id: string;
  name: string;
};

export default function PartnerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deliveries, setDeliveries] = useState<LeadsResponse["deliveries"]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    projectId: "",
    message: ""
  });

  const load = useCallback(async () => {
    try {
      setError("");
      const [leadsPayload, projectRows] = await Promise.all([
        apiFetch<LeadsResponse>("/api/partner/leads"),
        apiFetch<Project[]>("/api/partner/catalog/projects")
      ]);
      setLeads(leadsPayload.events);
      setDeliveries(leadsPayload.deliveries);
      setProjects(projectRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить лиды");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      await apiFetch("/api/partner/leads", {
        method: "POST",
        body: JSON.stringify({
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerEmail: form.customerEmail || undefined,
          projectId: form.projectId || undefined,
          message: form.message || undefined
        })
      });
      setForm({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        projectId: "",
        message: ""
      });
      setNotice("Лид создан.");
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось создать лид");
    } finally {
      setSaving(false);
    }
  }

  function deliveryFor(leadId: string) {
    return deliveries.find((item) => item.leadEventId === leadId);
  }

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath="/partner/leads"
      navigation={partnerNavigation}
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-slate-700">{notice}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Список лидов</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Загрузка...</p>
            ) : leads.length === 0 ? (
              <p className="text-sm text-slate-500">Лидов пока нет.</p>
            ) : (
              leads.map((lead) => {
                const delivery = deliveryFor(lead.id);
                const project = projects.find((item) => item.id === lead.projectId);
                return (
                  <div key={lead.id} className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="font-medium">{lead.customerName}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {lead.customerPhone}
                      {lead.customerEmail ? ` · ${lead.customerEmail}` : ""}
                      {project ? ` · ${project.name}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {lead.type} · {new Date(lead.createdAt).toLocaleString("ru-RU")}
                      {delivery
                        ? ` · CRM: ${delivery.status}${delivery.externalLeadId ? ` (${delivery.externalLeadId})` : ""}`
                        : " · CRM: не отправлен"}
                    </p>
                    {lead.message ? (
                      <p className="mt-2 text-sm text-slate-700">{lead.message}</p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Новый лид</h2>
          <form className="mt-4 space-y-3" onSubmit={handleCreate}>
            <div className="space-y-1.5">
              <Label htmlFor="customerName">Имя клиента</Label>
              <Input
                id="customerName"
                required
                value={form.customerName}
                onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerPhone">Телефон</Label>
              <Input
                id="customerPhone"
                required
                value={form.customerPhone}
                onChange={(e) => setForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, customerEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="projectId">Проект</Label>
              <select
                id="projectId"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 font-sans text-sm"
                value={form.projectId}
                onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))}
              >
                <option value="">Без проекта</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Комментарий</Label>
              <textarea
                id="message"
                className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Сохраняем..." : "Создать лид"}
            </Button>
          </form>
        </section>
      </div>
    </DashboardShell>
  );
}
