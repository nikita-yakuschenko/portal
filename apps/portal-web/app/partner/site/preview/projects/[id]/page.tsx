"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { technologyBadgeCode, technologyBadgeVariant, technologyLabel } from "@/lib/catalog-display";
import { formatRub } from "@/lib/partner-pricing";
import { previewPaths, primaryImage, projectSpecs } from "@/lib/partner-site-preview";

export default function PartnerSiteProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const { draft, projects } = usePartnerSitePreview();
  const project = useMemo(
    () => projects.find((item) => item.id === params.id) ?? null,
    [projects, params.id]
  );
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  if (!draft) return null;

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm text-slate-500">Проект не найден или не опубликован на сайте.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={previewPaths.projects}>К каталогу</Link>
        </Button>
      </div>
    );
  }

  const images = [...(project.assets ?? [])].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const mainImage = activeUrl ?? primaryImage(project);
  const specs = projectSpecs(project);
  const extras = project.dealerExtras ?? [];
  const optionGroups = project.details?.optionGroups ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-sm text-slate-500">
        <Link href={previewPaths.projects} className="hover:text-slate-950">
          Проекты
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-950">{project.name}</span>
      </p>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-[4/3] overflow-hidden bg-slate-200">
            {mainImage ? (
              <img src={mainImage} alt={project.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Нет фото
              </div>
            )}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {images.slice(0, 10).map((asset) => (
                <button
                  key={asset.sourceUrl}
                  type="button"
                  onClick={() => setActiveUrl(asset.sourceUrl)}
                  className="aspect-square overflow-hidden bg-slate-200 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <img
                    src={asset.sourceUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <Badge variant={technologyBadgeVariant(project.technology)}>
            {technologyBadgeCode(project.technology)}
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            {project.name}
          </h1>
          {specs.length ? (
            <p className="mt-2 text-sm text-slate-500">{specs.join(" · ")}</p>
          ) : null}
          <p className="mt-4 text-2xl font-semibold tabular-nums">
            {project.priceOnRequest || project.basePrice == null
              ? "Цена по запросу"
              : `от ${formatRub(project.basePrice)}`}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {technologyLabel(project.technology)}
            {project.bathrooms ? ` · санузлы: ${project.bathrooms}` : ""}
          </p>

          {(project.details?.summary || project.description) && (
            <p className="mt-6 text-base leading-relaxed text-slate-600">
              {project.details?.summary || project.description}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-slate-900 text-white hover:bg-slate-800">
              <Link href={previewPaths.contacts}>{draft.ctaLabel || "Получить расчёт"}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={previewPaths.projects}>К каталогу</Link>
            </Button>
          </div>
        </div>
      </div>

      {extras.length > 0 ? (
        <section className="mt-14">
          <h2 className="text-xl font-semibold tracking-tight">Дополнительные опции</h2>
          <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {extras.map((extra) => (
              <li
                key={extra.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>{extra.name}</span>
                <span className="font-medium tabular-nums">
                  {extra.price != null ? `+ ${formatRub(extra.price)}` : "по запросу"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {optionGroups.length > 0 ? (
        <section className="mt-14 space-y-8">
          <h2 className="text-xl font-semibold tracking-tight">Комплектация и опции</h2>
          {optionGroups.map((group) => (
            <div key={group.id}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {group.title}
              </h3>
              <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200 bg-white">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span>
                      {item.name}
                      {item.note ? (
                        <span className="mt-0.5 block text-xs text-slate-500">{item.note}</span>
                      ) : null}
                    </span>
                    {item.price != null ? (
                      <span className="font-medium tabular-nums">{formatRub(item.price)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
