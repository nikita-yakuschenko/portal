"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger
} from "@/components/ui/attachment";
import { apiFetch } from "@/lib/api";
import {
  technologyBadgeCode,
  technologyBadgeVariant
} from "@/lib/catalog-display";
import {
  formatRub,
  resolveDealerDisplayPrice,
  resolveDealerFactoryBase
} from "@/lib/partner-pricing";
import { floorPlanLabel } from "@/lib/floor-plan";
import { cn } from "@/lib/utils";
import { PartnerProjectPricingPanel } from "@/components/partner-project-pricing-panel";
import { PartnerProjectSiteVisibility } from "@/components/partner-project-site-visibility";
import { ProjectSpecsStrip } from "@/components/project-specs-strip";
import {
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconFileText,
  IconHeart,
  IconX
} from "@tabler/icons-react";
import { toast } from "sonner";

type PricingMode = "markup" | "exact" | "on_request";

type PricingHint = {
  pricingMode: PricingMode;
  markupPercent: number | null;
  publicPrice: number | null;
};

const DOC_KIND_LABEL: Record<string, string> = {
  passport: "Паспорт",
  spec: "Спецификация",
  plan: "План",
  manual: "Инструкция",
  other: "Документ"
};

type ProjectDetails = {
  summary?: string;
  mark?: string;
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
  technology: "modular" | "panel_frame";
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
  assets: Array<{
    id: string;
    sourceUrl: string;
    type: string;
    floorNumber?: number | null;
    sortOrder: number;
    isPrimary: boolean;
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

function MetaList({ items }: { items: Array<{ label: string; value: string }> }) {
  const visible = items.filter((item) => item.value.trim() && item.value !== "—");
  if (visible.length === 0) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((item) => (
        <div key={item.label} className="bg-muted rounded-lg px-3 py-2.5">
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">{item.label}</dt>
          <dd className="mt-1 text-sm font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function PartnerCatalogProjectPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
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
    if (searchParams.get("request") === "1") {
      setInquiryOpen(true);
    }
  }, [searchParams]);

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
        const primaryIndex = Math.max(
          0,
          row.assets.findIndex((asset) => asset.isPrimary)
        );
        setActiveIndex(primaryIndex === -1 ? 0 : primaryIndex);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить проект");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const assets = useMemo(() => {
    if (!project) return [];
    return [...project.assets].sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder
    );
  }, [project]);

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
    if (!canManagePricing) return;
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

  const activeAsset = assets[activeIndex] ?? assets[0];
  const details = project?.details;

  function stepPreview(delta: number) {
    if (assets.length < 2) return;
    setActiveIndex((prev) => (prev + delta + assets.length) % assets.length);
  }

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
    if (!project) return;

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
              window.location.href = `/partner/messenger?c=${created.id}`;
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

  return (
    <PartnerShell
      currentPath={`/partner/catalog/${projectId}`}
      breadcrumbs={
        <Breadcrumb>
          <BreadcrumbList className="text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/partner">Главная</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/partner/catalog">Каталог</Link>
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
        <Button type="button" onClick={() => setInquiryOpen(true)} disabled={!project}>
          Запросить информацию
        </Button>
      }
    >
      <PageAlert message={error} variant="destructive" />
      {loading ? <Skeleton className="h-96 w-full" /> : null}

      {!loading && project && details ? (
        <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-3">
          <div className="min-w-0 space-y-4 xl:col-span-2">
            <Card>
              <CardContent className="flex flex-wrap items-stretch justify-between gap-4">
                <div className="flex min-h-full min-w-0 flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight">{project.name}</h2>
                    <Badge variant={technologyBadgeVariant(project.technology)}>
                      {technologyBadgeCode(project.technology)}
                    </Badge>
                    <PartnerProjectSiteVisibility
                      projectId={project.id}
                      canManage={canManagePricing}
                    />
                  </div>
                  <ProjectSpecsStrip
                    className="mt-auto"
                    area={project.area}
                    dimensionsLabel={details.dimensions?.label}
                    floors={project.floors}
                    bedrooms={project.bedrooms}
                    bathrooms={project.bathrooms}
                  />
                </div>
                <div className="shrink-0 self-start text-right">
                  <p className="text-muted-foreground text-xs">Базовая стоимость</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {dealerFactoryBase != null
                      ? `от ${dealerFactoryBase.toLocaleString("ru-RU")}`
                      : "Цена по запросу"}
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs">Ваша цена для покупателя</p>
                  <p className="text-primary text-lg font-semibold tabular-nums">
                    {retailPreview.onRequest || retailPreview.amount == null
                      ? "По запросу"
                      : `от ${formatRub(retailPreview.amount)}`}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="price">
              <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
                <TabsTrigger value="price">Цена</TabsTrigger>
                <TabsTrigger value="packages">Комплектация</TabsTrigger>
                <TabsTrigger value="options">Опции</TabsTrigger>
                <TabsTrigger value="docs" disabled title="Скоро">
                  Документация
                </TabsTrigger>
                <TabsTrigger value="logistics" disabled title="Скоро">
                  Логистика
                </TabsTrigger>
              </TabsList>

              <TabsContent value="price" className="mt-0">
                <Panel>
                  <PartnerProjectPricingPanel
                    panel="price"
                    projectId={project.id}
                    canManage={canManagePricing}
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
                    canManage={canManagePricing}
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
                    canManage={canManagePricing}
                    housePrice={project.basePrice}
                    factoryBasePrice={dealerFactoryBase}
                  />
                </Panel>
              </TabsContent>

              <TabsContent value="docs" className="mt-0">
                <div className="flex flex-col gap-2">
                  {details.techDocs.map((doc) => {
                    const available = Boolean(doc.url);
                    const kindLabel = DOC_KIND_LABEL[doc.kind] ?? "Документ";
                    const description = available
                      ? `${kindLabel} · Доступен`
                      : `${kindLabel} · По запросу`;

                    return (
                      <Attachment
                        key={doc.id}
                        className="w-full max-w-none flex-nowrap"
                        state="done"
                      >
                        <AttachmentMedia>
                          <IconFileText />
                        </AttachmentMedia>
                        <AttachmentContent>
                          <AttachmentTitle>{doc.title}</AttachmentTitle>
                          <AttachmentDescription>{description}</AttachmentDescription>
                        </AttachmentContent>
                        {available && doc.url ? (
                          <>
                            <AttachmentActions>
                              <AttachmentAction asChild aria-label={`Открыть «${doc.title}»`}>
                                <a href={doc.url} target="_blank" rel="noreferrer">
                                  <IconExternalLink />
                                </a>
                              </AttachmentAction>
                            </AttachmentActions>
                            <AttachmentTrigger asChild>
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Открыть «${doc.title}»`}
                              />
                            </AttachmentTrigger>
                          </>
                        ) : null}
                      </Attachment>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="logistics" className="mt-0 space-y-4">
                <Panel>
                  <h4 className="mb-3 text-sm font-semibold">Груз</h4>
                  <MetaList
                    items={[
                      {
                        label: "Состав отгрузки",
                        value: details.cargo.modulesNote ?? "—"
                      },
                      {
                        label: "Габариты / пакеты",
                        value: details.cargo.dimensionsNote ?? "—"
                      },
                      {
                        label: "Масса",
                        value: details.cargo.weightNote ?? "—"
                      },
                      {
                        label: "Упаковка",
                        value: details.cargo.packingNote ?? "—"
                      }
                    ]}
                  />
                </Panel>
                <Panel>
                  <h4 className="mb-3 text-sm font-semibold">Доставка и монтаж</h4>
                  <MetaList
                    items={[
                      {
                        label: "Способ доставки",
                        value: details.transport.method ?? "—"
                      },
                      {
                        label: "Сроки",
                        value: details.transport.leadTimeNote ?? "—"
                      },
                      {
                        label: "Доставка",
                        value: details.transport.deliveryNote ?? "—"
                      },
                      {
                        label: "Разгрузка",
                        value: details.transport.unloadingNote ?? "—"
                      },
                      {
                        label: "Монтаж",
                        value: details.transport.mountingNote ?? "—"
                      }
                    ]}
                  />
                </Panel>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="min-w-0 xl:self-start">
            <Card className="gap-0 overflow-hidden py-0">
              <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden">
                {activeAsset ? (
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="absolute inset-0 cursor-zoom-in focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
                    aria-label={`Открыть фото «${project.name}» на весь экран`}
                  >
                    <img
                      src={activeAsset.sourceUrl}
                      alt={
                        activeAsset.type === "floor_plan"
                          ? floorPlanLabel(activeAsset.floorNumber)
                          : project.name
                      }
                      className="absolute inset-0 size-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
                    Нет фото
                  </div>
                )}
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className="bg-background/90 text-muted-foreground hover:text-primary focus-visible:ring-ring/50 absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-md shadow-sm backdrop-blur transition focus-visible:ring-[3px] focus-visible:outline-none"
                  aria-label={favorite ? "Убрать из избранного" : "В избранное"}
                  aria-pressed={favorite}
                >
                  <IconHeart
                    className={cn(
                      "size-4 transition-transform duration-200 motion-reduce:transition-none",
                      favorite && "scale-110 fill-primary text-primary"
                    )}
                  />
                </button>
              </div>

              {activeAsset?.type === "floor_plan" && activeAsset.floorNumber != null ? (
                <p className="text-muted-foreground border-b px-3 py-2 text-center text-xs font-medium">
                  {floorPlanLabel(activeAsset.floorNumber)}
                </p>
              ) : null}

              {assets.length > 1 ? (
                <div className="grid grid-cols-4 gap-2 p-3">
                  {assets.map((asset, index) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      aria-label={
                        asset.type === "floor_plan"
                          ? floorPlanLabel(asset.floorNumber)
                          : `Показать фото ${index + 1}`
                      }
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-md border transition",
                        index === activeIndex
                          ? "border-primary ring-ring/30 ring-2"
                          : "hover:border-muted-foreground/40"
                      )}
                    >
                      <img
                        src={asset.sourceUrl}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                      />
                      {asset.type === "floor_plan" && asset.floorNumber != null ? (
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-0.5 py-0.5 text-center text-[10px] leading-tight font-medium text-white">
                          {asset.floorNumber} эт.
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </Card>
          </aside>
        </div>
      ) : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/90"
          aria-describedby={undefined}
          className="fixed inset-0 top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              stepPreview(-1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              stepPreview(1);
            }
          }}
        >
          <DialogTitle className="sr-only">
            Просмотр фото{project ? ` — ${project.name}` : ""}
          </DialogTitle>

          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10">
            {activeAsset ? (
              <img
                src={activeAsset.sourceUrl}
                alt={
                  activeAsset.type === "floor_plan"
                    ? floorPlanLabel(activeAsset.floorNumber)
                    : (project?.name ?? "Фото проекта")
                }
                className="max-h-full max-w-full object-contain select-none"
              />
            ) : null}

            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute top-4 right-4 z-10 size-10 rounded-full"
              onClick={() => setPreviewOpen(false)}
              aria-label="Закрыть просмотр"
            >
              <IconX className="size-5" />
            </Button>

            {assets.length > 1 ? (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute top-1/2 left-3 z-10 size-10 -translate-y-1/2 rounded-full sm:left-6"
                  onClick={() => stepPreview(-1)}
                  aria-label="Предыдущее фото"
                >
                  <IconChevronLeft className="size-5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute top-1/2 right-3 z-10 size-10 -translate-y-1/2 rounded-full sm:right-6"
                  onClick={() => stepPreview(1)}
                  aria-label="Следующее фото"
                >
                  <IconChevronRight className="size-5" />
                </Button>
                <p className="text-background absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm tabular-nums backdrop-blur">
                  {activeIndex + 1} / {assets.length}
                </p>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

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
