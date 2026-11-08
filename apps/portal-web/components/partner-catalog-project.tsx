"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PartnerShell } from "@/components/partner-shell";
import {
  FactoryPackagesEditor
} from "@/components/factory-offer-panel";
import { PageAlert } from "@/components/page-alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import {
  ProjectDocsPanel,
  ProjectLogisticsPanel
} from "@/components/project-supply-panels";
import {
  technologyBadgeCode,
  technologyBadgeVariant
} from "@/lib/catalog-display";
import {
  formatRub,
  resolveDealerDisplayPrice,
  resolveDealerFactoryBase
} from "@/lib/partner-pricing";
import { cn } from "@/lib/utils";
import { PartnerProjectPricingPanel } from "@/components/partner-project-pricing-panel";
import { PartnerProjectSiteVisibility } from "@/components/partner-project-site-visibility";
import { ProjectAboutPanel } from "@/components/project-about-panel";
import { ProjectSpecsStrip } from "@/components/project-specs-strip";
import { ProjectSummaryCard } from "@/components/project-summary-card";
import { IconHeart } from "@tabler/icons-react";
import { toast } from "sonner";

type PricingMode = "markup" | "exact" | "on_request";

type PricingHint = {
  pricingMode: PricingMode;
  markupPercent: number | null;
  publicPrice: number | null;
};

type ProjectDetails = {
  summary?: string;
  mark?: string;
  series?: string;
  dimensions?: { lengthM?: number; widthM?: number; label?: string };
  characteristics: Array<{ title: string; value: string }>;
  packages: Array<{ id: string; name: string; price?: number; description?: string }>;
  optionGroups: Array<{
    id: string;
    title: string;
    items: Array<{ id: string; name: string; note?: string }>;
  }>;
  techDocs: Array<{
    id: string;
    title: string;
    kind: string;
    status: "available" | "on_request";
    url?: string;
    note?: string;
  }>;
  cargo: {
    modulesNote?: string;
    dimensionsNote?: string;
    weightNote?: string;
    packingNote?: string;
  };
  transport: {
    method?: string;
    leadTimeNote?: string;
    deliveryNote?: string;
    unloadingNote?: string;
    mountingNote?: string;
  };
};

type Project = {
  id: string;
  name: string;
  description: string;
  technology: "modular" | "panel_frame" | "frame";
  details: ProjectDetails;
  area: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: string | null;
  basePrice: number | null;
  factoryOffer?: {
    importedAt?: string;
    sources?: string[];
    assembly: Array<{ id: string; name: string; price: number }>;
    extras: Array<{ id: string; name: string; price: number }>;
  } | null;
  currency: string;
  projectUrl: string;
  active: boolean;
  assets: Array<{
    id: string;
    sourceUrl: string;
    type: string;
    floorNumber?: number | null;
    sortOrder: number;
    isPrimary: boolean;
  }>;
  rooms: Array<{
    id: string;
    projectId: string;
    floorNumber: number;
    name: string;
    area: number;
    sortOrder: number;
    polygon: Array<{ x: number; y: number }>;
  }>;
};

