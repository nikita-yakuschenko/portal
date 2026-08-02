"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  IconBath,
  IconBed,
  IconHeart,
  IconRulerMeasure,
  IconStairs
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { technologyBadgeCode, technologyBadgeVariant } from "@/lib/catalog-display";
import { formatRub } from "@/lib/partner-pricing";
import {
  previewPaths,
  primaryImage,
  storefrontProjectKey,
  type StorefrontProject
} from "@/lib/partner-site-preview";
import { cn } from "@/lib/utils";

export function PartnerSiteProjectCard({
  project,
  ctaLabel,
  favorite,
  onToggleFavorite
}: {
  project: StorefrontProject;
  ctaLabel: string;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const image = primaryImage(project);
  const href = previewPaths.project(storefrontProjectKey(project));
  const [imageLoaded, setImageLoaded] = useState(false);

  // Смена проекта / URL — снова ждём загрузку, без вспышки alt
  useEffect(() => {
    setImageLoaded(false);
  }, [image]);

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    setImageLoaded(true);
  }

  function bindImage(el: HTMLImageElement | null) {
    // Кеш: onLoad мог уже не прийти
    if (el?.complete && el.naturalWidth > 0) setImageLoaded(true);
  }

  const specs: Array<{ icon: typeof IconRulerMeasure; label: string }> = [];
  if (project.area) {
    specs.push({ icon: IconRulerMeasure, label: `${project.area} м²` });
  }
  if (project.floors) {
    specs.push({ icon: IconStairs, label: `${project.floors} эт.` });
  }
  if (project.bedrooms) {
    specs.push({ icon: IconBed, label: `${project.bedrooms} сп.` });
  }
  if (project.bathrooms) {
    specs.push({ icon: IconBath, label: `${project.bathrooms} с/у` });
  }

  return (
    <article className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="relative">
        <Link href={href} className="block" aria-label={project.name}>
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-slate-200">
            {image ? (
              <img
                ref={bindImage}
                src={image}
                alt=""
                loading="lazy"
                decoding="async"
                onLoad={handleImageLoad}
                className={cn(
                  "h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]",
                  imageLoaded ? "opacity-100" : "opacity-0"
                )}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Нет фото
              </div>
            )}
            <Badge
              variant={technologyBadgeVariant(project.technology)}
              className="absolute top-3 left-3 border-0 bg-white/95 shadow-sm backdrop-blur-sm"
            >
              {technologyBadgeCode(project.technology)}
            </Badge>
          </div>
        </Link>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-md bg-white/95 text-slate-500 shadow-sm backdrop-blur-sm transition hover:text-avgst-green focus-visible:ring-[3px] focus-visible:ring-avgst-green/40 focus-visible:outline-none"
          aria-label={favorite ? "Убрать из избранного" : "В избранное"}
          aria-pressed={favorite}
        >
          <IconHeart
            className={cn(
              "size-4 transition-transform duration-200 motion-reduce:transition-none",
              favorite && "scale-110 fill-avgst-green text-avgst-green"
            )}
          />
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <Link href={href}>
            <h3 className="text-lg font-semibold tracking-tight transition group-hover:text-avgst-green">
              {project.name}
            </h3>
          </Link>
          {specs.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-slate-600">
              {specs.map((spec) => {
                const Icon = spec.icon;
                return (
                  <li key={spec.label} className="inline-flex items-center gap-1.5">
                    <Icon className="size-4 shrink-0 text-avgst-green" stroke={1.75} />
                    <span>{spec.label}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <p className="mt-2 text-lg font-semibold tabular-nums">
            {project.priceOnRequest || project.basePrice == null
              ? "Цена по запросу"
              : `от ${formatRub(project.basePrice)}`}
          </p>
        </div>

        <Button
          asChild
          size="sm"
          className="w-fit rounded-md bg-avgst-yellow px-4 font-semibold text-slate-950 hover:bg-avgst-yellow/90"
        >
          <Link href={href}>{ctaLabel || "Посмотреть проект"}</Link>
        </Button>
      </div>
    </article>
  );
}
