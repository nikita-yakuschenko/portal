"use client";

import { useCallback, useEffect, useState } from "react";
import { Plug } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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

const PROVIDER_LABEL: Record<string, string> = {
  bitrix24: "Bitrix24",
  amocrm: "amoCRM"
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
      provider === "bitrix24" ? { webhookUrl } : { clientId, clientSecret, refreshToken };

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
      setError(err instanceof Error ? err.message : "Не удалось подключить CRM");
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
      <PageAlert message={error} variant="destructive" />
      <PageAlert message={notice} />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Подключения</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1].map((row) => (
                  <Skeleton key={row} className="h-16 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Plug />
                  </EmptyMedia>
                  <EmptyTitle>CRM ещё не подключена</EmptyTitle>
                  <EmptyDescription>
                    Подключите Bitrix24 или amoCRM — лиды с сайта будут уходить туда автоматически.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="divide-border divide-y">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {PROVIDER_LABEL[item.provider] ?? item.provider}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">{item.portalUrl}</p>
                    </div>
                    <Badge variant={item.isEnabled ? "default" : "secondary"}>
                      {item.isEnabled ? "Включено" : "Выключено"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Подключить CRM</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="provider">Провайдер</FieldLabel>
                    <Select
                      value={provider}
                      onValueChange={(value) => setProvider(value as "amocrm" | "bitrix24")}
                    >
                      <SelectTrigger id="provider" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bitrix24">Bitrix24</SelectItem>
                        <SelectItem value="amocrm">amoCRM</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="portalUrl">URL портала</FieldLabel>
                    <Input
                      id="portalUrl"
                      type="url"
                      required
                      value={portalUrl}
                      onChange={(e) => setPortalUrl(e.target.value)}
                    />
                  </Field>

                  {provider === "bitrix24" ? (
                    <Field>
                      <FieldLabel htmlFor="webhookUrl">Webhook URL</FieldLabel>
                      <Input
                        id="webhookUrl"
                        required
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://.../rest/1/xxx/"
                      />
                      <FieldDescription>
                        Входящий вебхук с правом создавать лиды.
                      </FieldDescription>
                    </Field>
                  ) : (
                    <>
                      <Field>
                        <FieldLabel htmlFor="clientId">Client ID</FieldLabel>
                        <Input
                          id="clientId"
                          required
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="clientSecret">Client Secret</FieldLabel>
                        <Input
                          id="clientSecret"
                          required
                          value={clientSecret}
                          onChange={(e) => setClientSecret(e.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="refreshToken">Refresh Token</FieldLabel>
                        <Input
                          id="refreshToken"
                          required
                          value={refreshToken}
                          onChange={(e) => setRefreshToken(e.target.value)}
                        />
                      </Field>
                    </>
                  )}

                  <Field>
                    <Button type="submit" disabled={saving}>
                      {saving ? <Spinner /> : null}
                      {saving ? "Подключаем…" : "Сохранить подключение"}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}
