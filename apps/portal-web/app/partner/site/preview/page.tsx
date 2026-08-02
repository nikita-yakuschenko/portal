"use client";

import Link from "next/link";
import { useMemo } from "react";
import { IconArrowUpRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { PartnerSiteProjectCard } from "@/components/partner-site/project-card";
import { emptyPartnerSiteDraft } from "@/lib/partner-site-draft";
import { previewPaths, primaryImage } from "@/lib/partner-site-preview";

const MSK_GREEN =
  "Строим современные каркасные и модульные дома";
const MSK_DARK =
  "для комфортной жизни, отдыха и постоянного проживания";

/** Как на msk: зелёная часть до «дома», дальше светлый текст на оверлее */
function splitHeadline(text: string): [string, string] {
  const normalized = text.trim().replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();
  const marker = " дома ";
  const idx = lower.indexOf(marker);
  if (idx > 0) {
    const cut = idx + marker.length - 1; // включая «дома»
    return [normalized.slice(0, cut), normalized.slice(cut).trim()];
  }
  const words = normalized.split(" ");
  if (words.length < 4) return [normalized, ""];
  const mid = Math.ceil(words.length * 0.45);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export default function PartnerSiteHomePage() {
  const { draft, projects, favorites, toggleFavorite, openLeadForm } =
    usePartnerSitePreview();

  const hero = useMemo(() => {
    for (const project of projects) {
      const url = primaryImage(project);
      if (url) return { name: project.name, url };
    }
    return null;
  }, [projects]);

  if (!draft) return null;

  const headline =
    draft.heroHeadline?.trim() ||
    `${MSK_GREEN} ${MSK_DARK}`;
  const [greenPart, darkPart] = splitHeadline(headline);
  const featured = projects.slice(0, 6);

  return (
    <>
      <section className="relative min-h-[560px] overflow-hidden bg-slate-800 md:min-h-[70vh]">
        {hero ? (
          <img
            src={hero.url}
            alt={hero.name}
            fetchPriority="high"
            decoding="async"
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-700 text-sm text-slate-300">
            Нет фото проектов
          </div>
        )}

        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(15,18,22,0.88)_0%,rgba(15,18,22,0.62)_42%,rgba(15,18,22,0.28)_72%,rgba(15,18,22,0.12)_100%)]" />

        <div className="relative z-10 mx-auto flex min-h-[560px] max-w-6xl flex-col justify-end px-4 pb-10 pt-28 md:min-h-[70vh] md:px-6 md:pb-14 md:pt-32 lg:justify-center">
          <div className="max-w-xl md:max-w-2xl">
            <h1 className="text-[1.65rem] font-extrabold uppercase leading-[1.12] tracking-tight sm:text-3xl md:text-[2.15rem] lg:text-[2.35rem]">
              <span className="text-avgst-green">{greenPart}</span>
              {darkPart ? (
                <>
                  {" "}
                  <span className="text-white">{darkPart}</span>
                </>
              ) : null}
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/85 md:text-[15px]">
              {draft.heroText || emptyPartnerSiteDraft.heroText}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="lg"
                className="w-fit rounded-md bg-avgst-yellow px-5 text-sm font-bold uppercase tracking-wide text-slate-950 hover:bg-avgst-yellow/90"
                onClick={() => openLeadForm({ kind: "consultation" })}
              >
                Получить консультацию
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-fit border-white/40 bg-white/5 px-5 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/15 hover:text-white"
              >
                <Link href={previewPaths.catalog} className="inline-flex items-center gap-2">
                  <IconArrowUpRight size={18} stroke={2.5} className="shrink-0" />
                  Каталог
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-avgst-green">
              Популярные дома
            </p>
            <h2 className="mt-2 text-2xl font-extrabold uppercase tracking-tight md:text-3xl">
              {draft.catalogTitle || "Проекты домов"}
            </h2>
          </div>
          <Button asChild variant="outline" className="border-slate-300">
            <Link href={previewPaths.catalog}>Весь каталог</Link>
          </Button>
        </div>

        {featured.length === 0 ? (
          <p className="mt-10 text-sm text-slate-500">Проекты скоро появятся.</p>
        ) : (
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((project) => (
              <PartnerSiteProjectCard
                key={project.id}
                project={project}
                ctaLabel="Посмотреть проект"
                favorite={favorites.has(project.id)}
                onToggleFavorite={() => toggleFavorite(project.id)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
