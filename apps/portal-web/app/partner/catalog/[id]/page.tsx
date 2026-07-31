"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";

import { DashboardShell } from "../../../../components/dashboard-shell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { technologyLabel } from "@/lib/catalog-display";
import { formatRub } from "@/lib/partner-pricing";
import { partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";
import { cn } from "@/lib/utils";
import { PartnerProjectPricingPanel } from "@/components/partner-project-pricing-panel";
import { ExternalLinkIcon, FileTextIcon } from "lucide-react";

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
  currency: string;
  projectUrl: string;
  assets: Array<{
    id: string;
    sourceUrl: string;
    type: string;
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
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="text-xs uppercase tracking-wide text-slate-500">{item.label}</dt>
          <dd className="mt-1 text-sm font-medium text-slate-950">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</div>
  );
}

export default function PartnerCatalogProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ subject: "", message: "" });
  const [canManagePricing, setCanManagePricing] = useState(false);
  const [retailLabel, setRetailLabel] = useState<string | null>(null);

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
              displayPrice: number | null;
              displayOnRequest: boolean;
            }>
          >("/api/partner/pricing")
        ]);
        setProject(row);
        setCanManagePricing(me.user.role === "partner_owner");
        const priceRow = pricing.find((item) => item.projectId === projectId);
        if (priceRow) {
          setRetailLabel(
            priceRow.displayOnRequest || priceRow.displayPrice == null
              ? "по запросу"
              : formatRub(priceRow.displayPrice)
          );
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

  const activeAsset = assets[activeIndex] ?? assets[0];
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
    if (!project) return;

    setSaving(true);
    setNotice("");
    try {
      await apiFetch("/api/partner/inquiries", {
        method: "POST",
        body: JSON.stringify({
          subject: form.subject,
          message: form.message,
          projectId: project.id
        })
      });
      setNotice("Запрос отправлен на завод.");
      setForm((prev) => ({ ...prev, message: "" }));
      setTimeout(() => {
        setInquiryOpen(false);
        setNotice("");
      }, 900);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось отправить запрос");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath={`/partner/catalog/${projectId}`}
      navigation={partnerNavigation}
      breadcrumbs={
        <Breadcrumb>
          <BreadcrumbList className="text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/partner">Обзор</Link>
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
          Запрос на завод
        </Button>
      }
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Загрузка проекта...</p> : null}

      {!loading && project && details ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="min-w-0 space-y-4 xl:col-span-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm font-medium text-avgst-green">
                  {technologyLabel(project.technology)}
                </p>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Заводская</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-950">
                    {project.basePrice
                      ? `от ${project.basePrice.toLocaleString("ru-RU")} ₽`
                      : "Цена по запросу"}
                  </p>
                  {retailLabel ? (
                    <>
                      <p className="mt-2 text-xs text-slate-500">На вашей витрине</p>
                      <p className="text-lg font-semibold tabular-nums text-avgst-green">
                        {retailLabel === "по запросу" ? "По запросу" : `от ${retailLabel}`}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            </section>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="h-auto w-full justify-start gap-1">
                <TabsTrigger value="overview">Обзор</TabsTrigger>
                <TabsTrigger value="price">Цена</TabsTrigger>
                <TabsTrigger value="packages">Комплектации</TabsTrigger>
                <TabsTrigger value="options">Опции</TabsTrigger>
                <TabsTrigger value="docs">Документация</TabsTrigger>
                <TabsTrigger value="cargo">Груз</TabsTrigger>
                <TabsTrigger value="transport">Транспорт</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0">
                <Panel>
                  <MetaList
                    items={[
                      {
                        label: "Площадь",
                        value: project.area ? `${project.area} м²` : "—"
                      },
                      {
                        label: "Габариты",
                        value: details.dimensions?.label ?? "—"
                      },
                      {
                        label: "Этажность",
                        value: project.floors ? String(project.floors) : "—"
                      },
                      {
                        label: "Спальни",
                        value: project.bedrooms ? String(project.bedrooms) : "—"
                      },
                      {
                        label: "Санузлы",
                        value: project.bathrooms || "—"
                      },
                      {
                        label: "Технология",
                        value: technologyLabel(project.technology)
                      }
                    ]}
                  />

                  {details.summary ? (
                    <p className="mt-5 text-sm leading-relaxed text-slate-600">{details.summary}</p>
                  ) : null}

                  {details.characteristics.length > 0 ? (
                    <div className="mt-5 border-t border-slate-100 pt-5">
                      <h4 className="text-sm font-semibold text-slate-950">Характеристики</h4>
                      <ul className="mt-3 divide-y divide-slate-100">
                        {details.characteristics.map((item) => (
                          <li
                            key={`${item.title}-${item.value}`}
                            className="flex items-center justify-between gap-4 py-2 text-sm"
                          >
                            <span className="text-slate-500">{item.title}</span>
                            <span className="font-medium text-slate-950">{item.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Panel>
              </TabsContent>

              <TabsContent value="price" className="mt-0">
                <Panel>
                  <p className="mb-4 text-sm text-slate-500">
                    Описание и фото синхронизируются с заводом. Здесь задаёте розничную цену,
                    наценку и допы для конечного покупателя на вашей витрине.
                  </p>
                  <PartnerProjectPricingPanel
                    projectId={project.id}
                    factoryBasePrice={project.basePrice}
                    canManage={canManagePricing}
                  />
                </Panel>
              </TabsContent>

              <TabsContent value="packages" className="mt-0">
                <Panel>
                  {details.packages.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Состав комплектаций уточняется на заводе. Отправьте запрос — пришлём
                      актуальный прайс.
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {details.packages.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-medium text-slate-950">{item.name}</p>
                            <p className="text-sm font-semibold tabular-nums text-slate-950">
                              {item.price
                                ? `${item.price.toLocaleString("ru-RU")} ₽`
                                : "Цена по запросу"}
                            </p>
                          </div>
                          {item.description ? (
                            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </TabsContent>

              <TabsContent value="options" className="mt-0">
                <Panel>
                  <p className="mb-4 text-sm text-slate-500">
                    {project.technology === "panel_frame"
                      ? "Для панельно-каркасных проектов доступны поставка домокомплекта и сборка в Нижнем Новгороде и Москве; перегородки на деревянном каркасе — для отдельных проектов."
                      : "Возможные опции и допы. Стоимость зависит от проекта — уточняйте на заводе."}
                  </p>
                  <div className="space-y-5">
                    {details.optionGroups.map((group) => (
                      <div key={group.id}>
                        <h4 className="text-sm font-semibold text-slate-950">{group.title}</h4>
                        <ul className="mt-2 space-y-2">
                          {group.items.map((item) => (
                            <li
                              key={item.id}
                              className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              <span className="font-medium text-slate-950">{item.name}</span>
                              {item.note ? (
                                <span className="mt-0.5 block text-slate-500">{item.note}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
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
                          <FileTextIcon />
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
                                  <ExternalLinkIcon />
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

              <TabsContent value="cargo" className="mt-0">
                <Panel>
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
              </TabsContent>

              <TabsContent value="transport" className="mt-0">
                <Panel>
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

          <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-slate-100">
                {activeAsset ? (
                  <img
                    src={activeAsset.sourceUrl}
                    alt={project.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    Нет фото
                  </div>
                )}
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:text-avgst-green"
                  aria-label={favorite ? "Убрать из избранного" : "В избранное"}
                >
                  {favorite ? (
                    <IconHeartFilled size={18} className="text-avgst-green" />
                  ) : (
                    <IconHeart size={18} />
                  )}
                </button>
              </div>

              {assets.length > 1 ? (
                <div className="grid grid-cols-4 gap-2 p-3">
                  {assets.map((asset, index) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-lg border transition",
                        index === activeIndex
                          ? "border-avgst-green ring-2 ring-avgst-green/20"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <img
                        src={asset.sourceUrl}
                        alt={`Ассет ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      ) : null}

      <Dialog open={inquiryOpen} onOpenChange={setInquiryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Запрос на завод</DialogTitle>
            <DialogDescription>
              Уточните комплектацию, документацию, отгрузку или условия поставки
              {project ? ` по проекту «${project.name}»` : ""}.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleInquiry}>
            <div className="space-y-1.5">
              <Label htmlFor="inquiry-subject">Тема</Label>
              <Input
                id="inquiry-subject"
                required
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inquiry-message">Сообщение</Label>
              <Textarea
                id="inquiry-message"
                required
                rows={6}
                placeholder="Например: нужна спецификация Премиум, сроки отгрузки и схема погрузки"
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              />
            </div>
            {notice ? <p className="text-sm text-slate-600">{notice}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInquiryOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Отправляем..." : "Отправить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
