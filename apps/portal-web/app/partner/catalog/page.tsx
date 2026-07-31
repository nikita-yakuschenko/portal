"use client";

import { useEffect, useMemo, useState } from "react";
import { IconHeart, IconHeartFilled, IconSearch, IconX } from "@tabler/icons-react";

import { CatalogProjectCard } from "../../../components/catalog-project-card";
import { DashboardShell } from "../../../components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { TECHNOLOGY_LABELS } from "@/lib/catalog-display";
import { partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";

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

type TechnologyFilter = "all" | "modular" | "panel_frame";
type FloorsFilter = "all" | "1" | "2";
type PriceFilter = "all" | "priced" | "request";
type SortBy = "name" | "price" | "area";

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

export default function PartnerCatalogPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [retailById, setRetailById] = useState<
    Record<string, { retailPrice: number | null; retailOnRequest: boolean }>
  >({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [technology, setTechnology] = useState<TechnologyFilter>("all");
  const [floors, setFloors] = useState<FloorsFilter>("all");
  const [price, setPrice] = useState<PriceFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [catalog, pricing] = await Promise.all([
          apiFetch<Project[]>("/api/partner/catalog/projects"),
          apiFetch<
            Array<{
              projectId: string;
              displayPrice: number | null;
              displayOnRequest: boolean;
            }>
          >("/api/partner/pricing").catch(() => [])
        ]);
        setProjects(catalog);
        setRetailById(
          Object.fromEntries(
            pricing.map((row) => [
              row.projectId,
              {
                retailPrice: row.displayPrice,
                retailOnRequest: row.displayOnRequest
              }
            ])
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить каталог");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const rows = projects.filter((project) => {
      if (favoritesOnly && !favorites.has(project.id)) return false;
      if (technology !== "all" && project.technology !== technology) return false;
      if (q && !project.name.toLowerCase().includes(q)) return false;
      if (floors === "1" && project.floors !== 1) return false;
      if (floors === "2" && project.floors !== 2) return false;
      if (price === "priced" && !project.basePrice) return false;
      if (price === "request" && project.basePrice) return false;
      return true;
    });

    rows.sort((a, b) => {
      if (sortBy === "price") {
        return (a.basePrice ?? Number.MAX_SAFE_INTEGER) - (b.basePrice ?? Number.MAX_SAFE_INTEGER);
      }
      if (sortBy === "area") {
        return (b.area ?? 0) - (a.area ?? 0);
      }
      return a.name.localeCompare(b.name, "ru");
    });

    return rows;
  }, [projects, query, technology, floors, price, sortBy, favoritesOnly, favorites]);

  const hasActiveFilters =
    Boolean(query.trim()) ||
    technology !== "all" ||
    floors !== "all" ||
    price !== "all" ||
    sortBy !== "name" ||
    favoritesOnly;

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }

  function resetFilters() {
    setQuery("");
    setTechnology("all");
    setFloors("all");
    setPrice("all");
    setSortBy("name");
    setFavoritesOnly(false);
  }

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath="/partner/catalog"
      navigation={partnerNavigation}
      headerActions={
        <>
          <label className="relative min-w-[220px] max-w-sm flex-1">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию"
              className="bg-background pl-9"
            />
          </label>

          <Select
            value={technology}
            onValueChange={(value) => setTechnology(value as TechnologyFilter)}
          >
            <SelectTrigger className="w-[200px] bg-background" aria-label="Технология">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Технология: все</SelectItem>
              <SelectItem value="modular">{TECHNOLOGY_LABELS.modular}</SelectItem>
              <SelectItem value="panel_frame">{TECHNOLOGY_LABELS.panel_frame}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={floors} onValueChange={(value) => setFloors(value as FloorsFilter)}>
            <SelectTrigger className="w-[160px] bg-background" aria-label="Этажность">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Этажи: все</SelectItem>
              <SelectItem value="1">1 этаж</SelectItem>
              <SelectItem value="2">2 этажа</SelectItem>
            </SelectContent>
          </Select>

          <Select value={price} onValueChange={(value) => setPrice(value as PriceFilter)}>
            <SelectTrigger className="w-[150px] bg-background" aria-label="Цена">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Цена: все</SelectItem>
              <SelectItem value="priced">С ценой</SelectItem>
              <SelectItem value="request">По запросу</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
            <SelectTrigger className="w-[160px] bg-background" aria-label="Сортировка">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="name">По названию</SelectItem>
              <SelectItem value="price">По цене</SelectItem>
              <SelectItem value="area">По площади</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant={favoritesOnly ? "secondary" : "outline"}
            onClick={() => setFavoritesOnly((value) => !value)}
            className={
              favoritesOnly
                ? "border-avgst-green/30 bg-avgst-green/10 text-avgst-green hover:bg-avgst-green/15 hover:text-avgst-green"
                : undefined
            }
          >
            {favoritesOnly ? <IconHeartFilled size={16} /> : <IconHeart size={16} />}
            Избранное
            {favorites.size > 0 ? (
              <span className="rounded-md bg-background/80 px-1.5 text-xs">{favorites.size}</span>
            ) : null}
          </Button>

          {hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={resetFilters}>
              <IconX size={14} />
              Сбросить
            </Button>
          ) : null}
        </>
      }
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <p className="mb-4 text-sm text-slate-500">
        {loading ? "Загрузка..." : `Найдено: ${filtered.length}`}
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <p className="text-sm text-slate-500">Загрузка каталога...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ничего не найдено. Снимите фильтры или дождитесь синхронизации.
          </p>
        ) : (
          filtered.map((project) => (
            <CatalogProjectCard
              key={project.id}
              href={`/partner/catalog/${project.id}`}
              name={project.name}
              description={project.description}
              technology={project.technology}
              area={project.area}
              floors={project.floors}
              bedrooms={project.bedrooms}
              basePrice={project.basePrice}
              retailPrice={retailById[project.id]?.retailPrice}
              retailOnRequest={retailById[project.id]?.retailOnRequest}
              assets={project.assets}
              favorite={favorites.has(project.id)}
              onToggleFavorite={() => toggleFavorite(project.id)}
            />
          ))
        )}
      </div>
    </DashboardShell>
  );
}
