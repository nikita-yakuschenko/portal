"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardShell } from "../../../components/dashboard-shell";
import { apiFetch } from "@/lib/api";
import { partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";

type TeamUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
};

type MeResponse = {
  user: { role: string };
};

const roleLabel: Record<string, string> = {
  partner_owner: "Владелец",
  partner_member: "Сотрудник"
};

export default function PartnerTeamPage() {
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "partner_member" as "partner_owner" | "partner_member"
  });

  const load = useCallback(async () => {
    try {
      setError("");
      const [rows, me] = await Promise.all([
        apiFetch<TeamUser[]>("/api/partner/team"),
        apiFetch<MeResponse>("/api/partner/me")
      ]);
      setTeam(rows);
      setCanManage(me.user.role === "partner_owner");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить сотрудников");
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
      await apiFetch("/api/partner/team", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ fullName: "", email: "", password: "", role: "partner_member" });
      setNotice("Сотрудник добавлен.");
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось добавить сотрудника");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath="/partner/team"
      navigation={partnerNavigation}
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-slate-700">{notice}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Команда</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Загрузка...</p>
            ) : team.length === 0 ? (
              <p className="text-sm text-slate-500">Сотрудников пока нет.</p>
            ) : (
              team.map((user) => (
                <div key={user.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <p className="font-medium">{user.fullName}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {user.email} · {roleLabel[user.role] ?? user.role} ·{" "}
                    {user.isActive ? "активен" : "отключён"}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {canManage ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Добавить сотрудника</h2>
            <form className="mt-4 space-y-3" onSubmit={handleCreate}>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">ФИО</Label>
                <Input
                  id="fullName"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Роль</Label>
                <select
                  id="role"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 font-sans text-sm"
                  value={form.role}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      role: e.target.value as "partner_owner" | "partner_member"
                    }))
                  }
                >
                  <option value="partner_member">Сотрудник</option>
                  <option value="partner_owner">Владелец</option>
                </select>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Сохраняем..." : "Добавить"}
              </Button>
            </form>
          </section>
        ) : null}
      </div>
    </DashboardShell>
  );
}
