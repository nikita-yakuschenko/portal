"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  IconBath,
  IconBed,
  IconChevronLeft,
  IconChevronRight,
  IconHeart,
  IconShare3,
  IconRulerMeasure,
  IconStairs,
  IconX
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { ZoomableImage } from "@/components/partner-site/zoomable-image";
import {
  ProjectOptionsConfigurator,
  type ConfiguratorSelection
} from "@/components/partner-site/project-options-configurator";
import { apiFetch } from "@/lib/api";
import {
  technologyBadgeCode
} from "@/lib/catalog-display";
import { floorPlanLabel } from "@/lib/floor-plan";
import {
  previewPaths,
  primaryImage,
  groupStorefrontAssets,
  isPublicSitePathname,
  type StorefrontProject
} from "@/lib/partner-site-preview";
import { catalogProseDescription } from "@/lib/strip-html";
import { projectShareCopy } from "@/lib/project-share-copy";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Отделяет цифровую маркировку в конце названия («Барнхаус 115» → 115) */
function splitProjectMark(name: string): { title: string; mark: string } {
  const match = name.trim().match(/^(.*?)(\d+)\s*$/);
  if (!match || !match[1]?.trim()) return { title: name, mark: "" };
  return { title: match[1].trimEnd(), mark: match[2]! };
}

