"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { PartnerCrmPanel } from "@/components/partner-crm-panel";
import { PartnerShell } from "@/components/partner-shell";
import { PartnerTeamPanel } from "@/components/partner-team-panel";
import { PageAlert } from "@/components/page-alert";
import { ThemeSettings } from "@/components/theme-settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import {
  readPartnerModules,
  setLeadsModuleEnabled
} from "@/lib/partner-modules";

type PartnerProfile = {
  companyName: string;
  legalName?: string | null;
  inn?: string | null;
  region: string;
  email: string;
  phone: string;
};

type MeResponse = {
  user: { fullName: string; email: string; role: string };
  partner: PartnerProfile | null;
};

type ProfileForm = {
  companyName: string;
  region: string;
  phone: string;
  email: string;
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
  const [form, setForm] = useState<ProfileForm>({
    companyName: "",
    region: "",
    phone: "",
    email: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leadsEnabled, setLeadsEnabled] = useState(false);

  useEffect(() => {
    setLeadsEnabled(readPartnerModules().leadsEnabled);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await apiFetch<MeResponse>("/api/partner/me");
        setMe(profile);
        if (profile.partner) {
          setForm({
            companyName: profile.partner.companyName,
            region: profile.partner.region,
            phone: profile.partner.phone,
            email: profile.partner.email
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить настройки");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canManage = me?.user.role === "partner_owner";

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

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      const updated = await apiFetch<PartnerProfile>("/api/partner/profile", {
        method: "PATCH",
        body: JSON.stringify(form)
      });
      setMe((prev) =>
        prev
          ? {
              ...prev,
              partner: prev.partner
                ? {
                    ...prev.partner,
                    companyName: updated.companyName,
                    region: updated.region,
                    phone: updated.phone,
                    email: updated.email
                  }
                : prev.partner
            }
          : prev
      );
      setForm({
        companyName: updated.companyName,
        region: updated.region,
        phone: updated.phone,
        email: updated.email
      });
      toast.success("Данные компании сохранены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
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
              <CardTitle>Коммерческие данные</CardTitle>
              <CardDescription>
                Коммерческое название попадает в копирайт подвала сайта. Юр. реквизиты
                партнёр не меняет сам.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((row) => (
                    <Skeleton key={row} className="h-10 w-full" />
                  ))}
                </div>
              ) : !me?.partner ? (
                <p className="text-muted-foreground text-sm">Нет данных о компании.</p>
              ) : (
                <form className="space-y-4" onSubmit={(e) => void handleSaveProfile(e)}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="company-name">Коммерческое название</Label>
                      <Input
                        id="company-name"
                        value={form.companyName}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, companyName: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-region">Регион</Label>
                      <Input
                        id="company-region"
                        value={form.region}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, region: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Телефон</Label>
                      <Input
                        id="company-phone"
                        value={form.phone}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="company-email">Email компании</Label>
                      <Input
                        id="company-email"
                        type="email"
                        value={form.email}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {canManage ? (
                    <Button type="submit" disabled={saving}>
                      {saving ? "Сохранение…" : "Сохранить"}
                    </Button>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Редактировать может только владелец кабинета.
                    </p>
                  )}
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Юр. реквизиты</CardTitle>
              <CardDescription>
                Юр. название и ИНН меняет администратор завода по запросу и при
                подтверждающих документах.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <dl className="divide-border divide-y text-sm">
                  <div className="flex justify-between gap-4 py-2 first:pt-0">
                    <dt className="text-muted-foreground">Юр. название</dt>
                    <dd className="text-right font-medium">
                      {me?.partner?.legalName?.trim() || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">ИНН</dt>
                    <dd className="text-right font-medium">
                      {me?.partner?.inn?.trim() || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">Контакт</dt>
                    <dd className="text-right font-medium">{me?.user.fullName}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2 last:pb-0">
                    <dt className="text-muted-foreground">Email входа</dt>
                    <dd className="text-right font-medium">{me?.user.email}</dd>
                  </div>
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
