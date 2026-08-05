"use client";

import type { ReactNode } from "react";
import { IconHeart, IconSearch } from "@tabler/icons-react";

import { FilterControlShell, FilterTrailingSlot } from "@/components/filter-clear";
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

export type CatalogTechnologyFilter = "all" | "modular" | "panel_frame";
export type CatalogFloorsFilter = "all" | "1" | "2";

export type CatalogRangeBounds = { min: number; max: number };

export function catalogFormatPriceRange(value: number): string {
  if (value >= 1_000_000) {
    const mln = value / 1_000_000;
    return `${mln.toLocaleString("ru-RU", { maximumFractionDigits: mln >= 10 ? 0 : 1 })} млн`;
  }
  return value.toLocaleString("ru-RU");
}

export function catalogRangeStep(min: number, max: number): number {
  const span = Math.max(max - min, 1);
  if (span <= 50) return 1;
  if (span <= 500) return 5;
  if (span <= 5_000) return 50;
  if (span <= 500_000) return 10_000;
  return 50_000;
}

function RangeFilterCard({
  title,
  rangeLabel,
  active,
  onClear,
  clearLabel,
  children
}: {
  title: string;
  rangeLabel: string;
  active: boolean;
  onClear: () => void;
  clearLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-[14rem] flex-1 overflow-hidden rounded-xl border sm:min-w-[16rem]">
      <div className="flex items-stretch">
        <div className="min-w-0 flex-1 px-3 py-2.5">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">{rangeLabel}</p>
        </div>
        <FilterTrailingSlot
          mode={active ? "clear" : "empty"}
          onClear={onClear}
          label={clearLabel}
          className="self-stretch"
        />
      </div>
      <div className="px-3 pb-3">{children}</div>
    </div>
  );
}

/** Горизонтальная полоса фильтров каталога — над карточками */
export function CatalogFiltersBar({
  query,
  onQueryChange,
  technology,
  onTechnologyChange,
  floors,
  onFloorsChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  favoritesCount,
  showFavorites = false,
  priceBounds,
  priceRange,
  onPriceRangeChange,
  areaBounds,
  areaRange,
  onAreaRangeChange,
  className
}: {
  query: string;
  onQueryChange: (value: string) => void;
  technology: CatalogTechnologyFilter;
  onTechnologyChange: (value: CatalogTechnologyFilter) => void;
  floors: CatalogFloorsFilter;
  onFloorsChange: (value: CatalogFloorsFilter) => void;
  favoritesOnly?: boolean;
  onFavoritesOnlyChange?: (value: boolean) => void;
  favoritesCount?: number;
  showFavorites?: boolean;
  priceBounds: CatalogRangeBounds | null;
  priceRange: [number, number] | null;
  onPriceRangeChange: (value: [number, number]) => void;
  areaBounds: CatalogRangeBounds | null;
  areaRange: [number, number] | null;
  onAreaRangeChange: (value: [number, number]) => void;
  className?: string;
}) {
  const priceActive =
    Boolean(priceBounds && priceRange) &&
    (priceRange![0] !== priceBounds!.min || priceRange![1] !== priceBounds!.max);
  const areaActive =
    Boolean(areaBounds && areaRange) &&
    (areaRange![0] !== areaBounds!.min || areaRange![1] !== areaBounds!.max);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <FilterControlShell
          active={Boolean(query.trim())}
          className="h-9 min-w-[12rem] flex-1 basis-[14rem]"
        >
          <div className="relative min-w-0 flex-1">
            <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Поиск по названию"
              aria-label="Поиск по названию"
              className="h-9 w-full rounded-none border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
            />
          </div>
          <FilterTrailingSlot
            mode={query.trim() ? "clear" : "empty"}
            onClear={() => onQueryChange("")}
            label="Очистить поиск"
          />
        </FilterControlShell>

        <FilterControlShell
          active={technology !== "all"}
          className="relative h-9 w-full min-w-[10rem] sm:w-[11.5rem] sm:flex-none"
        >
          <Select
            value={technology}
            onValueChange={(value) => onTechnologyChange(value as CatalogTechnologyFilter)}
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
              onClear={() => onTechnologyChange("all")}
              label="Сбросить фильтр технологии"
              className="absolute inset-y-0 right-0 z-10"
            />
          ) : null}
        </FilterControlShell>

        <FilterControlShell
          active={floors !== "all"}
          className="relative h-9 w-full min-w-[8rem] sm:w-[9.5rem] sm:flex-none"
        >
          <Select
            value={floors}
            onValueChange={(value) => onFloorsChange(value as CatalogFloorsFilter)}
          >
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
              onClear={() => onFloorsChange("all")}
              label="Сбросить фильтр этажности"
              className="absolute inset-y-0 right-0 z-10"
            />
          ) : null}
        </FilterControlShell>

        {showFavorites && onFavoritesOnlyChange ? (
          <FilterControlShell
            active={Boolean(favoritesOnly)}
            className="h-9 w-full min-w-[9rem] sm:w-auto sm:flex-none"
          >
            <button
              type="button"
              className={cn(
                "inline-flex h-full min-w-0 flex-1 items-center justify-start gap-2 px-3 text-sm font-medium transition hover:bg-muted/50",
                favoritesOnly && "hover:bg-transparent"
              )}
              aria-pressed={Boolean(favoritesOnly)}
              onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
            >
              <IconHeart
                className={cn(
                  "size-4 shrink-0",
                  favoritesOnly && "fill-primary text-primary"
                )}
              />
              Избранное
              {(favoritesCount ?? 0) > 0 ? (
                <span className="text-muted-foreground tabular-nums">{favoritesCount}</span>
              ) : null}
            </button>
            <FilterTrailingSlot
              mode={favoritesOnly ? "clear" : "empty"}
              onClear={() => onFavoritesOnlyChange(false)}
              label="Сбросить фильтр избранного"
            />
          </FilterControlShell>
        ) : null}
      </div>

      {(priceBounds && priceRange) || (areaBounds && areaRange) ? (
        <div className="flex flex-wrap gap-3">
          {priceBounds && priceRange ? (
            <RangeFilterCard
              title="Цена"
              rangeLabel={`${catalogFormatPriceRange(priceRange[0])} — ${catalogFormatPriceRange(priceRange[1])}`}
              active={priceActive}
              onClear={() => onPriceRangeChange([priceBounds.min, priceBounds.max])}
              clearLabel="Сбросить фильтр цены"
            >
              <Slider
                min={priceBounds.min}
                max={priceBounds.max}
                step={catalogRangeStep(priceBounds.min, priceBounds.max)}
                value={priceRange}
                onValueChange={(value) => {
                  if (value.length >= 2) onPriceRangeChange([value[0]!, value[1]!]);
                }}
                aria-label="Диапазон цены"
              />
            </RangeFilterCard>
          ) : null}

          {areaBounds && areaRange ? (
            <RangeFilterCard
              title="Площадь"
              rangeLabel={`${areaRange[0]} — ${areaRange[1]} м²`}
              active={areaActive}
              onClear={() => onAreaRangeChange([areaBounds.min, areaBounds.max])}
              clearLabel="Сбросить фильтр площади"
            >
              <Slider
                min={areaBounds.min}
                max={areaBounds.max}
                step={catalogRangeStep(areaBounds.min, areaBounds.max)}
                value={areaRange}
                onValueChange={(value) => {
                  if (value.length >= 2) onAreaRangeChange([value[0]!, value[1]!]);
                }}
                aria-label="Диапазон площади"
              />
            </RangeFilterCard>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