/** Главное фото + карусель миниатюр оверлеем снизу */
function ProjectMediaGallery({
  title,
  assets,
  altPrefix,
  fit = "cover",
  onOpen
}: {
  title: string;
  assets: Array<{ id?: string; sourceUrl: string }>;
  altPrefix: string;
  fit?: "cover" | "contain";
  onOpen: (sourceUrl: string) => void;
}) {
  const [active, setActive] = useState(0);
  const current = assets[Math.min(active, assets.length - 1)];

  if (!current) return null;

  return (
    <section>
      <h2 className="text-xl font-extrabold tracking-tight uppercase">{title}</h2>
      <div className="relative mt-5 overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-black/5">
        <button
          type="button"
          onClick={() => onOpen(current.sourceUrl)}
          className={cn(
            "block w-full transition hover:opacity-95",
            fit === "contain" ? "bg-slate-50" : "bg-slate-900"
          )}
          aria-label={`Открыть: ${altPrefix}`}
        >
          <img
            src={current.sourceUrl}
            alt={`${altPrefix} — ${active + 1}`}
            loading="lazy"
            decoding="async"
            className={cn(
              "w-full",
              fit === "contain"
                ? "max-h-[70vh] object-contain"
                : "aspect-video object-cover"
            )}
          />
        </button>

        {assets.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent pt-16">
            <div className="pointer-events-auto flex gap-2 overflow-x-auto px-3 pt-1.5 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {assets.map((asset, index) => {
                const selected = index === active;
                return (
                  <button
                    key={asset.id ?? asset.sourceUrl + index}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActive(index);
                    }}
                    aria-label={`${altPrefix} ${index + 1}`}
                    aria-pressed={selected}
                    className={cn(
                      "relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-16 sm:w-24",
                      selected
                        ? "border-avgst-yellow"
                        : "border-white/40 hover:border-white/75"
                    )}
                  >
                    <img
                      src={asset.sourceUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={cn(
                        "size-full",
                        fit === "contain" ? "object-contain bg-white" : "object-cover"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Планировки: одна крупная или плитки в ряд с подписью этажа */
function FloorPlansGallery({
  assets,
  onOpen
}: {
  assets: Array<{ id?: string; sourceUrl: string; floorNumber?: number | null }>;
  onOpen: (sourceUrl: string) => void;
}) {
  if (assets.length === 0) return null;

  if (assets.length === 1) {
    const asset = assets[0]!;
    const label = floorPlanLabel(asset.floorNumber);
    return (
      <section>
        <h2 className="text-xl font-extrabold tracking-tight uppercase">Планировка</h2>
        <div className="mt-5 overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-black/5">
          <button
            type="button"
            onClick={() => onOpen(asset.sourceUrl)}
            className="block w-full transition hover:opacity-95"
            aria-label={`Открыть: ${label}`}
          >
            <img
              src={asset.sourceUrl}
              alt={label}
              loading="lazy"
              decoding="async"
              className="max-h-[70vh] w-full object-contain"
            />
          </button>
          <p className="border-t border-black/5 px-4 py-3 text-center text-sm font-medium text-slate-700">
            {label}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-extrabold tracking-tight uppercase">Планировка</h2>
      <div
        className={cn(
          "mt-5 grid gap-4",
          assets.length === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {assets.map((asset, index) => {
          const label = floorPlanLabel(asset.floorNumber);
          return (
            <figure
              key={asset.id ?? asset.sourceUrl + index}
              className="overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-black/5"
            >
              <button
                type="button"
                onClick={() => onOpen(asset.sourceUrl)}
                className="block w-full transition hover:opacity-95"
                aria-label={`Открыть: ${label}`}
              >
                <img
                  src={asset.sourceUrl}
                  alt={label}
                  loading="lazy"
                  decoding="async"
                  className="aspect-video w-full object-contain"
                />
              </button>
              <figcaption className="border-t border-black/5 px-3 py-2.5 text-center text-sm font-medium text-slate-700">
                {label}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

type LightboxItem = { sourceUrl: string; label?: string | null };

export default function PartnerSiteProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const { draft, partnerLegal, partnerId, projects, favorites, toggleFavorite, openLeadForm, loading } =
    usePartnerSitePreview();
  const [detail, setDetail] = useState<StorefrontProject | null>(null);

  const lite = useMemo(() => {
    const key = params.slug;
    if (!key) return null;
    return (
      projects.find((item) => item.slug === key) ??
      projects.find((item) => item.id === key) ??
      null
    );
  }, [projects, params.slug]);

  // Список витрины отдаёт только обложку — полные фото догружаем отдельно.
  // На публичном домене кабинетный API даёт 401 — берём /api/public/...
  useEffect(() => {
    const key = params.slug;
    if (!key) return;

    const onPublicSite =
      typeof window !== "undefined" && isPublicSitePathname(window.location.pathname);

    if (onPublicSite && !partnerId) return;

    let cancelled = false;
    setDetail(null);
    void (async () => {
      try {
        const path =
          onPublicSite && partnerId
            ? `/api/public/sites/${partnerId}/projects/${encodeURIComponent(key)}`
            : `/api/partner/storefront/projects/${encodeURIComponent(key)}`;
        const full = await apiFetch<StorefrontProject>(path);
        if (!cancelled) setDetail(full);
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.slug, partnerId]);

  const project = detail ?? lite;

  const images = useMemo(() => {
    if (!project?.assets?.length) return [];
    return [...project.assets].sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
  }, [project]);

  const groups = useMemo(() => groupStorefrontAssets(images), [images]);

  const [lightbox, setLightbox] = useState<{
    open: boolean;
    items: LightboxItem[];
    index: number;
  }>({ open: false, items: [], index: 0 });

  useEffect(() => {
    setLightbox({ open: false, items: [], index: 0 });
  }, [project?.id]);

  useEffect(() => {
    if (!lightbox.open || lightbox.items.length < 2) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      setLightbox((prev) => {
        if (!prev.open || prev.items.length < 2) return prev;
        const next = prev.index + delta;
        // Без циклов: не уходим за границы раздела
        if (next < 0 || next >= prev.items.length) return prev;
        return { ...prev, index: next };
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox.open, lightbox.items.length]);

  if (!draft) return null;

  if (!project) {
    if (loading) return null;
    return (
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm text-slate-500">Проект не найден или не опубликован на сайте.</p>
        <Button asChild variant="outline" className="mt-6 border-slate-300">
          <Link href={previewPaths.catalog}>К каталогу</Link>
        </Button>
      </div>
    );
  }

  const heroImage = images[0]?.sourceUrl ?? primaryImage(project);
  const { title: projectTitle, mark: projectMark } = splitProjectMark(project.name);
  const isFavorite = favorites.has(project.id);
  const prose = catalogProseDescription(project.details?.summary || project.description);
  const extras = (project.dealerExtras ?? []).filter((group) => group.items.length > 0);
  const priceOnRequest = project.priceOnRequest || project.basePrice == null;
  const priceAmount = priceOnRequest
    ? null
    : project.basePrice!.toLocaleString("ru-RU");

  const specs: Array<{ icon: typeof IconRulerMeasure; label: string; value: string }> = [];
  if (project.area) {
    specs.push({ icon: IconRulerMeasure, label: "Площадь", value: `${project.area} м²` });
  }
  if (project.floors) {
    specs.push({ icon: IconStairs, label: "Этажи", value: String(project.floors) });
  }
  if (project.bedrooms) {
    specs.push({ icon: IconBed, label: "Спальни", value: String(project.bedrooms) });
  }
  if (project.bathrooms) {
    specs.push({ icon: IconBath, label: "Санузлы", value: project.bathrooms });
  }

  const lightboxItem = lightbox.items[lightbox.index] ?? null;
  const lightboxImage = lightboxItem?.sourceUrl ?? null;
  const lightboxLabel = lightboxItem?.label?.trim() || null;
  const canStepPrev = lightbox.index > 0;
  const canStepNext = lightbox.index < lightbox.items.length - 1;

  function step(delta: number) {
    setLightbox((prev) => {
      if (!prev.open || prev.items.length < 2) return prev;
      const next = prev.index + delta;
      if (next < 0 || next >= prev.items.length) return prev;
      return { ...prev, index: next };
    });
  }

  function openLightbox(items: LightboxItem[], sourceUrl: string) {
    const index = items.findIndex((asset) => asset.sourceUrl === sourceUrl);
    setLightbox({
      open: true,
      items,
      index: index >= 0 ? index : 0
    });
  }

  function closeLightbox() {
    setLightbox((prev) => ({ ...prev, open: false }));
  }

  async function shareProject() {
    if (!project) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const company =
      draft?.name.trim() || partnerLegal?.companyName.trim() || "";
    const { title, text } = projectShareCopy(
      {
        name: project.name,
        technology: project.technology,
        floors: project.floors,
        area: project.area,
        bedrooms: project.bedrooms,
        bathrooms: project.bathrooms
      },
      company
    );
    const shareData = { title, text, url };

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch (err) {
      // Пользователь закрыл системный share — не ошибка
      if (err instanceof DOMException && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Ссылка скопирована");
      } catch {
        toast.error("Не удалось поделиться");
      }
    }
  }

  const hasMediaSections =
    groups.floorPlans.length > 0 || groups.exteriors.length > 0 || groups.interiors.length > 0;

  return (
    <>
      <section className="relative min-h-[92svh] overflow-hidden bg-slate-800 md:min-h-[78vh]">
        {heroImage ? (
          <img
            src={heroImage}
            alt={project.name}
            fetchPriority="high"
            decoding="async"
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-700 text-sm text-slate-300">
            Нет фото
          </div>
        )}

        {/* Мобилка: сильный нижний градиент под title+панель; десктоп — мягче + левый затенок */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,18,22,0.45)_0%,rgba(15,18,22,0.12)_32%,rgba(15,18,22,0.55)_62%,rgba(15,18,22,0.92)_100%)] lg:bg-[linear-gradient(180deg,rgba(15,18,22,0.35)_0%,rgba(15,18,22,0.15)_40%,rgba(15,18,22,0.72)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(15,18,22,0.55)_0%,transparent_45%)] lg:block" />

        <div className="relative z-10 mx-auto flex min-h-[92svh] w-full max-w-6xl flex-col px-4 pb-5 pt-24 md:px-6 md:pb-10 md:pt-32 lg:min-h-[78vh]">
          <nav className="flex shrink-0 items-center gap-2 text-sm leading-none text-white/70">
            <Link
              href={previewPaths.catalog}
              className="inline-flex items-center gap-1 transition hover:text-white"
            >
              <IconChevronLeft className="size-4 shrink-0" stroke={1.75} />
              <span>Каталог</span>
            </Link>
            <span className="text-white/35" aria-hidden>
              /
            </span>
            <span className="truncate text-white">{project.name}</span>
          </nav>

          <div className="mt-auto flex flex-col gap-4 pt-16 sm:gap-5 md:gap-5 lg:gap-5">
            <div className="min-w-0 max-w-2xl">
              <Badge className="mb-3 border-0 bg-white/90 px-3 py-1 text-sm font-semibold text-slate-800 shadow-sm sm:mb-4 sm:px-3.5 sm:py-1.5 sm:text-base">
                {technologyBadgeCode(project.technology)}
              </Badge>
              <h1 className="text-[2.35rem] font-extrabold uppercase leading-[0.92] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-[4.25rem]">
                {projectTitle}
                {projectMark ? (
                  <>
                    {" "}
                    <span className="text-avgst-yellow">{projectMark}</span>
                  </>
                ) : null}
              </h1>
            </div>

            <div
              className={cn(
                "relative w-full overflow-hidden rounded-2xl border border-white/25 bg-white/12 shadow-2xl shadow-black/25 backdrop-blur-xl",
                "flex flex-col p-4 sm:p-5",
                "lg:flex-row lg:items-center lg:gap-4 lg:p-3.5 lg:pr-4 xl:gap-5"
              )}
            >
              {specs.length > 0 ? (
                <ul className="flex min-w-0 divide-x divide-white/20 lg:flex-1">
                  {specs.map((spec) => {
                    const Icon = spec.icon;
                    return (
                      <li
                        key={spec.label}
                        className="min-w-0 flex-1 px-1.5 py-0.5 first:pl-0 last:pr-0 sm:px-2.5 lg:px-4 lg:py-1"
                      >
                        {/* Мобилка: компактная колонка в общем ряду; десктоп — крупнее */}
                        <div className="flex flex-col gap-0.5 lg:block">
                          <div className="flex items-center gap-1 text-[0.6rem] font-medium tracking-wide text-white/65 uppercase sm:text-[0.65rem] lg:gap-1.5 lg:text-xs">
                            <Icon className="size-3 shrink-0 text-avgst-yellow lg:size-3.5" stroke={1.75} />
                            <span className="truncate">{spec.label}</span>
                          </div>
                          <p className="text-sm font-extrabold tabular-nums text-avgst-yellow sm:text-base lg:mt-1 lg:text-xl xl:text-2xl">
                            {spec.value}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <div
                className={cn(
                  "mt-3 flex items-center justify-between gap-3 border-t border-white/15 pt-3",
                  "sm:mt-3.5 sm:gap-4 sm:pt-3.5",
                  "lg:mt-0 lg:shrink-0 lg:gap-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4"
                )}
              >
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-medium tracking-wide text-white/65 uppercase sm:text-xs">
                    Стоимость
                  </p>
                  <p className="mt-0.5 text-lg font-extrabold tracking-tight text-white tabular-nums sm:text-xl lg:text-xl xl:text-2xl">
                    {priceAmount == null ? (
                      "Цена по запросу"
                    ) : (
                      <>
                        от {priceAmount}
                        {/* ₽ только на десктопе — на мобилке знак уезжал на отдельную строку */}
                        <span className="hidden lg:inline">&nbsp;₽</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="lg"
                    className="h-10 rounded-md bg-avgst-yellow px-3.5 text-sm font-bold text-slate-950 hover:bg-avgst-yellow/90 sm:px-5"
                    onClick={() =>
                      openLeadForm({
                        kind: "quote",
                        projectName: project.name,
                        technology: project.technology,
                        ...(heroImage ? { projectImageUrl: heroImage } : {})
                      })
                    }
                  >
                    Получить расчёт
                  </Button>
                  <button
                    type="button"
                    onClick={() => void shareProject()}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white focus-visible:ring-[3px] focus-visible:ring-white/40 focus-visible:outline-none"
                    aria-label="Поделиться"
                    title="Поделиться"
                  >
                    <IconShare3 className="size-5" stroke={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(project.id)}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white focus-visible:ring-[3px] focus-visible:ring-white/40 focus-visible:outline-none"
                    aria-label={isFavorite ? "Убрать из избранного" : "В избранное"}
                    aria-pressed={isFavorite}
                  >
                    <IconHeart
                      className={cn(
                        "size-5 transition-transform duration-200",
                        isFavorite && "scale-110 fill-avgst-yellow text-avgst-yellow"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-6 py-10 md:py-14">
        {groups.floorPlans.length > 0 ? (
          <FloorPlansGallery
            assets={groups.floorPlans}
            onOpen={(sourceUrl) =>
              openLightbox(
                groups.floorPlans.map((asset) => ({
                  sourceUrl: asset.sourceUrl,
                  label: floorPlanLabel(asset.floorNumber)
                })),
                sourceUrl
              )
            }
          />
        ) : null}

        {groups.exteriors.length > 0 ? (
          <ProjectMediaGallery
            title={"Возможные варианты фасадов и\u00A0экстерьера"}
            assets={groups.exteriors}
            altPrefix="Экстерьер"
            fit="cover"
            onOpen={(sourceUrl) =>
              openLightbox(
                groups.exteriors.map((asset) => ({
                  sourceUrl: asset.sourceUrl,
                  label: "Экстерьеры"
                })),
                sourceUrl
              )
            }
          />
        ) : null}

        {groups.interiors.length > 0 ? (
          <ProjectMediaGallery
            title="Возможны варианты интерьера"
            assets={groups.interiors}
            altPrefix="Интерьер"
            fit="cover"
            onOpen={(sourceUrl) =>
              openLightbox(
                groups.interiors.map((asset) => ({
                  sourceUrl: asset.sourceUrl,
                  label: "Интерьеры"
                })),
                sourceUrl
              )
            }
          />
        ) : null}

        {prose ? (
          <section className={cn(!hasMediaSections && "mt-0")}>
            <h2 className="text-xl font-extrabold tracking-tight uppercase">О проекте</h2>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">{prose}</p>
          </section>
        ) : null}

        {extras.length > 0 ? (
          <ProjectOptionsConfigurator
            groups={extras}
            basePrice={project.basePrice}
            priceOnRequest={Boolean(project.priceOnRequest)}
            onRequestQuote={(selection: ConfiguratorSelection) =>
              openLeadForm({
                kind: "quote",
                projectName: project.name,
                technology: project.technology,
                ...(heroImage ? { projectImageUrl: heroImage } : {}),
                ...(selection.summaryText
                  ? { selectionSummary: selection.summaryText }
                  : {})
              })
            }
          />
        ) : null}
      </div>

      <Dialog
        open={lightbox.open}
        onOpenChange={(open) => {
          if (!open) closeLightbox();
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/92"
          aria-describedby={undefined}
          className="fixed inset-0 top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 touch-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none overscroll-none sm:max-w-none"
        >
          <DialogTitle className="sr-only">Просмотр фото — {project.name}</DialogTitle>

          <div className="relative flex h-full min-h-0 touch-none flex-col overscroll-none">
            {/* Верх: название раздела / ассета */}
            <div className="relative z-20 flex shrink-0 items-center justify-center px-14 py-4 sm:px-16">
              {lightboxLabel ? (
                <span className="max-w-[min(100%,28rem)] truncate rounded-full bg-white/95 px-4 py-2 text-sm font-semibold tracking-tight text-slate-900 shadow-sm backdrop-blur-sm">
                  {lightboxLabel}
                </span>
              ) : (
                <span className="h-9" aria-hidden />
              )}
              <button
                type="button"
                onClick={closeLightbox}
                aria-label="Закрыть"
                className="absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 sm:right-6"
              >
                <IconX className="size-5" />
              </button>
            </div>

            {/* Центр: pinch-zoom только на фото */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
              {lightboxImage ? (
                <ZoomableImage
                  src={lightboxImage}
                  alt={lightboxLabel ?? project.name}
                  className="absolute inset-0"
                />
              ) : null}

              {lightbox.items.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={!canStepPrev}
                    aria-label="Предыдущее фото"
                    className={cn(
                      "absolute top-1/2 left-2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition sm:left-4 sm:size-11",
                      canStepPrev ? "hover:bg-white/25" : "pointer-events-none opacity-30"
                    )}
                  >
                    <IconChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={!canStepNext}
                    aria-label="Следующее фото"
                    className={cn(
                      "absolute top-1/2 right-2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition sm:right-4 sm:size-11",
                      canStepNext ? "hover:bg-white/25" : "pointer-events-none opacity-30"
                    )}
                  >
                    <IconChevronRight className="size-6" />
                  </button>
                </>
              ) : null}
            </div>

            {/* Низ: только счётчик */}
            <div className="z-20 flex shrink-0 items-center justify-center py-4">
              {lightbox.items.length > 1 ? (
                <p className="rounded-full bg-black/55 px-3 py-1.5 text-sm text-white tabular-nums backdrop-blur-sm">
                  {lightbox.index + 1} / {lightbox.items.length}
                </p>
              ) : (
                <span className="h-8" aria-hidden />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
