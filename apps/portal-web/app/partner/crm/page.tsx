"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardShell } from "../../../components/dashboard-shell";
import { apiFetch } from "@/lib/api";
import { partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";

type CrmConnection = {
  id: string;
  provider: string;
  portalUrl: string;
  isEnabled: boolean;
};

type MeResponse = {
  user: { role: string };
};

export default function PartnerCrmPage() {
  const [items, setItems] = useState<CrmConnection[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<"amocrm" | "bitrix24">("bitrix24");
  const [portalUrl, setPortalUrl] = useState("https://example.bitrix24.ru");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const [rows, me] = await Promise.all([
        apiFetch<CrmConnection[]>("/api/partner/crm-connections"),
        apiFetch<MeResponse>("/api/partner/me")
      ]);
      setItems(rows);
      setCanManage(me.user.role === "partner_owner");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить CRM");
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

    const credentials =
      provider === "bitrix24"
        ? { webhookUrl }
        : { clientId, clientSecret, refreshToken };

    try {
      await apiFetch("/api/partner/crm-connections", {
        method: "POST",
        body: JSON.stringify({ provider, portalUrl, credentials })
      });
      setNotice("CRM подключена.");
      setWebhookUrl("");
      setClientId("");
      setClientSecret("");
      setRefreshToken("");
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось подключить CRM");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath="/partner/crm"
      navigation={partnerNavigation}
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-slate-700">{notice}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Подключения</h2>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-500">Загрузка...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">CRM ещё не подключена.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <p className="font-medium uppercase">{item.provider}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.portalUrl} · {item.isEnabled ? "включено" : "выключено"}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {canManage ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Подключить CRM</h2>
            <form className="mt-4 space-y-3" onSubmit={handleCreate}>
              <div className="space-y-1.5">
                <Label htmlFor="provider">Провайдер</Label>
                <select
                  id="provider"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 font-sans text-sm"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as "amocrm" | "bitrix24")}
                >
                  <option value="bitrix24">Bitrix24</option>
                  <option value="amocrm">amoCRM</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="portalUrl">URL портала</Label>
                <Input
                  id="portalUrl"
                  type="url"
                  required
                  value={portalUrl}
                  onChange={(e) => setPortalUrl(e.target.value)}
                />
              </div>
              {provider === "bitrix24" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    required
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://.../rest/1/xxx/"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      required
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input
                      id="clientSecret"
                      required
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="refreshToken">Refresh Token</Label>
                    <Input
                      id="refreshToken"
                      required
                      value={refreshToken}
                      onChange={(e) => setRefreshToken(e.target.value)}
                    />
                  </div>
                </>
              )}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Подключаем..." : "Сохранить подключение"}
              </Button>
            </form>
          </section>
        ) : null}
      </div>
    </DashboardShell>
  );
}
