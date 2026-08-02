"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconHeart, IconSearch, IconSearchOff, IconX } from "@tabler/icons-react";

import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { PartnerSiteProjectCard } from "@/components/partner-site/project-card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TECHNOLOGY_LABELS } from "@/lib/catalog-display";
import { cn } from "@/lib/utils";

type TechnologyFilter = "all" | "modular" | "panel_frame";
type FloorsFilter = "all" | "1" | "2";
type SortBy = "default" | "price" | "area";

function parseTechnologyFilter(value: string | null): TechnologyFilter {
  if (value === "modular" || value === "panel_frame") return value;
  return "all";
}

/** Красный крестик сброса внутри плашки фильтра */
function FilterClearButton({
  visible,
  onClear,
  label,
  className
}: {
  visible: boolean;
  onClear: () => void;
  label: string;
  className?: string;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "absolute z-10 flex size-5 items-center justify-center rounded text-red-500 transition hover:bg-red-50 hover:text-red-600",
        className ?? "top-1/2 right-2 -translate-y-1/2"
      )}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClear();
      }}
    >
      <IconX className="size-3.5 stroke-[2.25]" />
    </button>
  );
}

function formatPriceRange(value: number): string {
  if (value >= 1_000_000) {
    const mln = value / 1_000_000;
    return `${mln.toLocaleString("ru-RU", { maximumFractionDigits: mln >= 10 ? 0 : 1 })} млн\u00A0₽`;
  }
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function rangeStep(min: number, max: number): number {
  const span = Math.max(max - min, 1);
  if (span <= 50) return 1;
  if (span <= 500) return 5;
  if (span <= 5_000) return 50;
  if (span <= 500_000) return 10_000;
  return 50_000;
}

function PartnerSiteProjectsContent() {
  const { draft, projects, favorites, toggleFavorite } = usePartnerSitePreview();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [technology, setTechnology] = useState<TechnologyFilter>(() =>
    parseTechnologyFilter(searchParams.get("technology"))
  );
  const [floors, setFloors] = useState<FloorsFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [areaRange, setAreaRange] = useState<[number, number] | null>(null);

  // Ссылки из подвала / смена URL → фильтр технологии
  useEffect(() => {
    setTechnology(parseTechnologyFilter(searchParams.get("technology")));
  }, [searchParams]);

  function setTechnologyFilter(value: TechnologyFilter) {
    setTechnology(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("technology");
    else params.set("technology", value);
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  const priceBounds = useMemo(() => {
    const prices = projects
      .map((project) =>
        project.priceOnRequest || project.basePrice == null ? null : project.basePrice
      )
      .filter((value): value is number => value != null);
    if (prices.length === 0) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [projects]);

  const areaBounds = useMemo(() => {
    const areas = projects
      .map((project) => project.area)
      .filter((value): value is number => value != null);
    if (areas.length === 0) return null;
    return { min: Math.min(...areas), max: Math.max(...areas) };
  }, [projects]);

  // Границы каталога → полный диапазон по умолчанию
  useEffect(() => {
    if (!priceBounds) {
      setPriceRange(null);
      return;
    }
    setPriceRange([priceBounds.min, priceBounds.max]);
  }, [priceBounds?.min, priceBounds?.max]);

  useEffect(() => {
    if (!areaBounds) {
      setAreaRange(null);
      return;
    }
    setAreaRange([areaBounds.min, areaBounds.max]);
  }, [areaBounds?.min, areaBounds?.max]);

  const priceActive =
    Boolean(priceBounds && priceRange) &&
    (priceRange![0] !== priceBounds!.min || priceRange![1] !== priceBounds!.max);
  const areaActive =
    Boolean(areaBounds && areaRange) &&
    (areaRange![0] !== areaBounds!.min || areaRange![1] !== areaBounds!.max);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const rows = projects.filter((project) => {
      if (favoritesOnly && !favorites.has(project.id)) return false;
      if (technology !== "all" && project.technology !== technology) return false;
      if (q && !project.name.toLowerCase().includes(q)) return false;
      if (floors === "1" && project.floors !== 1) return false;
      if (floors === "2" && project.floors !== 2) return false;

      if (priceActive && priceRange) {
        if (project.priceOnRequest || project.basePrice == null) return false;
        if (project.basePrice < priceRange[0] || project.basePrice > priceRange[1]) {
          return false;
        }
      }

      if (areaActive && areaRange) {
        if (project.area == null) return false;
        if (project.area < areaRange[0] || project.area > areaRange[1]) return false;
      }

      return true;
    });

    rows.sort((a, b) => {
      if (sortBy === "default") return 0;
      if (sortBy === "area") {
        return (b.area ?? 0) - (a.area ?? 0);
      }
      const aPrice = a.priceOnRequest || a.basePrice == null ? Number.MAX_SAFE_INTEGER : a.basePrice;
      const bPrice = b.priceOnRequest || b.basePrice == null ? Number.MAX_SAFE_INTEGER : b.basePrice;
      return aPrice - bPrice;
    });

    return rows;
  }, [
    projects,
    query,
    technology,
    floors,
    sortBy,
    favoritesOnly,
    favorites,
    priceActive,
    priceRange,
    areaActive,
    areaRange
  ]);

  const hasActiveFilters =
    Boolean(query.trim()) ||
    technology !== "all" ||
    floors !== "all" ||
    favoritesOnly ||
    priceActive ||
    areaActive;

  function resetFilters() {
    setQuery("");
    setTechnologyFilter("all");
    setFloors("all");
    setFavoritesOnly(false);
    if (priceBounds) setPriceRange([priceBounds.min, priceBounds.max]);
    if (areaBounds) setAreaRange([areaBounds.min, areaBounds.max]);
  }

  if (!draft) return null;

  const sliderClassName =
    "[&_[data-slot=slider-range]]:bg-avgst-green [&_[data-slot=slider-thumb]]:border-avgst-green";

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {draft.catalogTitle || "Проекты"}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600">
          {draft.catalogText || "Выберите дом по площади и планировке."}
        </p>
      </div>

      <div className="relative mt-6 space-y-3">
        <button
          type="button"
          onClick={resetFilters}
          disabled={!hasActiveFilters}
          aria-hidden={!hasActiveFilters}
          tabIndex={hasActiveFilters ? 0 : -1}
          className={cn(
            "absolute right-0 -top-6 text-sm font-medium text-avgst-green underline-offset-4 transition hover:underline disabled:pointer-events-none",
            !hasActiveFilters && "invisible"
          )}
        >
          Сбросить фильтры
        </button>

        {/* Верхний ряд на всю ширину — правый край совпадает с нижним */}
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-[220px]">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию"
              aria-label="Поиск по названию"
              className={cn("w-full border-slate-300 bg-white pl-9", query.trim() && "pr-9")}
            />
            <FilterClearButton
              visible={Boolean(query.trim())}
              onClear={() => setQuery("")}
              label="Очистить поиск"
            />
          </div>

          <div className="relative shrink-0">
            <Select
              value={technology}
              onValueChange={(value) => setTechnologyFilter(value as TechnologyFilter)}
            >
              <SelectTrigger
                className={cn(
                  "w-[200px] border-slate-300 bg-white",
                  technology !== "all" && "pr-9 [&>svg:last-child]:hidden"
                )}
                aria-label="Технология"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">Технология: все</SelectItem>
                <SelectItem value="modular">{TECHNOLOGY_LABELS.modular}</SelectItem>
                <SelectItem value="panel_frame">{TECHNOLOGY_LABELS.panel_frame}</SelectItem>
              </SelectContent>
            </Select>
            <FilterClearButton
              visible={technology !== "all"}
              onClear={() => setTechnologyFilter("all")}
              label="Сбросить фильтр технологии"
            />
          </div>

          <div className="relative shrink-0">
            <Select value={floors} onValueChange={(value) => setFloors(value as FloorsFilter)}>
              <SelectTrigger
                className={cn(
                  "w-[150px] border-slate-300 bg-white",
                  floors !== "all" && "pr-9 [&>svg:last-child]:hidden"
                )}
                aria-label="Этажность"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">Этажи: все</SelectItem>
                <SelectItem value="1">1 этаж</SelectItem>
                <SelectItem value="2">2 этажа</SelectItem>
              </SelectContent>
            </Select>
            <FilterClearButton
              visible={floors !== "all"}
              onClear={() => setFloors("all")}
              label="Сбросить фильтр этажности"
            />
          </div>

          <div className="relative shrink-0">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
              <SelectTrigger className="w-[160px] border-slate-300 bg-white" aria-label="Сортировка">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="default">По умолчанию</SelectItem>
                <SelectItem value="price">По цене</SelectItem>
                <SelectItem value="area">По площади</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className={cn(
              "inline-flex h-9 shrink-0 items-center overflow-hidden rounded-lg border border-slate-300",
              favoritesOnly ? "bg-secondary" : "bg-white"
            )}
          >
            <button
              type="button"
              className={cn(
                "inline-flex h-full items-center gap-2 px-3 text-sm font-medium transition hover:bg-slate-50",
                favoritesOnly && "hover:bg-transparent"
              )}
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((value) => !value)}
            >
              <IconHeart
                className={cn(
                  "size-4",
                  favoritesOnly ? "fill-avgst-green text-avgst-green" : "text-slate-700"
                )}
              />
              Избранное
              {favorites.size > 0 ? (
                <span className="tabular-nums text-slate-500">{favorites.size}</span>
              ) : null}
            </button>
            {favoritesOnly ? (
              <button
                type="button"
                aria-label="Сбросить фильтр избранного"
                className="inline-flex h-full items-center border-l border-slate-200 px-2 text-red-500 transition hover:bg-red-50 hover:text-red-600"
                onClick={() => setFavoritesOnly(false)}
              >
                <IconX className="size-3.5 stroke-[2.25]" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Нижний ряд: на ту же ширину, что и верхний */}
        {(priceBounds && priceRange) || (areaBounds && areaRange) ? (
          <div className="grid w-full gap-3 md:grid-cols-2">
            {priceBounds && priceRange ? (
              <div className="relative rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="pr-6">
                  <p className="text-sm font-medium text-slate-900">Цена</p>
                  <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                    {formatPriceRange(priceRange[0])} — {formatPriceRange(priceRange[1])}
                  </p>
                </div>
                <FilterClearButton
                  visible={priceActive}
                  onClear={() => setPriceRange([priceBounds.min, priceBounds.max])}
                  label="Сбросить фильтр цены"
                  className="top-3 right-3"
                />
                <Slider
                  className={cn("mt-4", sliderClassName)}
                  min={priceBounds.min}
                  max={priceBounds.max}
                  step={rangeStep(priceBounds.min, priceBounds.max)}
                  value={priceRange}
                  onValueChange={(value) => {
                    if (value.length >= 2) setPriceRange([value[0]!, value[1]!]);
                  }}
                  aria-label="Диапазон цены"
                />
              </div>
            ) : (
              <div className="hidden md:block" aria-hidden />
            )}

            {areaBounds && areaRange ? (
              <div className="relative rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="pr-6">
                  <p className="text-sm font-medium text-slate-900">Площадь</p>
                  <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                    {areaRange[0]} — {areaRange[1]} м²
                  </p>
                </div>
                <FilterClearButton
                  visible={areaActive}
                  onClear={() => setAreaRange([areaBounds.min, areaBounds.max])}
                  label="Сбросить фильтр площади"
                  className="top-3 right-3"
                />
                <Slider
                  className={cn("mt-4", sliderClassName)}
                  min={areaBounds.min}
                  max={areaBounds.max}
                  step={rangeStep(areaBounds.min, areaBounds.max)}
                  value={areaRange}
                  onValueChange={(value) => {
                    if (value.length >= 2) setAreaRange([value[0]!, value[1]!]);
                  }}
                  aria-label="Диапазон площади"
                />
              </div>
            ) : (
              <div className="hidden md:block" aria-hidden />
            )}
          </div>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <p className="mt-10 text-sm text-slate-500">Пока нет опубликованных проектов.</p>
      ) : filtered.length === 0 ? (
        <Empty className="mt-8 border border-slate-200 bg-white">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconSearchOff />
            </EmptyMedia>
            <EmptyTitle>Ничего не найдено</EmptyTitle>
            <EmptyDescription>
              {favoritesOnly && favorites.size === 0
                ? "В избранном пока пусто — отметьте проекты сердечком на карточке."
                : "Снимите фильтры или измените поисковый запрос."}
            </EmptyDescription>
          </EmptyHeader>
          {hasActiveFilters ? (
            <EmptyContent>
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-medium text-avgst-green underline-offset-4 transition hover:underline"
              >
                Сбросить фильтры
              </button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <PartnerSiteProjectCard
              key={project.id}
              project={project}
              ctaLabel="Посмотреть проект"
              favorite={favorites.has(project.id)}
              onToggleFavorite={() => toggleFavorite(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PartnerSiteProjectsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-12" aria-busy="true" />}>
      <PartnerSiteProjectsContent />
    </Suspense>
  );
}