const FAVORITES_KEY = "avgst.partner.catalog.favorites";

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveFavorites(ids: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

function Panel({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function PartnerCatalogProject({ projectKey }: { projectKey: string }) {
  const searchParams = useSearchParams();
  const projectId = projectKey;

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [canManagePricing, setCanManagePricing] = useState(false);
  const [factorySelectedOptions, setFactorySelectedOptions] = useState<string[]>([]);
  const [pricingHint, setPricingHint] = useState<PricingHint>({
    pricingMode: "on_request",
    markupPercent: null,
    publicPrice: null
  });
  const [savingFactoryOptions, setSavingFactoryOptions] = useState(false);

  useEffect(() => {
    if (searchParams.get("request") !== "1") return;
    if (!project || !project.active) return;
    setInquiryOpen(true);
  }, [searchParams, project]);

  useEffect(() => {
    setFavorite(loadFavorites().has(projectId));
  }, [projectId]);

  useEffect(() => {
    void (async () => {
      try {
        const [row, me, pricing] = await Promise.all([
          apiFetch<Project>(`/api/partner/catalog/projects/${projectId}`),
          apiFetch<{ user: { role: string } }>("/api/partner/me"),
          apiFetch<
            Array<{
              projectId: string;
              pricingMode: PricingMode;
              markupPercent: number | null;
              publicPrice: number | null;
              factorySelectedOptions?: string[];
              displayPrice: number | null;
              displayOnRequest: boolean;
            }>
          >("/api/partner/pricing")
        ]);
        setProject(row);
        setCanManagePricing(me.user.role === "partner_owner");
        const priceRow = pricing.find((item) => item.projectId === projectId);
        if (priceRow) {
          setFactorySelectedOptions(priceRow.factorySelectedOptions ?? []);
          setPricingHint({
            pricingMode: priceRow.pricingMode,
            markupPercent: priceRow.markupPercent,
            publicPrice: priceRow.publicPrice
          });
        }
        setForm({
          subject: `Запрос по проекту «${row.name}»`,
          message: ""
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить проект");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  // База завода = дом + включённые опции; от неё живёт наценка в шапке
  const dealerFactoryBase = useMemo(
    () =>
      project
        ? resolveDealerFactoryBase(project.basePrice, project.factoryOffer, factorySelectedOptions)
        : null,
    [project, factorySelectedOptions]
  );

  const retailPreview = useMemo(
    () =>
      resolveDealerDisplayPrice(dealerFactoryBase, {
        pricingMode: pricingHint.pricingMode,
        markupPercent: pricingHint.markupPercent,
        publicPrice: pricingHint.publicPrice
      }),
    [dealerFactoryBase, pricingHint]
  );

  async function persistFactoryOptions(nextKeys: string[]) {
    setFactorySelectedOptions(nextKeys);
    if (!canManagePricing || project?.active === false) return;
    setSavingFactoryOptions(true);
    try {
      await apiFetch("/api/partner/pricing", {
        method: "PUT",
        body: JSON.stringify({
          projectId,
          pricingMode: pricingHint.pricingMode,
          ...(pricingHint.pricingMode === "markup" && pricingHint.markupPercent != null
            ? { markupPercent: Math.round(pricingHint.markupPercent) }
            : {}),
          ...(pricingHint.pricingMode === "exact" && pricingHint.publicPrice != null
            ? { publicPrice: Math.round(pricingHint.publicPrice) }
            : {}),
          factorySelectedOptions: nextKeys
        })
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить комплектацию");
    } finally {
      setSavingFactoryOptions(false);
    }
  }

  const details = project?.details;

  function toggleFavorite() {
    setFavorite((prev) => {
      const nextFav = !prev;
      const ids = loadFavorites();
      if (nextFav) ids.add(projectId);
      else ids.delete(projectId);
      saveFavorites(ids);
      return nextFav;
    });
  }

  async function handleInquiry(event: React.FormEvent) {
    event.preventDefault();
    if (!project || !project.active) return;

    setSaving(true);
    try {
      const created = await apiFetch<{ id: string; requestNumber: string | null }>(
        "/api/messenger/requests",
        {
          method: "POST",
          body: JSON.stringify({
            title: form.subject,
            body: form.message,
            projectId: project.id
          })
        }
      );
      setForm((prev) => ({ ...prev, message: "" }));
      setInquiryOpen(false);
      toast.success(
        created.requestNumber
          ? `Запрос ${created.requestNumber} создан`
          : "Запрос отправлен",
        {
          action: {
            label: "Открыть",
            onClick: () => {
              window.location.href = `/portal/messenger?c=${created.id}`;
            }
          }
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить запрос");
    } finally {
      setSaving(false);
    }
  }

  const unavailable = Boolean(project && !project.active);
  const canManage = canManagePricing && !unavailable;

  return (
    <PartnerShell
      currentPath={`/portal/catalog/${projectId}`}
      breadcrumbs={
        <Breadcrumb>
          <BreadcrumbList className="text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/portal">Главная</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/portal/catalog">Каталог</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[220px] truncate sm:max-w-md">
                {project?.name ?? "Проект"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      title={project?.name ?? "Проект"}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleFavorite}
            disabled={!project}
            aria-pressed={favorite}
            aria-label={favorite ? "Убрать из избранного" : "В избранное"}
            title={favorite ? "Убрать из избранного" : "В избранное"}
          >
            <IconHeart
              className={cn("size-4", favorite && "fill-primary text-primary")}
            />
          </Button>
          <Button
            type="button"
            onClick={() => setInquiryOpen(true)}
            disabled={!project || unavailable}
            title={
              unavailable ? "Проект снят с публикации и недоступен к заказу" : undefined
            }
          >
            Запросить информацию
          </Button>
        </div>
      }
    >
      <PageAlert message={error} variant="destructive" />
      {loading ? <Skeleton className="h-96 w-full" /> : null}

      {!loading && project && details ? (
        <div className="space-y-4 md:space-y-6">
          {unavailable ? (
            <div
              role="status"
              className="bg-brand-yellow text-brand-yellow-foreground overflow-hidden rounded-xl"
            >
              <p className="px-4 py-2.5 text-center text-xs font-semibold tracking-wide uppercase">
                Проект снят с публикации и недоступен к заказу
              </p>
            </div>
          ) : null}

          <div className={cn("min-w-0 space-y-2", unavailable && "grayscale")}>
            <ProjectSummaryCard
              className={cn(unavailable && "opacity-80")}
              title={
                <h2 className="text-xl font-semibold tracking-tight">{project.name}</h2>
              }
              badge={
                <Badge variant={technologyBadgeVariant(project.technology)}>
                  {technologyBadgeCode(project.technology)}
                </Badge>
              }
              visibility={
                <PartnerProjectSiteVisibility
                  projectId={project.id}
                  canManage={canManage}
                />
              }
              specs={
                <ProjectSpecsStrip
                  className="mt-auto"
                  area={project.area}
                  dimensionsLabel={details.dimensions?.label}
                  blankDimensions
                  floors={project.floors}
                  bedrooms={project.bedrooms}
                  bathrooms={project.bathrooms}
                />
              }
              prices={
                <>
                  <p className="text-muted-foreground text-xs">Базовая стоимость</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {dealerFactoryBase != null
                      ? `от ${dealerFactoryBase.toLocaleString("ru-RU")}`
                      : "Цена по запросу"}
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs">Ваша цена для покупателя</p>
                  <p
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      unavailable ? "text-muted-foreground" : "text-primary"
                    )}
                  >
                    {retailPreview.onRequest || retailPreview.amount == null
                      ? "По запросу"
                      : `от ${formatRub(retailPreview.amount)}`}
                  </p>
                </>
              }
            />

            <Tabs defaultValue="about" className="gap-[15px] md:gap-[23px]">
              <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
                <TabsTrigger value="about">О проекте</TabsTrigger>
                <TabsTrigger value="price">Цена</TabsTrigger>
                <TabsTrigger value="packages">Комплектация</TabsTrigger>
                <TabsTrigger value="options">Опции</TabsTrigger>
                <TabsTrigger value="docs">Документация</TabsTrigger>
                <TabsTrigger value="logistics">Логистика</TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="mt-0">
                <Panel className="pb-[23px]">
                  <ProjectAboutPanel
                    projectName={project.name}
                    description={project.description}
                    seriesLabel={details.series ?? null}
                    assets={project.assets}
                    floors={project.floors}
                    rooms={project.rooms}
                  />
                </Panel>
              </TabsContent>

              <TabsContent value="price" className="mt-0">
                <Panel className="py-4">
                  <PartnerProjectPricingPanel
                    panel="price"
                    projectId={project.id}
                    canManage={canManage}
                    housePrice={project.basePrice}
                    factoryBasePrice={dealerFactoryBase}
                    onDraftChange={(next) => setPricingHint(next)}
                    onSaved={(next) => {
                      setPricingHint({
                        pricingMode: next.pricingMode,
                        markupPercent: next.markupPercent,
                        publicPrice: next.publicPrice
                      });
                    }}
                  />
                </Panel>
              </TabsContent>

              <TabsContent value="packages" className="mt-0">
                <Panel>
                  <FactoryPackagesEditor
                    housePrice={project.basePrice}
                    offer={project.factoryOffer}
                    selectedKeys={factorySelectedOptions}
                    canManage={canManage}
                    saving={savingFactoryOptions}
                    onChange={(next) => {
                      void persistFactoryOptions(next);
                    }}
                  />
                </Panel>
              </TabsContent>

              <TabsContent value="options" className="mt-0">
                <Panel>
                  <PartnerProjectPricingPanel
                    panel="options"
                    projectId={project.id}
                    canManage={canManage}
                    housePrice={project.basePrice}
                    factoryBasePrice={dealerFactoryBase}
                  />
                </Panel>
              </TabsContent>

              <TabsContent value="docs" className="mt-0">
                <ProjectDocsPanel details={details} />
              </TabsContent>

              <TabsContent value="logistics" className="mt-0">
                <ProjectLogisticsPanel details={details} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      ) : null}

      <Dialog open={inquiryOpen} onOpenChange={setInquiryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Запросить информацию</DialogTitle>
            <DialogDescription>
              Уточните комплектацию, документацию, отгрузку или условия поставки
              {project ? ` по проекту «${project.name}»` : ""}. Запрос попадёт в мессенджер
              отдельным тредом.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleInquiry}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="inquiry-subject">Тема</FieldLabel>
                <Input
                  id="inquiry-subject"
                  required
                  value={form.subject}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="inquiry-message">Сообщение</FieldLabel>
                <Textarea
                  id="inquiry-message"
                  required
                  rows={6}
                  placeholder="Например: нужна спецификация Премиум, сроки отгрузки и схема погрузки"
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInquiryOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner /> : null}
                {saving ? "Отправляем…" : "Отправить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PartnerShell>
  );
}
