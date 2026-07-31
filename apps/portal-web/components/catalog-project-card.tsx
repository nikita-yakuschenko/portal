"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";

import {
  technologyBadgeCode,
  technologyBadgeVariant
} from "@/lib/catalog-display";
import { catalogProseDescription } from "@/lib/strip-html";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Asset = {
  sourceUrl: string;
  isPrimary: boolean;
  sortOrder?: number;
};

type CatalogProjectCardProps = {
  href: string;
  name: string;
  description: string;
  technology: "modular" | "panel_frame";
  area: number | null;
  floors: number | null;
  bedrooms: number | null;
  basePrice: number | null;
  retailPrice?: number | null;
  retailOnRequest?: boolean;
  assets?: Asset[];
  favorite: boolean;
  onToggleFavorite: () => void;
};

const MAX_PREVIEW_ASSETS = 10;

function previewUrls(assets: Asset[] | undefined): string[] {
  if (!assets?.length) return [];

  return [...assets]
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((asset) => asset.sourceUrl)
    .filter(Boolean)
    .slice(0, MAX_PREVIEW_ASSETS);
}

function CatalogMediaPreview({
  urls,
  alt,
  href
}: {
  urls: string[];
  alt: string;
  href: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const current = urls[index] ?? urls[0];
  const canScrub = urls.length > 1;

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!canScrub) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(0.999, Math.max(0, (event.clientX - rect.left) / rect.width));
    setIndex(Math.floor(ratio * urls.length));
  }

  return (
    <div
      className="relative aspect-[4/3] cursor-pointer bg-slate-100"
      onMouseMove={handleMove}
      onMouseLeave={() => setIndex(0)}
      onClick={() => router.push(href)}
    >
      {current ? (
        <img src={current} alt={alt} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">Нет фото</div>
      )}

      {canScrub ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-4 pb-3 pt-10">
          <div className="pointer-events-auto flex justify-center gap-1.5">
            {urls.map((url, i) => (
              <button
                key={url + i}
                type="button"
                aria-label={`Фото ${i + 1}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIndex(i);
                }}
                className={cn(
                  "h-1 flex-1 max-w-10 rounded-full transition",
                  i === index ? "bg-white" : "bg-white/45 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CatalogProjectCard({
  href,
  name,
  description,
  technology,
  area,
  floors,
  bedrooms,
  basePrice,
  retailPrice,
  retailOnRequest,
  assets,
  favorite,
  onToggleFavorite
}: CatalogProjectCardProps) {
  const prose = catalogProseDescription(description);
  const urls = previewUrls(assets);

  const specs = [
    area ? `${area} м²` : null,
    floors ? `${floors} эт.` : null,
    bedrooms ? `${bedrooms} сп.` : null
  ].filter(Boolean);

  const hasRetail = retailPrice != null || retailOnRequest === true;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="relative">
        <CatalogMediaPreview urls={urls} alt={name} href={href} />
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:text-avgst-green"
          aria-label={favorite ? "Убрать из избранного" : "В избранное"}
        >
          {favorite ? (
            <IconHeartFilled size={18} className="text-avgst-green" />
          ) : (
            <IconHeart size={18} />
          )}
        </button>
      </div>

      <Link href={href} className="block space-y-3 p-4">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-base font-semibold tracking-tight text-slate-950 group-hover:text-avgst-green">
              {name}
            </h3>
            <Badge variant={technologyBadgeVariant(technology)}>
              {technologyBadgeCode(technology)}
            </Badge>
          </div>
          {specs.length > 0 ? (
            <p className="text-sm text-slate-600">{specs.join(" · ")}</p>
          ) : null}
          {prose ? <p className="line-clamp-2 text-sm text-slate-500">{prose}</p> : null}
        </div>

        <div>
          <p className="text-xs text-slate-500">Завод</p>
          <p className="text-base font-semibold tabular-nums text-slate-950">
            {basePrice ? `${basePrice.toLocaleString("ru-RU")} ₽` : "Цена по запросу"}
          </p>
          {hasRetail ? (
            <>
              <p className="mt-1 text-xs text-slate-500">Ваша цена для покупателя</p>
              <p className="text-base font-semibold tabular-nums text-avgst-green">
                {retailOnRequest || retailPrice == null
                  ? "По запросу"
                  : `${retailPrice.toLocaleString("ru-RU")} ₽`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Задайте свою цену во вкладке «Цена»</p>
          )}
        </div>
      </Link>
    </article>
  );
}
