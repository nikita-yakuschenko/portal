"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart } from "lucide-react";

import { technologyBadgeCode, technologyBadgeVariant } from "@/lib/catalog-display";
import { catalogProseDescription } from "@/lib/strip-html";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
  retailPrice: number | null;
  retailOnRequest: boolean;
  assets: Asset[];
  favorite: boolean;
  onToggleFavorite: () => void;
};

const MAX_PREVIEW_ASSETS = 10;

function previewUrls(assets: Asset[]): string[] {
  if (!assets.length) return [];

  return [...assets]
    .sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    )
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
      className="bg-muted relative aspect-[4/3] cursor-pointer"
      onMouseMove={handleMove}
      onMouseLeave={() => setIndex(0)}
      onClick={() => router.push(href)}
    >
      {current ? (
        <img src={current} alt={alt} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
          Нет фото
        </div>
      )}

      {canScrub ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-4 pt-10 pb-3">
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
                  "h-1 max-w-10 flex-1 rounded-full transition",
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

  const hasRetail = retailPrice != null || retailOnRequest;

  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <div className="relative">
        <CatalogMediaPreview urls={urls} alt={name} href={href} />
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavorite();
          }}
          className="bg-background/90 text-muted-foreground hover:text-primary focus-visible:ring-ring/50 absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-md shadow-sm backdrop-blur transition focus-visible:ring-[3px] focus-visible:outline-none"
          aria-label={favorite ? "Убрать из избранного" : "В избранное"}
          aria-pressed={favorite}
        >
          <Heart className={cn("size-4", favorite && "fill-primary text-primary")} />
        </button>
      </div>

      <Link href={href} className="flex flex-col gap-3 p-4">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="group-hover:text-primary min-w-0 text-base font-semibold tracking-tight transition-colors">
              {name}
            </h3>
            <Badge variant={technologyBadgeVariant(technology)}>
              {technologyBadgeCode(technology)}
            </Badge>
          </div>
          {specs.length > 0 ? <p className="text-sm">{specs.join(" · ")}</p> : null}
          {prose ? (
            <p className="text-muted-foreground line-clamp-2 text-sm">{prose}</p>
          ) : null}
        </div>

        <div>
          <p className="text-muted-foreground text-xs">Завод</p>
          <p className="text-base font-semibold tabular-nums">
            {basePrice ? `${basePrice.toLocaleString("ru-RU")} ₽` : "Цена по запросу"}
          </p>
          {hasRetail ? (
            <>
              <p className="text-muted-foreground mt-1 text-xs">Ваша цена для покупателя</p>
              <p className="text-primary text-base font-semibold tabular-nums">
                {retailOnRequest || retailPrice == null
                  ? "По запросу"
                  : `${retailPrice.toLocaleString("ru-RU")} ₽`}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground mt-1 text-xs">
              Задайте свою цену во вкладке «Цена»
            </p>
          )}
        </div>
      </Link>
    </Card>
  );
}
