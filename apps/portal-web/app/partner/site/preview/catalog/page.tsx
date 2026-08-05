"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconHeart, IconSearch, IconSearchOff, IconX } from "@tabler/icons-react";

import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { PartnerSiteProjectCard } from "@/components/partner-site/project-card";
import { HomeContactsSection } from "@/components/partner-site/home-contacts-section";
import { FilterControlShell, FilterTrailingSlot } from "@/components/filter-clear";
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

function formatPriceRange(value: number): string {
  if (value >= 1_000_000) {
    const mln = value / 1_000_000;
    return `${mln.toLocaleString("ru-RU", { maximumFractionDigits: mln >= 10 ? 0 : 1 })} млн`;
  }
  return value.toLocaleString("ru-RU");
}

function rangeStep(min: number, max: number): number {
  const span = Math.max(max - min, 1);
  if (span <= 50) return 1;
  if (span <= 500) return 5;
  if (span <= 5_000) return 50;
  if (span <= 500_000) return 10_000;
  return 50_000;
}

/** Карточка диапазона: сброс — крестик в правом верхнем углу */
function RangeFilterCard({
  title,
  active,
  disabled = false,
  onClear,
  clearLabel,
  children
}: {
  title: string;
  active: boolean;
  disabled?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-slate-200 bg-white",
        disabled && "opacity-55"
      )}
    >
      {active && !disabled && onClear ? (
        <button
          type="button"
          aria-label={clearLabel || "Сбросить"}
          className="absolute top-2.5 right-2.5 z-10 inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          onClick={onClear}
        >
          <IconX className="size-3.5 stroke-[2.25]" />
        </button>
      ) : null}
      <div className={cn("px-4 pt-3 pb-1", active && !disabled && "pr-10")}>
        <p className="text-sm font-medium text-slate-900">{title}</p>
      </div>
      <div className="px-4 pt-2 pb-3">{children}</div>
    </div>
  );
}

function thumbPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

