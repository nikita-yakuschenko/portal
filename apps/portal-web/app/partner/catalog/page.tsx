"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconCircleCheck,
  IconEyeOff,
  IconGripVertical,
  IconHeart,
  IconSearch,
  IconSearchOff,
  IconX
} from "@tabler/icons-react";
import { toast } from "sonner";

import { CatalogProjectCard } from "@/components/catalog-project-card";
import { FilterControlShell, FilterTrailingSlot } from "@/components/filter-clear";
import {
  CatalogViewToggle,
  type CatalogViewMode
} from "@/components/catalog-view-toggle";
import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import {
  TECHNOLOGY_LABELS,
  technologyBadgeCode,
  technologyBadgeVariant
} from "@/lib/catalog-display";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  description: string;
  technology: "modular" | "panel_frame";
  area: number | null;
  floors: number | null;
  bedrooms: number | null;
  basePrice: number | null;
  active: boolean;
  assets?: Array<{ sourceUrl: string; isPrimary: boolean; sortOrder?: number }>;
};

type PricingRow = {
  projectId: string;
  pricingMode: "markup" | "exact" | "on_request";
  markupPercent: number | null;
  publicPrice: number | null;
  isPublished: boolean;
  displayPrice: number | null;
  displayOnRequest: boolean;
  extras: Array<{
    id: string;
    title: string;
    items: Array<{ id: string; name: string; price?: number; note?: string }>;
  }>;
};

type TechnologyFilter = "all" | "modular" | "panel_frame";
type FloorsFilter = "all" | "1" | "2";

const FAVORITES_KEY = "avgst.partner.catalog.favorites";
const VIEW_KEY = "avgst.partner.catalog.view";

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

function loadViewMode(): CatalogViewMode {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    return raw === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

function formatRub(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("ru-RU");
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

function SortableCard({
  id,
  disabled,
  children
}: {
  id: string;
  disabled?: boolean;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    ...(disabled !== undefined ? { disabled } : {})
  });

  const dragHandle =
    !disabled ? (
      <button
        type="button"
        className="bg-background/90 text-muted-foreground hover:text-foreground inline-flex size-9 cursor-grab items-center justify-center rounded-md shadow-sm backdrop-blur active:cursor-grabbing"
        aria-label="Перетащить для изменения порядка"
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <IconGripVertical className="size-4" />
      </button>
    ) : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={cn(isDragging && "z-20 opacity-90 relative")}
    >
      {children(dragHandle)}
    </div>
  );
}

function SortableTableRow({
  id,
  disabled,
  children,
  ...rowProps
}: {
  id: string;
  disabled?: boolean;
  children: ReactNode;
} & React.ComponentProps<typeof TableRow>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    ...(disabled !== undefined ? { disabled } : {})
  });

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={cn(isDragging && "bg-muted/50 relative z-20")}
      {...rowProps}
    >
      <TableCell className="w-10">
        {!disabled ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex size-8 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
            aria-label="Перетащить для изменения порядка"
            {...attributes}
            {...listeners}
          >
            <IconGripVertical className="size-4" />
          </button>
        ) : null}
      </TableCell>
      {children}
    </TableRow>
  );
}

