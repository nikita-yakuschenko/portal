"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconPhoto, IconSearch } from "@tabler/icons-react";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { formatPrice, pluralize, type GeneralHouse } from "@/lib/general-section";

type Technology = "panel_frame" | "modular";
type SortKey = "price_asc" | "price_desc" | "name_asc" | "area_desc";

const TECH_TITLE: Record<Technology, string> = {
  panel_frame: "Панельно-каркасные дома",
  modular: "Модульные дома"
};

const SORT_LABEL: Record<SortKey, string> = {
  price_asc: "Цена: по возрастанию",
  price_desc: "Цена: по убыванию",
  name_asc: "Название: А—Я",
  area_desc: "Площадь: по убыванию"
};

function parseTechnology(value: string | null): Technology {
  return value === "modular" ? "modular" : "panel_frame";
}

/** Карточка проекта: фото ведёт, под ним характеристики и заводская цена */
function HouseCard({ house }: { house: GeneralHouse }) {
  return (
    <article className="bg-card overflow-hidden rounded-xl border transition-colors duration-150 hover:border-ring/50">
      <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
        {house.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={house.imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 hover:scale-[1.02]"
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center">
            <IconPhoto className="size-6" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">{house.name}</h2>

        {/* Одной строкой: в две колонки «13,68×8,98 м» переносится и ломает ряд */}
        <p className="text-muted-foreground text-sm tabular-nums">
          {[
            house.area ? `${house.area} м²` : null,
            house.dimensions,
            house.floors ? pluralize(house.floors, ["этаж", "этажа", "этажей"]) : null,
            house.bedrooms ? pluralize(house.bedrooms, ["спальня", "спальни", "спален"]) : null
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <p className="text-lg font-medium tabular-nums">{formatPrice(house.basePrice)}</p>
      </div>
    </article>
  );
}

function GeneralHousesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const technology = parseTechnology(searchParams.get("technology"));

  const [houses, setHouses] = useState<GeneralHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("price_asc");

  useEffect(() => {
    setLoading(true);
    void (async () => {
      try {
        setHouses(
          await apiFetch<GeneralHouse[]>(`/api/partner/general/houses?technology=${technology}`)
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить проекты");
      } finally {
        setLoading(false);
      }
    })();
  }, [technology]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? houses.filter((house) => house.name.toLowerCase().includes(needle))
      : houses;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "price_desc":
          return (b.basePrice ?? 0) - (a.basePrice ?? 0);
        case "name_asc":
          return a.name.localeCompare(b.name, "ru");
        case "area_desc":
          return (b.area ?? 0) - (a.area ?? 0);
        default:
          return (a.basePrice ?? 0) - (b.basePrice ?? 0);
      }
    });
    return sorted;
  }, [houses, query, sort]);

  function changeTechnology(next: string) {
    router.replace(`/partner/general/houses?technology=${parseTechnology(next)}`, {
      scroll: false
    });
  }

  return (
    <PartnerShell
      currentPath="/partner/general"
      title={TECH_TITLE[technology]}
      breadcrumbs={
        <Tabs value={technology} onValueChange={changeTechnology}>
          <TabsList>
            <TabsTrigger value="panel_frame">Панельно-каркасные</TabsTrigger>
            <TabsTrigger value="modular">Модульные</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <PageAlert message={error} variant="destructive" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {loading
            ? "Загружаем проекты…"
            : `${pluralize(visible.length, ["проект", "проекта", "проектов"])} · цены завода, одинаковые для всех дилеров`}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <IconSearch
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти проект"
              aria-label="Поиск проекта"
              className="h-9 pl-8"
            />
          </div>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger className="w-56" aria-label="Порядок проектов">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <Skeleton key={row} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {query.trim() ? "Ничего не нашлось — проверьте название." : "Проектов пока нет."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((house) => (
            <HouseCard key={house.id} house={house} />
          ))}
        </div>
      )}
    </PartnerShell>
  );
}

export default function GeneralHousesPage() {
  return (
    <Suspense
      fallback={
        <PartnerShell currentPath="/partner/general" title="Дома">
          <Skeleton className="h-96 w-full" />
        </PartnerShell>
      }
    >
      <GeneralHousesContent />
    </Suspense>
  );
}