/** Значения под каждым ползунком; при disabled — нули по краям */
function LabeledRangeSlider({
  min,
  max,
  value,
  onValueChange,
  formatValue,
  disabled = false,
  className,
  "aria-label": ariaLabel
}: {
  min: number;
  max: number;
  value: [number, number];
  onValueChange?: (value: [number, number]) => void;
  formatValue: (value: number) => string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const lo = disabled ? 0 : value[0];
  const hi = disabled ? 0 : value[1];
  const loPct = disabled ? 0 : thumbPercent(value[0], min, max);
  const hiPct = disabled ? 100 : thumbPercent(value[1], min, max);

  return (
    <div>
      <Slider
        className={className}
        min={disabled ? 0 : min}
        max={disabled ? 100 : max}
        step={disabled ? 1 : rangeStep(min, max)}
        value={disabled ? [0, 0] : value}
        disabled={disabled}
        onValueChange={(next) => {
          if (disabled || !onValueChange || next.length < 2) return;
          onValueChange([next[0]!, next[1]!]);
        }}
        aria-label={ariaLabel}
      />
      <div className="relative mt-2.5 h-4">
        <span
          className="absolute top-0 max-w-[50%] truncate text-xs tabular-nums text-slate-500"
          style={{
            left: `${loPct}%`,
            transform: loPct < 8 ? "none" : loPct > 92 ? "translateX(-100%)" : "translateX(-50%)"
          }}
        >
          {formatValue(lo)}
        </span>
        <span
          className="absolute top-0 max-w-[50%] truncate text-xs tabular-nums text-slate-500"
          style={{
            left: `${hiPct}%`,
            transform: hiPct < 8 ? "none" : hiPct > 92 ? "translateX(-100%)" : "translateX(-50%)"
          }}
        >
          {formatValue(hi)}
        </span>
      </div>
    </div>
  );
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
    <>
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
          <FilterControlShell
            active={Boolean(query.trim())}
            className="min-w-0 flex-1 basis-[220px]"
          >
            <div className="relative min-w-0 flex-1">
              <IconSearch className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию"
                aria-label="Поиск по названию"
                className="h-9 w-full rounded-none border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
              />
            </div>
            <FilterTrailingSlot
              mode={query.trim() ? "clear" : "empty"}
              onClear={() => setQuery("")}
              label="Очистить поиск"
            />
          </FilterControlShell>

          <FilterControlShell active={technology !== "all"} className="relative w-[200px] shrink-0">
            <Select
              value={technology}
              onValueChange={(value) => setTechnologyFilter(value as TechnologyFilter)}
            >
              <SelectTrigger
                className={cn(
                  "h-9 w-full rounded-none border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0",
                  technology !== "all" && "[&>svg:last-child]:invisible"
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
            {technology !== "all" ? (
              <FilterTrailingSlot
                mode="clear"
                onClear={() => setTechnologyFilter("all")}
                label="Сбросить фильтр технологии"
                className="absolute inset-y-0 right-0 z-10"
              />
            ) : null}
          </FilterControlShell>

          <FilterControlShell active={floors !== "all"} className="relative w-[150px] shrink-0">
            <Select value={floors} onValueChange={(value) => setFloors(value as FloorsFilter)}>
              <SelectTrigger
                className={cn(
                  "h-9 w-full rounded-none border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0",
                  floors !== "all" && "[&>svg:last-child]:invisible"
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
            {floors !== "all" ? (
              <FilterTrailingSlot
                mode="clear"
                onClear={() => setFloors("all")}
                label="Сбросить фильтр этажности"
                className="absolute inset-y-0 right-0 z-10"
              />
            ) : null}
          </FilterControlShell>

          <FilterControlShell className="w-[160px] shrink-0">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
              <SelectTrigger
                className="h-9 w-full rounded-none border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0"
                aria-label="Сортировка"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="default">По умолчанию</SelectItem>
                <SelectItem value="price">По цене</SelectItem>
                <SelectItem value="area">По площади</SelectItem>
              </SelectContent>
            </Select>
          </FilterControlShell>

          <FilterControlShell active={favoritesOnly} className="shrink-0">
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
            <FilterTrailingSlot
              mode={favoritesOnly ? "clear" : "empty"}
              onClear={() => setFavoritesOnly(false)}
              label="Сбросить фильтр избранного"
            />
          </FilterControlShell>
        </div>

        {/* Нижний ряд: цена всегда; без цен — неактивна с нулями. Значения у ползунков */}
        <div className="grid w-full gap-3 md:grid-cols-2">
          {priceBounds && priceRange ? (
            <RangeFilterCard
              title="Цена"
              active={priceActive}
              onClear={() => setPriceRange([priceBounds.min, priceBounds.max])}
              clearLabel="Сбросить фильтр цены"
            >
              <LabeledRangeSlider
                className={cn(sliderClassName)}
                min={priceBounds.min}
                max={priceBounds.max}
                value={priceRange}
                formatValue={formatPriceRange}
                onValueChange={setPriceRange}
                aria-label="Диапазон цены"
              />
            </RangeFilterCard>
          ) : (
            <RangeFilterCard title="Цена" active={false} disabled>
              <LabeledRangeSlider
                className={cn(sliderClassName)}
                min={0}
                max={100}
                value={[0, 0]}
                formatValue={(v) => v.toLocaleString("ru-RU")}
                disabled
                aria-label="Диапазон цены"
              />
            </RangeFilterCard>
          )}

          {areaBounds && areaRange ? (
            <RangeFilterCard
              title="Площадь"
              active={areaActive}
              onClear={() => setAreaRange([areaBounds.min, areaBounds.max])}
              clearLabel="Сбросить фильтр площади"
            >
              <LabeledRangeSlider
                className={cn(sliderClassName)}
                min={areaBounds.min}
                max={areaBounds.max}
                value={areaRange}
                formatValue={(v) => `${v} м²`}
                onValueChange={setAreaRange}
                aria-label="Диапазон площади"
              />
            </RangeFilterCard>
          ) : (
            <div className="hidden md:block" aria-hidden />
          )}
        </div>
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

      <HomeContactsSection />
    </>
  );
}

export default function PartnerSiteProjectsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-12" aria-busy="true" />}>
      <PartnerSiteProjectsContent />
    </Suspense>
  );
}
