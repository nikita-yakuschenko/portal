"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconArrowRight,
  IconFolders,
  IconPhoto,
  IconRoad,
  IconStack2,
  type Icon
} from "@tabler/icons-react";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatPrice, pluralize, type GeneralOverview } from "@/lib/general-section";

/**
 * Плитка каталога домов: фото ведёт, текст лежит поверх затемнения.
 * Дилер узнаёт раздел по дому, а не по иконке.
 */
function HousesTile({
  href,
  title,
  count,
  from,
  cover
}: {
  href: string;
  title: string;
  count: number;
  from: number | null;
  cover: string | null;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex aspect-[16/9] flex-col justify-end overflow-hidden rounded-xl border",
        "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        "motion-safe:active:scale-[0.995] motion-safe:transition-transform"
      )}
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="bg-muted text-muted-foreground absolute inset-0 flex items-center justify-center">
          <IconPhoto className="size-8" aria-hidden />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

      <div className="relative flex items-end justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-lg font-medium text-white">{title}</p>
          <p className="text-sm text-white/80">
            {pluralize(count, ["проект", "проекта", "проектов"])}
            {from !== null ? ` · от ${formatPrice(from)}` : ""}
          </p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur transition-transform duration-150 group-hover:translate-x-0.5">
          <IconArrowRight className="size-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/** Плитка остальной продукции: спокойная карточка с иконкой */
function ProductTile({
  href,
  title,
  hint,
  icon: Icon
}: {
  href: string;
  title: string;
  hint: string;
  icon: Icon;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group bg-card flex flex-col justify-between gap-6 rounded-xl border p-5",
        "transition-[border-color,background-color] duration-150",
        "hover:border-ring/60 hover:bg-accent/30",
        "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        "motion-safe:active:scale-[0.995] motion-safe:transition-transform"
      )}
    >
      <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex items-end justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-medium">{title}</span>
          <span className="text-muted-foreground block text-sm">{hint}</span>
        </span>
        <IconArrowRight
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

export default function PartnerGeneralPage() {
  const [overview, setOverview] = useState<GeneralOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setOverview(await apiFetch<GeneralOverview>("/api/partner/general/overview"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить раздел");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PartnerShell currentPath="/partner/general" title="Общий раздел">
      <PageAlert message={error} variant="destructive" />

      <p className="text-muted-foreground max-w-prose text-sm">
        Продукция и материалы завода — одинаковые для всех дилеров. Ваши персональные цены и
        витрина живут в разделах «Каталог» и «Сайт».
      </p>

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="aspect-[16/9] w-full rounded-xl" />
            <Skeleton className="aspect-[16/9] w-full rounded-xl" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ) : !overview ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Раздел пока пуст.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Дома — то, ради чего заходят: крупно и с фотографией */}
          <div className="grid gap-3 md:grid-cols-2">
            <HousesTile
              href="/partner/general/houses?technology=panel_frame"
              title="Панельно-каркасные дома"
              count={overview.panelFrame}
              from={overview.panelFrameFrom}
              cover={overview.panelFrameCover}
            />
            <HousesTile
              href="/partner/general/houses?technology=modular"
              title="Модульные дома"
              count={overview.modular}
              from={overview.modularFrom}
              cover={overview.modularCover}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ProductTile
              href="/partner/general/trusses"
              title="Фермы на МЗП"
              hint={`${pluralize(overview.trusses, ["тип", "типа", "типов"])} · стропильные фермы для кровель`}
              icon={IconRoad}
            />
            <ProductTile
              href="/partner/general/roof-panels"
              title="Кровельные панели"
              hint={
                overview.roofPanelPrice
                  ? `${formatPrice(overview.roofPanelPrice)} за м² · панели с завода`
                  : "Готовые кровельные панели с завода"
              }
              icon={IconStack2}
            />
            <ProductTile
              href="/partner/general/materials"
              title="Материалы для дилеров"
              hint={`${pluralize(overview.materials, ["подборка", "подборки", "подборок"])} · фото, видео и презентации`}
              icon={IconFolders}
            />
          </div>
        </div>
      )}
    </PartnerShell>
  );
}
