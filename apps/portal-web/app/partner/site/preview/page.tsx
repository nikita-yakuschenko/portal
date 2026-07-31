"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

/** Как на msk: зелёная часть до «дома», дальше тёмный текст */
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
  const { draft, projects } = usePartnerSitePreview();
  const [slide, setSlide] = useState(0);

  const slides = useMemo(() => {
    return projects
      .map((p) => ({ id: p.id, name: p.name, url: primaryImage(p) }))
      .filter((p): p is { id: string; name: string; url: string } => Boolean(p.url))
      .slice(0, 6);
  }, [projects]);

  if (!draft) return null;

  const headline =
    draft.heroHeadline?.trim() ||
    `${MSK_GREEN} ${MSK_DARK}`;
  const [greenPart, darkPart] = splitHeadline(headline);
  const current = slides[slide] ?? null;
  const featured = projects.slice(0, 3);

  function prevSlide() {
    if (!slides.length) return;
    setSlide((i) => (i - 1 + slides.length) % slides.length);
  }

  function nextSlide() {
    if (!slides.length) return;
    setSlide((i) => (i + 1) % slides.length);
  }

  return (
    <>
      {/* Центральный блок как msk.avgst.ru — без плашек 6% / Яндекс / 10+ лет */}
      <section className="bg-[#F5F6F8]">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-2 lg:items-stretch lg:gap-5 lg:px-6 lg:py-8">
          <div className="flex flex-col justify-center rounded-3xl bg-[#ECEEF1] px-7 py-9 md:px-10 md:py-12">
            <h1 className="text-[1.65rem] font-extrabold uppercase leading-[1.12] tracking-tight sm:text-3xl md:text-[2.15rem] lg:text-[2.35rem]">
              <span className="text-avgst-green">{greenPart}</span>
              {darkPart ? (
                <>
                  {" "}
                  <span className="text-slate-900">{darkPart}</span>
                </>
              ) : null}
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-800 md:text-[15px]">
              {draft.heroText || emptyPartnerSiteDraft.heroText}
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 w-fit rounded-md bg-avgst-yellow px-5 text-sm font-bold uppercase tracking-wide text-slate-950 hover:bg-avgst-yellow/90"
            >
              <Link href={previewPaths.projects} className="inline-flex items-center gap-2">
                <IconArrowUpRight size={18} stroke={2.5} className="shrink-0" />
                {draft.ctaLabel || "Посмотреть каталог проектов"}
              </Link>
            </Button>
          </div>

          <div className="relative min-h-[280px]">
            <div className="h-full overflow-hidden rounded-3xl bg-slate-200">
              {current ? (
                <img
                  src={current.url}
                  alt={current.name}
                  className="h-full min-h-[320px] w-full object-cover lg:min-h-full"
                />
              ) : (
                <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-400">
                  Нет фото проектов
                </div>
              )}
            </div>
            {slides.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Предыдущее фото"
                  className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-xl text-white hover:bg-black/70"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Следующее фото"
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-xl text-white hover:bg-black/70"
                >
                  ›
                </button>
              </>
            ) : null}
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
            <Link href={previewPaths.projects}>Весь каталог</Link>
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
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
