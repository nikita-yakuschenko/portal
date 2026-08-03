"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { IconChevronLeft, IconExternalLink } from "@tabler/icons-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
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
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

type PartnerSite = {
  id: string;
  subdomain: string;
  domain: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
  publicUrl: string;
  publishLocked: boolean;
  republishRequestStatus: "pending" | null;
  republishRequestedAt: string | null;
  republishRequestComment: string | null;
};

type PartnerDetail = {
  id: string;
  companyName: string;
  legalName: string | null;
  inn: string | null;
  email: string;
  phone: string;
  region: string;
  status: string;
  createdAt: string;
  site: PartnerSite | null;
};

const TABS = ["overview", "legal", "site", "security"] as const;
type Tab = (typeof TABS)[number];

const partnerStatusLabels: Record<string, string> = {
  active: "Активен",
  pending: "Ожидает",
  suspended: "Приостановлен"
};

function parseTab(value: string | null): Tab {
  if (value && (TABS as readonly string[]).includes(value)) {
    return value as Tab;
  }
  return "overview";
}

function PartnerDetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [inn, setInn] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await apiFetch<PartnerDetail>(`/api/company/partners/${id}`);
      setPartner({
        ...data,
        legalName: data.legalName ?? null,
        inn: data.inn ?? null
      });
      setLegalName(data.legalName ?? "");
      setInn(data.inn ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить партнёра");
      setPartner(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function setTab(next: string) {
    const value = parseTab(next);
    const qs = value === "overview" ? "" : `?tab=${value}`;
    router.replace(`/company/partners/${id}${qs}`);
  }

  async function handleStatus(status: "active" | "suspended") {
    if (!partner) return;
    setSaving(true);
    try {
      const updated = await apiFetch<{ status: string }>(
        `/api/company/partners/${partner.id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) }
      );
      setPartner((prev) => (prev ? { ...prev, status: updated.status } : prev));
      toast.success(status === "active" ? "Партнёр активирован" : "Партнёр приостановлен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить статус");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLegal() {
    if (!partner) return;
    setSaving(true);
    try {
      const updated = await apiFetch<{ legalName: string | null; inn: string | null }>(
        `/api/company/partners/${partner.id}/legal`,
        {
          method: "PATCH",
          body: JSON.stringify({
            legalName: legalName.trim() || null,
            inn: inn.trim() || null
          })
        }
      );
      setPartner((prev) =>
        prev
          ? { ...prev, legalName: updated.legalName ?? null, inn: updated.inn ?? null }
          : prev
      );
      toast.success("Юр. реквизиты обновлены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!partner) return;
    setSaving(true);
    try {
      const result = await apiFetch<{ temporaryPassword: string; email: string }>(
        `/api/company/partners/${partner.id}/reset-password`,
        { method: "POST", body: "{}" }
      );
      setTempPassword(result.temporaryPassword);
      toast.success(`Пароль сброшен для ${result.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сбросить пароль");
    } finally {
      setSaving(false);
    }
  }

  async function runSiteAction(path: string, successMessage: string) {
    if (!partner) return;
    setSaving(true);
    try {
      await apiFetch(`/api/company/sites/${partner.id}/${path}`, { method: "POST" });
      toast.success(successMessage);
      setLoading(true);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Операция не выполнена");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/partners"
      navigation={companyNavigation}
      title={partner?.companyName ?? "Партнёр"}
    >
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/company/partners">
            <IconChevronLeft />
            К списку партнёров
          </Link>
        </Button>
      </div>

      <PageAlert message={error} variant="destructive" />

      {loading && !partner ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : partner ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{partner.companyName}</h1>
            <Badge variant={partner.status === "active" ? "default" : "secondary"}>
              {partnerStatusLabels[partner.status] ?? partner.status}
            </Badge>
            {partner.site ? (
              <>
                <Badge variant={partner.site.status === "published" ? "default" : "secondary"}>
                  Сайт: {partner.site.status === "published" ? "опубликован" : "черновик"}
                </Badge>
                {partner.site.publishLocked ? (
                  <Badge variant="destructive">Публикация заблокирована</Badge>
                ) : null}
                {partner.site.republishRequestStatus === "pending" ? (
                  <Badge variant="outline">Запрос на возобновление</Badge>
                ) : null}
              </>
            ) : null}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="legal">Реквизиты</TabsTrigger>
              <TabsTrigger value="site">Сайт</TabsTrigger>
              <TabsTrigger value="security">Безопасность</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Коммерческие данные</CardTitle>
                  <CardDescription>
                    Правит партнёр в своём кабинете; здесь только просмотр.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-muted-foreground text-xs">Компания</div>
                    <div className="font-medium">{partner.companyName}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Регион</div>
                    <div>{partner.region || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Email</div>
                    <div>{partner.email}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Телефон</div>
                    <div>{partner.phone || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Подключён</div>
                    <div>{new Date(partner.createdAt).toLocaleDateString("ru-RU")}</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Статус партнёра</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {partner.status === "suspended" ? (
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleStatus("active")}
                    >
                      {saving ? <Spinner /> : null}
                      Активировать
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving || partner.status === "pending"}
                      onClick={() => void handleStatus("suspended")}
                    >
                      {saving ? <Spinner /> : null}
                      Приостановить
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="legal" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Юр. реквизиты</CardTitle>
                  <CardDescription>
                    Меняйте юр. название и ИНН только по запросу и при документах.
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-w-lg space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="legal-name">Юр. название</Label>
                    <Input
                      id="legal-name"
                      value={legalName}
                      disabled={saving}
                      onChange={(e) => setLegalName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal-inn">ИНН</Label>
                    <Input
                      id="legal-inn"
                      value={inn}
                      disabled={saving}
                      inputMode="numeric"
                      onChange={(e) => setInn(e.target.value)}
                    />
                  </div>
                  <Button type="button" disabled={saving} onClick={() => void handleSaveLegal()}>
                    {saving ? <Spinner /> : null}
                    Сохранить
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="site" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Сайт партнёра</CardTitle>
                  <CardDescription>
                    Публикация и блокировка со стороны сети. Контент правит дилер у себя.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!partner.site ? (
                    <p className="text-muted-foreground text-sm">
                      Сайт ещё не создан. Появится при первом заходе партнёра в раздел «Сайт».
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-muted-foreground text-xs">Поддомен</div>
                          <div className="font-mono text-sm">
                            {partner.site.subdomain}.avgst.ru
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Свой домен</div>
                          <div>{partner.site.domain?.trim() || "—"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Статус</div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            <Badge
                              variant={
                                partner.site.status === "published" ? "default" : "secondary"
                              }
                            >
                              {partner.site.status === "published" ? "Опубликован" : "Черновик"}
                            </Badge>
                            {partner.site.publishLocked ? (
                              <Badge variant="destructive">Заблокирован</Badge>
                            ) : null}
                            {partner.site.republishRequestStatus === "pending" ? (
                              <Badge variant="outline">Запрос на возобновление</Badge>
                            ) : null}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Ссылка</div>
                          {partner.site.status === "published" ? (
                            <a
                              href={partner.site.publicUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                            >
                              Открыть
                              <IconExternalLink className="size-3.5" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </div>
                      {partner.site.republishRequestComment ? (
                        <p className="text-muted-foreground text-sm">
                          Комментарий к запросу: {partner.site.republishRequestComment}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {partner.site.status === "published" ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={() =>
                              void runSiteAction(
                                "unpublish",
                                "Сайт снят с публикации, публикация заблокирована"
                              )
                            }
                          >
                            Снять с публикации
                          </Button>
                        ) : null}
                        {partner.site.publishLocked ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={saving}
                            onClick={() =>
                              void runSiteAction("unlock-publish", "Публикация разблокирована")
                            }
                          >
                            Разблокировать
                          </Button>
                        ) : null}
                        {partner.site.republishRequestStatus === "pending" ? (
                          <>
                            <Button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void runSiteAction(
                                  "approve-republish",
                                  "Возобновление одобрено, сайт опубликован"
                                )
                              }
                            >
                              Одобрить возобновление
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={saving}
                              onClick={() =>
                                void runSiteAction("reject-republish", "Запрос отклонён")
                              }
                            >
                              Отклонить
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Безопасность</CardTitle>
                  <CardDescription>
                    Сброс пароля владельца кабинета. Новый пароль показывается один раз.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void handleResetPassword()}
                  >
                    {saving ? <Spinner /> : null}
                    Сбросить пароль владельца
                  </Button>
                  {tempPassword ? (
                    <div className="space-y-2">
                      <Label>Временный пароль</Label>
                      <div className="bg-muted/40 rounded-lg border px-3 py-2 font-mono text-sm break-all">
                        {tempPassword}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void navigator.clipboard.writeText(tempPassword)}
                      >
                        Скопировать
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </DashboardShell>
  );
}

export default function CompanyPartnerDetailPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell
          cabinetLabel={companyCabinetLabel}
          currentPath="/company/partners"
          navigation={companyNavigation}
          title="Партнёр"
        >
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-4 h-48 w-full" />
        </DashboardShell>
      }
    >
      <PartnerDetailContent />
    </Suspense>
  );
}