export default function PartnerCatalogPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [pricingById, setPricingById] = useState<Record<string, PricingRow>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [technology, setTechnology] = useState<TechnologyFilter>("all");
  const [floors, setFloors] = useState<FloorsFilter>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [viewMode, setViewMode] = useState<CatalogViewMode>("cards");
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [areaRange, setAreaRange] = useState<[number, number] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );

  useEffect(() => {
    setFavorites(loadFavorites());
    setViewMode(loadViewMode());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [catalog, pricing] = await Promise.all([
          apiFetch<Project[]>("/api/partner/catalog/projects"),
          apiFetch<PricingRow[]>("/api/partner/pricing").catch(() => [])
        ]);
        setProjects(catalog);
        setPricingById(Object.fromEntries(pricing.map((row) => [row.projectId, row])));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить каталог");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const priceBounds = useMemo(() => {
    const prices = projects
      .map((project) => project.basePrice)
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

    return projects.filter((project) => {
      if (favoritesOnly && !favorites.has(project.id)) return false;
      if (technology !== "all" && project.technology !== technology) return false;
      if (q && !project.name.toLowerCase().includes(q)) return false;
      if (floors === "1" && project.floors !== 1) return false;
      if (floors === "2" && project.floors !== 2) return false;

      if (priceActive && priceRange) {
        if (project.basePrice == null) return false;
        if (project.basePrice < priceRange[0] || project.basePrice > priceRange[1]) return false;
      }

      if (areaActive && areaRange) {
        if (project.area == null) return false;
        if (project.area < areaRange[0] || project.area > areaRange[1]) return false;
      }

      return true;
    });
  }, [
    projects,
    query,
    technology,
    floors,
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

  // DnD только без фильтров — иначе порядок на сайте разъедется с видимым списком
  const canReorder = !hasActiveFilters && !loading && projects.length > 1;

  const selectedCount = selected.size;
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((project) => selected.has(project.id));
  const someFilteredSelected =
    !allFilteredSelected && filtered.some((project) => selected.has(project.id));

  function changeViewMode(next: CatalogViewMode) {
    setViewMode(next);
    localStorage.setItem(VIEW_KEY, next);
  }

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }

  function toggleSelected(id: string, nextSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (nextSelected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAllFiltered(nextSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const project of filtered) {
        if (nextSelected) next.add(project.id);
        else next.delete(project.id);
      }
      return next;
    });
  }

  function resetFilters() {
    setQuery("");
    setTechnology("all");
    setFloors("all");
    setFavoritesOnly(false);
    if (priceBounds) setPriceRange([priceBounds.min, priceBounds.max]);
    if (areaBounds) setAreaRange([areaBounds.min, areaBounds.max]);
  }

  async function persistOrder(nextProjects: Project[]) {
    setOrderSaving(true);
    try {
      await apiFetch("/api/partner/catalog/order", {
        method: "PUT",
        body: JSON.stringify({ projectIds: nextProjects.map((project) => project.id) })
      });
      toast.success("Порядок каталога сохранён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить порядок");
    } finally {
      setOrderSaving(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!canReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = projects.findIndex((project) => project.id === active.id);
    const newIndex = projects.findIndex((project) => project.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(projects, oldIndex, newIndex);
    setProjects(next);
    void persistOrder(next);
  }

  async function applyBulkPublish(isPublished: boolean) {
    const ids = [...selected];
    if (ids.length === 0 || bulkSaving) return;

    setBulkSaving(true);
    setError("");
    try {
      const results = await Promise.allSettled(
        ids.map((projectId) => {
          const current = pricingById[projectId];
          return apiFetch("/api/partner/pricing", {
            method: "PUT",
            body: JSON.stringify({
              projectId,
              pricingMode: current?.pricingMode ?? "on_request",
              markupPercent: current?.markupPercent ?? undefined,
              publicPrice: current?.publicPrice ?? undefined,
              isPublished,
              extras: current?.extras ?? []
            })
          });
        })
      );

      const pricing = await apiFetch<PricingRow[]>("/api/partner/pricing").catch(() => []);
      setPricingById(Object.fromEntries(pricing.map((row) => [row.projectId, row])));

      const ok = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.length - ok;

      if (failed === 0) {
        toast.success(
          isPublished ? `Опубликовано проектов: ${ok}` : `Снято с публикации: ${ok}`
        );
        setSelected(new Set());
      } else if (ok > 0) {
        toast.error(`Обновлено ${ok}, не удалось: ${failed}`);
        setSelected((prev) => {
          const next = new Set(prev);
          results.forEach((result, index) => {
            if (result.status === "fulfilled") next.delete(ids[index]!);
          });
          return next;
        });
      } else {
        toast.error("Не удалось обновить публикацию. Нужна роль владельца партнёра.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить публикацию");
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <PartnerShell currentPath="/partner/catalog">
      <PageAlert message={error} variant="destructive" />

      <div className="flex flex-wrap items-center gap-2">
        {selectedCount > 0 ? (
          <>
            <Button
              type="button"
              disabled={bulkSaving}
              onClick={() => void applyBulkPublish(true)}
            >
              {bulkSaving ? <Spinner /> : <IconCircleCheck />}
              Опубликовать
              <span className="tabular-nums">{selectedCount}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={bulkSaving}
              onClick={() => void applyBulkPublish(false)}
            >
              {bulkSaving ? <Spinner /> : <IconEyeOff />}
              Снять с публикации
              <span className="tabular-nums">{selectedCount}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={bulkSaving}
              onClick={() => setSelected(new Set())}
            >
              <IconX />
              Снять выбор
            </Button>
          </>
        ) : null}

        {orderSaving ? (
          <p className="text-muted-foreground text-sm">Сохранение порядка…</p>
        ) : !canReorder && hasActiveFilters ? (
          <p className="text-muted-foreground text-sm">
            Сбросьте фильтры, чтобы менять порядок проектов
          </p>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            aria-hidden={!hasActiveFilters}
            tabIndex={hasActiveFilters ? 0 : -1}
            className={cn(
              "text-primary text-sm font-medium underline-offset-4 transition hover:underline disabled:pointer-events-none",
              !hasActiveFilters && "invisible"
            )}
          >
            Сбросить фильтры
          </button>
          <CatalogViewToggle value={viewMode} onChange={changeViewMode} />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          {loading ? (
            viewMode === "cards" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-video w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <Skeleton className="h-96 w-full rounded-xl" />
            )
          ) : filtered.length === 0 ? (
            <Empty className="border">
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
                    className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                  >
                    Сбросить фильтры
                  </button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {viewMode === "cards" ? (
                <SortableContext
                  items={filtered.map((project) => project.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((project) => (
                      <SortableCard
                        key={project.id}
                        id={project.id}
                        disabled={!canReorder}
                      >
                        {(dragHandle) => (
                          <CatalogProjectCard
                            href={`/partner/catalog/${project.id}`}
                            name={project.name}
                            description={project.description}
                            technology={project.technology}
                            area={project.area}
                            floors={project.floors}
                            bedrooms={project.bedrooms}
                            basePrice={project.basePrice}
                            retailPrice={pricingById[project.id]?.displayPrice ?? null}
                            retailOnRequest={
                              pricingById[project.id]?.displayOnRequest ?? false
                            }
                            isPublished={pricingById[project.id]?.isPublished ?? false}
                            assets={project.assets ?? []}
                            favorite={favorites.has(project.id)}
                            onToggleFavorite={() => toggleFavorite(project.id)}
                            selected={selected.has(project.id)}
                            onSelectedChange={(next) => toggleSelected(project.id, next)}
                            dragHandle={dragHandle}
                            requestInfoHref={`/partner/catalog/${project.id}?request=1`}
                          />
                        )}
                      </SortableCard>
                    ))}
                  </div>
                </SortableContext>
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead className="w-10">
                          <Checkbox
                            checked={
                              allFilteredSelected
                                ? true
                                : someFilteredSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(value) =>
                              toggleSelectAllFiltered(value === true)
                            }
                            aria-label="Выбрать все на странице"
                          />
                        </TableHead>
                        <TableHead className="w-10">Статус</TableHead>
                        <TableHead>Проект</TableHead>
                        <TableHead>Технология</TableHead>
                        <TableHead className="text-right">Площадь</TableHead>
                        <TableHead className="text-right">Этажи</TableHead>
                        <TableHead className="text-right">Спальни</TableHead>
                        <TableHead className="text-right">Завод</TableHead>
                        <TableHead className="text-right">Ваша цена</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext
                        items={filtered.map((project) => project.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {filtered.map((project) => {
                          const pricing = pricingById[project.id];
                          const published = pricing?.isPublished ?? false;
                          const retailOnRequest = pricing?.displayOnRequest ?? false;
                          const retailPrice = pricing?.displayPrice ?? null;
                          const hasRetail = retailPrice != null || retailOnRequest;
                          const isFavorite = favorites.has(project.id);
                          const isSelected = selected.has(project.id);

                          return (
                            <SortableTableRow
                              key={project.id}
                              id={project.id}
                              disabled={!canReorder}
                              data-state={isSelected ? "selected" : undefined}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(value) =>
                                    toggleSelected(project.id, value === true)
                                  }
                                  aria-label={`Выбрать ${project.name}`}
                                />
                              </TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    "inline-flex",
                                    published ? "text-primary" : "text-muted-foreground"
                                  )}
                                  title={
                                    published ? "Опубликован на сайте" : "Скрыт с сайта"
                                  }
                                  aria-label={
                                    published ? "Опубликован на сайте" : "Скрыт с сайта"
                                  }
                                >
                                  {published ? (
                                    <IconCircleCheck className="size-4" />
                                  ) : (
                                    <IconEyeOff className="size-4" />
                                  )}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Link
                                  href={`/partner/catalog/${project.id}`}
                                  className="hover:text-primary font-medium underline-offset-4 hover:underline"
                                >
                                  {project.name}
                                </Link>
                              </TableCell>
                              <TableCell>
                                <Badge variant={technologyBadgeVariant(project.technology)}>
                                  {technologyBadgeCode(project.technology)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {project.area != null ? `${project.area} м²` : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {project.floors ?? "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {project.bedrooms ?? "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {project.basePrice ? formatRub(project.basePrice) : "По запросу"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {!hasRetail
                                  ? "—"
                                  : retailOnRequest || retailPrice == null
                                    ? "По запросу"
                                    : formatRub(retailPrice)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={
                                    isFavorite ? "Убрать из избранного" : "В избранное"
                                  }
                                  aria-pressed={isFavorite}
                                  onClick={() => toggleFavorite(project.id)}
                                >
                                  <IconHeart
                                    className={cn(isFavorite && "fill-primary text-primary")}
                                  />
                                </Button>
                              </TableCell>
                            </SortableTableRow>
                          );
                        })}
                      </SortableContext>
                    </TableBody>
                  </Table>
                </div>
              )}
            </DndContext>
          )}
        </div>

        <aside className="w-full shrink-0 space-y-3 lg:sticky lg:top-6 lg:w-72">
          <FilterControlShell
            active={Boolean(query.trim())}
            className="h-9 w-full min-w-0"
          >
            <div className="relative min-w-0 flex-1">
              <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" />
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

          <FilterControlShell active={technology !== "all"} className="relative h-9 w-full min-w-0">
            <Select
              value={technology}
              onValueChange={(value) => setTechnology(value as TechnologyFilter)}
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
                onClear={() => setTechnology("all")}
                label="Сбросить фильтр технологии"
                className="absolute inset-y-0 right-0 z-10"
              />
            ) : null}
          </FilterControlShell>

          <FilterControlShell active={floors !== "all"} className="relative h-9 w-full min-w-0">
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

          <FilterControlShell active={favoritesOnly} className="h-9 w-full min-w-0">
            <button
              type="button"
              className={cn(
                "inline-flex h-full min-w-0 flex-1 items-center justify-start gap-2 px-3 text-sm font-medium transition hover:bg-muted/50",
                favoritesOnly && "hover:bg-transparent"
              )}
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((value) => !value)}
            >
              <IconHeart
                className={cn(
                  "size-4 shrink-0",
                  favoritesOnly && "fill-primary text-primary"
                )}
              />
              Избранное
              {favorites.size > 0 ? (
                <span className="text-muted-foreground tabular-nums">{favorites.size}</span>
              ) : null}
            </button>
            <FilterTrailingSlot
              mode={favoritesOnly ? "clear" : "empty"}
              onClear={() => setFavoritesOnly(false)}
              label="Сбросить фильтр избранного"
            />
          </FilterControlShell>

          {priceBounds && priceRange ? (
            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-stretch">
                <div className="min-w-0 flex-1 px-3 py-3">
                  <p className="text-sm font-medium">Цена</p>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                    {formatPriceRange(priceRange[0])} — {formatPriceRange(priceRange[1])}
                  </p>
                </div>
                <FilterTrailingSlot
                  mode={priceActive ? "clear" : "empty"}
                  onClear={() => setPriceRange([priceBounds.min, priceBounds.max])}
                  label="Сбросить фильтр цены"
                  className="self-stretch"
                />
              </div>
              <div className="px-3 pb-3">
                <Slider
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
            </div>
          ) : null}

          {areaBounds && areaRange ? (
            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-stretch">
                <div className="min-w-0 flex-1 px-3 py-3">
                  <p className="text-sm font-medium">Площадь</p>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                    {areaRange[0]} — {areaRange[1]} м²
                  </p>
                </div>
                <FilterTrailingSlot
                  mode={areaActive ? "clear" : "empty"}
                  onClear={() => setAreaRange([areaBounds.min, areaBounds.max])}
                  label="Сбросить фильтр площади"
                  className="self-stretch"
                />
              </div>
              <div className="px-3 pb-3">
                <Slider
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
            </div>
          ) : null}
        </aside>
      </div>
    </PartnerShell>
  );
}
