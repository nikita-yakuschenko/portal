"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { PartnerCrmPanel } from "@/components/partner-crm-panel";
import { PartnerShell } from "@/components/partner-shell";
import { PartnerTeamPanel } from "@/components/partner-team-panel";
import { SettingRow, SettingRows } from "@/components/partner-site/setting-row";
import { PageAlert } from "@/components/page-alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";

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

const TABS = ["company", "team", "integrations"] as const;
type SettingsTab = (typeof TABS)[number];

function parseTab(value: string | null): SettingsTab {
  if (value === "crm") return "integrations";
  if (value === "modules") return "company";
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
  const [savedForm, setSavedForm] = useState<ProfileForm | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await apiFetch<MeResponse>("/api/partner/me");
        setMe(profile);
        if (profile.partner) {
          const next = {
            companyName: profile.partner.companyName,
            region: profile.partner.region,
            phone: profile.partner.phone,
            email: profile.partner.email
          };
          setForm(next);
          setSavedForm(next);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить настройки");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canManage = me?.user.role === "partner_owner";
  const legalFilled = Boolean(me?.partner?.legalName?.trim() || me?.partner?.inn?.trim());
  const dirty = useMemo(() => {
    if (!savedForm) return false;
    return (
      form.companyName !== savedForm.companyName ||
      form.region !== savedForm.region ||
      form.phone !== savedForm.phone ||
      form.email !== savedForm.email
    );
  }, [form, savedForm]);

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
      const next = {
        companyName: updated.companyName,
        region: updated.region,
        phone: updated.phone,
        email: updated.email
      };
      setForm(next);
      setSavedForm(next);
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

      <Tabs value={tab} activationMode="manual" onValueChange={handleTabChange}>
        <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="company">Компания</TabsTrigger>
          <TabsTrigger value="team">Сотрудники</TabsTrigger>
          <TabsTrigger value="integrations">Интеграции</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Коммерческие данные</CardTitle>
              <CardDescription>
                Коммерческое название попадает в копирайт подвала сайта. Юр. реквизиты партнёр не
                меняет сам.
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
                <form className="space-y-2" onSubmit={(e) => void handleSaveProfile(e)}>
                  <SettingRows>
                    <SettingRow
                      label="Коммерческое название"
                      htmlFor="company-name"
                      description="В шапке кабинета и в подвале сайта."
                    >
                      <Input
                        id="company-name"
                        value={form.companyName}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, companyName: e.target.value }))
                        }
                      />
                    </SettingRow>
                    <SettingRow
                      label="Регион"
                      htmlFor="company-region"
                      description="Где работаете с покупателями."
                    >
                      <Input
                        id="company-region"
                        value={form.region}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, region: e.target.value }))
                        }
                      />
                    </SettingRow>
                    <SettingRow
                      label="Телефон"
                      htmlFor="company-phone"
                      description="Контакт компании в кабинете."
                    >
                      <Input
                        id="company-phone"
                        type="tel"
                        value={form.phone}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                      />
                    </SettingRow>
                    <SettingRow
                      label="Email компании"
                      htmlFor="company-email"
                      description="Публичная почта компании, не обязательно логин."
                    >
                      <Input
                        id="company-email"
                        type="email"
                        value={form.email}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                      />
                    </SettingRow>
                  </SettingRows>

                  {canManage ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                      <p className="text-muted-foreground text-sm" aria-live="polite">
                        {dirty ? "Есть несохранённые правки" : "Все правки сохранены"}
                      </p>
                      <Button type="submit" disabled={saving || !dirty}>
                        {saving ? "Сохранение…" : "Сохранить"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground pt-4 text-sm">
                      Редактировать может только владелец кабинета.
                    </p>
                  )}
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Юридические реквизиты</CardTitle>
              <CardDescription>
                Берутся из заявки на подключение и попадают в договоры и в подвал сайта. Партнёр
                их не редактирует: менять — администратору завода и только по документам.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : legalFilled ? (
                <dl className="divide-border divide-y text-sm">
                  <div className="flex justify-between gap-4 py-2 first:pt-0">
                    <dt className="text-muted-foreground">Юр. название</dt>
                    <dd className="text-right font-medium">
                      {me?.partner?.legalName?.trim() || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2 last:pb-0">
                    <dt className="text-muted-foreground">ИНН</dt>
                    <dd className="text-right font-medium tabular-nums">
                      {me?.partner?.inn?.trim() || "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                // Прочерки ничего не объясняли: партнёр не знает, кто их вносит
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-muted-foreground max-w-prose text-sm">
                    Реквизиты пока не заполнены — в договорах и в подвале сайта будет только
                    коммерческое название. Пришлите карточку компании заводу, и их внесут.
                  </p>
                  <Button type="button" variant="outline" asChild>
                    <a href="/partner/messenger">Написать заводу</a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="team" className="mt-0">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <PartnerTeamPanel canManage={canManage} />
          )}
        </TabsContent>

        <TabsContent value="integrations" className="mt-0">
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
