"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconBuildingStore, IconExternalLink, IconSearchOff } from "@tabler/icons-react";

import { CatalogProjectCard } from "@/components/catalog-project-card";
import {
  CatalogFiltersBar,
  type CatalogFloorsFilter,
  type CatalogTechnologyFilter
} from "@/components/catalog-filters-bar";
import {
  CatalogViewToggle,
  type CatalogViewMode
} from "@/components/catalog-view-toggle";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { UpdateFactoryPricesButton } from "@/components/update-factory-prices-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";
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
  projectUrl: string;
  active: boolean;
  assets?: Array<{ sourceUrl: string; isPrimary: boolean; sortOrder?: number }>;
};

const VIEW_KEY = "avgst.company.catalog.view";

function loadView(): CatalogViewMode {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    return raw === "cards" || raw === "table" ? raw : "cards";
  } catch {
    return "cards";
  }
}

function CatalogCardSkeleton() {
  return (
    <Card className="grid grid-rows-[auto_1fr] gap-0 overflow-hidden py-0">
      <div className="relative w-full shrink-0 pt-[56.25%]">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-[55%]" />
            <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
          </div>
          <Skeleton className="h-4 w-[45%]" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </Card>
  );
}

export default function CompanyCatalogPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CatalogViewMode>("cards");
  const [query, setQuery] = useState("");
  const [technology, setTechnology] = useState<CatalogTechnologyFilter>("all");
  const [floors, setFloors] = useState<CatalogFloorsFilter>("all");
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [areaRange, setAreaRange] = useState<[number, number] | null>(null);

  useEffect(() => {
    setView(loadView());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setProjects(await apiFetch<Project[]>("/api/company/catalog/projects"));
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
    priceActive,
    priceRange,
    areaActive,
    areaRange
  ]);

  const hasActiveFilters =
    Boolean(query.trim()) ||
    technology !== "all" ||
    floors !== "all" ||
    priceActive ||
    areaActive;

  function changeView(next: CatalogViewMode) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function resetFilters() {
    setQuery("");
    setTechnology("all");
    setFloors("all");
    if (priceBounds) setPriceRange([priceBounds.min, priceBounds.max]);
    if (areaBounds) setAreaRange([areaBounds.min, areaBounds.max]);
  }

  async function reloadProjects() {
    try {
      setProjects(await apiFetch<Project[]>("/api/company/catalog/projects"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить каталог");
    }
  }

  return (
    <DashboardShell
      cabinetKind="company"
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/catalog"
      navigation={companyNavigation}
      title="Каталог"
    >
      <PageAlert message={error} variant="destructive" />

      <Card>
        <CardHeader>
          <CardTitle>Проекты</CardTitle>
          <CardAction>
            <div className="flex flex-wrap items-center justify-end gap-2">
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
              <UpdateFactoryPricesButton onDone={() => void reloadProjects()} />
              <CatalogViewToggle value={view} onChange={changeView} />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && projects.length > 0 ? (
            <CatalogFiltersBar
              query={query}
              onQueryChange={setQuery}
              technology={technology}
              onTechnologyChange={setTechnology}
              floors={floors}
              onFloorsChange={setFloors}
              priceBounds={priceBounds}
              priceRange={priceRange}
              onPriceRangeChange={setPriceRange}
              areaBounds={areaBounds}
              areaRange={areaRange}
              onAreaRangeChange={setAreaRange}
            />
          ) : null}

          {loading ? (
            view === "cards" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((row) => (
                  <CatalogCardSkeleton key={row} />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Проект</TableHead>
                      <TableHead>Площадь</TableHead>
                      <TableHead>Этажи</TableHead>
                      <TableHead>Заводская цена</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[0, 1, 2, 3, 4, 5].map((row) => (
                      <TableRow key={row}>
                        <TableCell>
                          <Skeleton className="h-4 w-36" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-14" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-8" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-8 w-20" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : projects.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconBuildingStore />
                </EmptyMedia>
                <EmptyTitle>Каталог пуст</EmptyTitle>
                <EmptyDescription>
                  Запустите синхронизацию с Tilda в разделе «Синхронизации».
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : filtered.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconSearchOff />
                </EmptyMedia>
                <EmptyTitle>Ничего не найдено</EmptyTitle>
                <EmptyDescription>
                  Снимите фильтры или измените поисковый запрос.
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
          ) : view === "cards" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((project) => (
                <CatalogProjectCard
                  key={project.id}
                  href={`/company/catalog/${project.id}`}
                  name={project.name}
                  description={project.description}
                  technology={project.technology}
                  area={project.area}
                  floors={project.floors}
                  bedrooms={project.bedrooms}
                  basePrice={project.basePrice}
                  retailPrice={null}
                  retailOnRequest={false}
                  assets={project.assets ?? []}
                  hideRetail
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Проект</TableHead>
                    <TableHead>Площадь</TableHead>
                    <TableHead>Этажи</TableHead>
                    <TableHead>Заводская цена</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/company/catalog/${project.id}`}
                          className="hover:text-primary underline-offset-4 hover:underline"
                        >
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {project.area ? `${project.area} м²` : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{project.floors ?? "—"}</TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {project.basePrice
                          ? project.basePrice.toLocaleString("ru-RU")
                          : "по запросу"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={project.active ? "default" : "secondary"}>
                          {project.active ? "Активен" : "Скрыт"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/company/catalog/${project.id}`}>Открыть</Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={project.projectUrl} target="_blank" rel="noreferrer">
                              Сайт
                              <IconExternalLink />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
