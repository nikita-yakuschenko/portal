"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { PartnerCrmPanel } from "@/components/partner-crm-panel";
import { PartnerShell } from "@/components/partner-shell";
import { PartnerTeamPanel } from "@/components/partner-team-panel";
import { PageAlert } from "@/components/page-alert";
import { ThemeSettings } from "@/components/theme-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import {
  readPartnerModules,
  setLeadsModuleEnabled
} from "@/lib/partner-modules";

type MeResponse = {
  user: { fullName: string; email: string; role: string };
  partner: {
    companyName: string;
    legalName?: string | null;
    inn?: string | null;
    region: string;
    email: string;
    phone: string;
  } | null;
};

const TABS = ["company", "appearance", "modules", "crm"] as const;
type SettingsTab = (typeof TABS)[number];

function parseTab(value: string | null): SettingsTab {
  if (value && (TABS as readonly string[]).includes(value)) {
    return value as SettingsTab;
  }
  return "company";
}

function PartnerSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [leadsEnabled, setLeadsEnabled] = useState(false);

  useEffect(() => {
    setLeadsEnabled(readPartnerModules().leadsEnabled);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await apiFetch<MeResponse>("/api/partner/me");
        setMe(profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить настройки");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canManage = me?.user.role === "partner_owner";

  const companyRows = me?.partner
    ? [
        { label: "Название", value: me.partner.companyName },
        { label: "Юр. название", value: me.partner.legalName || "—" },
        { label: "ИНН", value: me.partner.inn || "—" },
        { label: "Регион", value: me.partner.region },
        { label: "Телефон", value: me.partner.phone },
        { label: "Email компании", value: me.partner.email },
        { label: "Контакт", value: me.user.fullName },
        { label: "Email входа", value: me.user.email }
      ]
    : [];

  function handleTabChange(value: string) {
    const next = parseTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "company") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const query = params.toString();
    router.replace(query ? `/partner/settings?${query}` : "/partner/settings");
  }

  function handleLeadsToggle(checked: boolean) {
    setLeadsEnabled(checked);
    setLeadsModuleEnabled(checked);
    toast.success(checked ? "Модуль «Лиды» включён" : "Модуль «Лиды» выключен");
  }

  return (
    <PartnerShell currentPath="/partner/settings" title="Настройки">
      <PageAlert message={error} variant="destructive" />

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="company">Компания</TabsTrigger>
          <TabsTrigger value="appearance">Внешний вид</TabsTrigger>
          <TabsTrigger value="modules">Модули</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Компания</CardTitle>
              <CardDescription>
                Данные партнёра в дилерской сети Авангард Строй.
              </CardDescription>
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
                    <div
                      key={row.label}
                      className="flex justify-between gap-4 py-2 first:pt-0"
                    >
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="text-right font-medium">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <PartnerTeamPanel canManage={canManage} />
          )}
        </TabsContent>

        <TabsContent value="appearance" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Внешний вид</CardTitle>
              <CardDescription>Тема оформления кабинета.</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Модули</CardTitle>
              <CardDescription>
                Подключаемые разделы кабинета. По умолчанию выключены.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="module-leads" className="text-sm font-medium">
                    Лиды
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Раздел заявок с сайта и ручное создание лидов. Появляется в меню после
                    включения.
                  </p>
                </div>
                <Switch
                  id="module-leads"
                  checked={leadsEnabled}
                  onCheckedChange={handleLeadsToggle}
                  disabled={loading || !canManage}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crm" className="mt-0">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <PartnerCrmPanel canManage={canManage} />
          )}
        </TabsContent>
      </Tabs>
    </PartnerShell>
  );
}

export default function PartnerSettingsPage() {
  return (
    <Suspense
      fallback={
        <PartnerShell currentPath="/partner/settings" title="Настройки">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-64 w-full" />
        </PartnerShell>
      }
    >
      <PartnerSettingsContent />
    </Suspense>
  );
}
