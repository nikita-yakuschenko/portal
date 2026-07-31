"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardShell } from "../../../components/dashboard-shell";
import { apiFetch } from "@/lib/api";
import { partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";

type Inquiry = {
  id: string;
  subject: string;
  message: string;
  status?: string | null;
  createdAt: string;
};

export default function PartnerInquiriesPage() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });

  const load = useCallback(async () => {
    try {
      setError("");
      setItems(await apiFetch<Inquiry[]>("/api/partner/inquiries"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить запросы");
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
      await apiFetch("/api/partner/inquiries", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ subject: "", message: "" });
      setNotice("Запрос отправлен на завод.");
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось отправить запрос");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath="/partner/inquiries"
      navigation={partnerNavigation}
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-slate-700">{notice}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Запросы на завод</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Загрузка...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">Запросов пока нет.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <p className="font-medium">{item.subject}</p>
                  <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.status ?? "new"} · {new Date(item.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Новый запрос</h2>
          <form className="mt-4 space-y-3" onSubmit={handleCreate}>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Тема</Label>
              <Input
                id="subject"
                required
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Комплектация / сроки / материалы"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Сообщение</Label>
              <textarea
                id="message"
                required
                className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Отправляем..." : "Отправить на завод"}
            </Button>
          </form>
        </section>
      </div>
    </DashboardShell>
  );
}
