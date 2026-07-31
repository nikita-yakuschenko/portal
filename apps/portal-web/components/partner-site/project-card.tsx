"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { technologyBadgeCode, technologyBadgeVariant } from "@/lib/catalog-display";
import { formatRub } from "@/lib/partner-pricing";
import {
  previewPaths,
  primaryImage,
  projectSpecs,
  type StorefrontProject
} from "@/lib/partner-site-preview";

export function PartnerSiteProjectCard({
  project,
  ctaLabel
}: {
  project: StorefrontProject;
  ctaLabel: string;
}) {
  const image = primaryImage(project);
  const specs = projectSpecs(project);
  const href = previewPaths.project(project.id);

  return (
    <article className="group">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
          {image ? (
            <img
              src={image}
              alt={project.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Нет фото
            </div>
          )}
          <Badge
            variant={technologyBadgeVariant(project.technology)}
            className="absolute left-3 top-3 border-0 bg-white/95 shadow-sm backdrop-blur-sm"
          >
            {technologyBadgeCode(project.technology)}
          </Badge>
        </div>
        <div className="pt-4">
          <h3 className="text-lg font-semibold tracking-tight group-hover:underline">
            {project.name}
          </h3>
          {specs.length ? <p className="mt-1 text-sm text-slate-500">{specs.join(" · ")}</p> : null}
          <p className="mt-2 text-lg font-semibold tabular-nums">
            {project.priceOnRequest || project.basePrice == null
              ? "Цена по запросу"
              : `от ${formatRub(project.basePrice)}`}
          </p>
        </div>
      </Link>
      <Button asChild variant="outline" className="mt-4 w-full border-slate-300" size="sm">
        <Link href={href}>{ctaLabel || "Посмотреть проект"}</Link>
      </Button>
    </article>
  );
}
