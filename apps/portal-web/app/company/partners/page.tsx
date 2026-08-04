"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { IconChevronRight, IconUsers } from "@tabler/icons-react";
import { toast } from "sonner";

import { CompanyPartnerApplicationsPanel } from "@/components/company-partner-applications-panel";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

type Partner = {
  id: string;
  companyName: string;
  legalName: string | null;
  inn: string | null;
  email: string;
  phone: string;
  region: string;
  status: string;
  createdAt: string;
};

type SiteRow = {
  partnerId: string;
  status: "draft" | "published";
  publishLocked: boolean;
  republishRequestStatus: "pending" | null;
};

const partnerStatusLabels: Record<string, string> = {
  active: "Активен",
  pending: "Ожидает",
  suspended: "Приостановлен"
};

const TABS = ["partners", "applications"] as const;
type Tab = (typeof TABS)[number];

function parseTab(value: string | null): Tab {
  if (value && (TABS as readonly string[]).includes(value)) {
    return value as Tab;
  }
  return "partners";
}

function CompanyPartnersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [partners, setPartners] = useState<Partner[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    companyName: "",
    fullName: "",
    email: "",
    phone: "",
    region: "",
    password: "",
    legalName: "",
    inn: ""
  });
  const [saving, setSaving] = useState(false);

  const siteByPartner = useMemo(() => {
    const map = new Map<string, SiteRow>();
    for (const site of sites) map.set(site.partnerId, site);
    return map;
  }, [sites]);

  const load = useCallback(async () => {
    try {
      setError("");
      const [partnerRows, siteRows] = await Promise.all([
        apiFetch<Partner[]>("/api/company/partners"),
        apiFetch<SiteRow[]>("/api/company/sites").catch(() => [] as SiteRow[])
      ]);
      setPartners(
        partnerRows.map((row) => ({
          ...row,
          legalName: row.legalName ?? null,
          inn: row.inn ?? null
        }))
      );
      setSites(siteRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить партнёров");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setTab(next: string) {
    const value = parseTab(next);
    const qs = value === "partners" ? "" : `?tab=${value}`;
    router.replace(`/company/partners${qs}`);
  }

  async function handleCreate() {
    if (!createForm.email.trim() || !createForm.companyName.trim()) {
      toast.error("Укажите компанию и email");
      return;
    }
    setSaving(true);
    try {
      const result = await apiFetch<{
        created: boolean;
        temporaryPassword?: string;
        email: string;
      }>("/api/company/partners", {
        method: "POST",
        body: JSON.stringify({
          email: createForm.email.trim(),
          companyName: createForm.companyName.trim(),
          fullName: createForm.fullName.trim() || undefined,
          phone: createForm.phone.trim() || undefined,
          region: createForm.region.trim() || undefined,
          password: createForm.password.trim() || undefined,
          legalName: createForm.legalName.trim() || null,
          inn: createForm.inn.trim() || null
        })
      });
      const password = result.temporaryPassword;
      if (password) {
        toast.success("Партнёр создан", {
          description: `Пароль: ${password}`,
          duration: Infinity,
          closeButton: true,
          action: {
            label: "Скопировать",
            onClick: () => void navigator.clipboard.writeText(password)
          }
        });
      } else {
        toast.success("Партнёр создан");
      }
      setCreateForm({
        companyName: "",
        fullName: "",
        email: "",
        phone: "",
        region: "",
        password: "",
        legalName: "",
        inn: ""
      });
      setCreateOpen(false);
      setLoading(true);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать партнёра");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell
      cabinetKind="company"
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/partners"
      navigation={companyNavigation}
      title="Партнёры"
    >
      <PageAlert message={error} variant="destructive" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="partners">Партнёры</TabsTrigger>
          <TabsTrigger value="applications">Заявки на подключение</TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle>Список партнёров</CardTitle>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                Создать партнёра
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((row) => (
                    <Skeleton key={row} className="h-12 w-full" />
                  ))}
                </div>
              ) : partners.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <IconUsers />
                    </EmptyMedia>
                    <EmptyTitle>Партнёров пока нет</EmptyTitle>
                    <EmptyDescription>
                      Создайте партнёра вручную или одобрите заявку во вкладке «Заявки на
                      подключение».
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Компания</TableHead>
                        <TableHead>Регион</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Сайт</TableHead>
                        <TableHead>Подключён</TableHead>
                        <TableHead className="w-[1%]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((partner) => {
                        const site = siteByPartner.get(partner.id);
                        return (
                          <TableRow key={partner.id} className="group">
                            <TableCell>
                              <Link
                                href={`/company/partners/${partner.id}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {partner.companyName}
                              </Link>
                              <div className="text-muted-foreground text-xs">{partner.email}</div>
                            </TableCell>
                            <TableCell>{partner.region}</TableCell>
                            <TableCell>
                              <Badge variant={partner.status === "active" ? "default" : "secondary"}>
                                {partnerStatusLabels[partner.status] ?? partner.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {!site ? (
                                <span className="text-muted-foreground text-sm">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  <Badge
                                    variant={site.status === "published" ? "default" : "secondary"}
                                  >
                                    {site.status === "published" ? "Опубликован" : "Черновик"}
                                  </Badge>
                                  {site.publishLocked ? (
                                    <Badge variant="destructive">Заблок.</Badge>
                                  ) : null}
                                  {site.republishRequestStatus === "pending" ? (
                                    <Badge variant="outline">Запрос</Badge>
                                  ) : null}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {new Date(partner.createdAt).toLocaleDateString("ru-RU")}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                asChild
                                title="Открыть карточку"
                              >
                                <Link href={`/company/partners/${partner.id}`}>
                                  <IconChevronRight />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <CompanyPartnerApplicationsPanel
            onChanged={() => {
              setLoading(true);
              void load();
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={(open) => !saving && setCreateOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать партнёра</DialogTitle>
            <DialogDescription>
              Без заявки. Если пароль не указать — сгенерируем и покажем один раз.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="create-company">Компания</Label>
              <Input
                id="create-company"
                value={createForm.companyName}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, companyName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">Контакт</Label>
              <Input
                id="create-name"
                value={createForm.fullName}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email входа</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Телефон</Label>
              <Input
                id="create-phone"
                value={createForm.phone}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-region">Регион</Label>
              <Input
                id="create-region"
                value={createForm.region}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, region: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="create-password">Пароль (необязательно)</Label>
              <Input
                id="create-password"
                type="text"
                value={createForm.password}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Минимум 8 символов или пусто"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-legal">Юр. название</Label>
              <Input
                id="create-legal"
                value={createForm.legalName}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, legalName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-inn">ИНН</Label>
              <Input
                id="create-inn"
                value={createForm.inn}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, inn: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Отмена
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleCreate()}>
              {saving ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

export default function CompanyPartnersPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell
          cabinetKind="company"
          cabinetLabel={companyCabinetLabel}
          currentPath="/company/partners"
          navigation={companyNavigation}
          title="Партнёры"
        >
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-4 h-64 w-full" />
        </DashboardShell>
      }
    >
      <CompanyPartnersContent />
    </Suspense>
  );
}
