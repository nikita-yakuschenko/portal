"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { technologyBadgeCode, technologyBadgeVariant } from "@/lib/catalog-display";
import { formatRub } from "@/lib/partner-pricing";
import {
  loadPartnerSiteDraft,
  publicSiteHost,
  type PartnerSiteDraft
} from "@/lib/partner-site-draft";

type MeResponse = {
  partner: {
    companyName: string;
    region: string;
    email: string;
    phone: string;
  } | null;
};

type StorefrontProject = {
  id: string;
  name: string;
  technology: "modular" | "panel_frame";
  area: number | null;
  floors: number | null;
  bedrooms: number | null;
  factoryBasePrice?: number | null;
  basePrice: number | null;
  priceOnRequest?: boolean;
  dealerExtras?: Array<{ id: string; name: string; price?: number }>;
  dealerPricing?: { isPublished?: boolean } | null;
  assets?: Array<{ sourceUrl: string; isPrimary: boolean; sortOrder?: number }>;
};

function draftFromPartner(partner: NonNullable<MeResponse["partner"]>): PartnerSiteDraft {
  const slug = partner.companyName
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);

  return {
    name: partner.companyName,
    subdomain: slug || "partner",
    domain: "",
    contactPhone: partner.phone,
    contactEmail: partner.email,
    address: partner.region,
    seoTitle: `${partner.companyName} — модульные и панельно-каркасные дома`,
    seoDescription: `Официальный сайт дилера ${partner.companyName}. Каталог проектов AVGST с ценами вашего региона.`,
    yandexMetrika: "",
    gtmId: "",
    ctaLabel: "Запросить цену",
    inquiryEmail: partner.email
  };
}

function primaryImage(project: StorefrontProject): string | null {
  if (!project.assets?.length) return null;
  const sorted = [...project.assets].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  return sorted[0]?.sourceUrl ?? null;
}

export default function PartnerSitePreviewPage() {
  const [draft, setDraft] = useState<PartnerSiteDraft | null>(null);
  const [projects, setProjects] = useState<StorefrontProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const stored = loadPartnerSiteDraft();
        const [me, storefront] = await Promise.all([
          apiFetch<MeResponse>("/api/partner/me"),
          apiFetch<StorefrontProject[]>("/api/partner/storefront/projects")
        ]);

        if (stored) setDraft(stored);
        else if (me.partner) setDraft(draftFromPartner(me.partner));
        else setError("Нет данных партнёра");

        // На витрине — опубликованные; если никто ещё не опубликовал, показываем все как черновик
        const published = storefront.filter((p) => p.dealerPricing?.isPublished);
        setProjects((published.length > 0 ? published : storefront).slice(0, 12));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить предпросмотр");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const host = useMemo(() => (draft ? publicSiteHost(draft) : "partner.avgst.ru"), [draft]);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#F5F6F8] text-sm text-slate-500">
        Загрузка предпросмотра...
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6 text-sm text-red-600">
        {error || "Нет данных"}
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-[#F5F6F8] text-slate-950">
      <div
        role="status"
        className="sticky top-0 z-50 border-b border-black/15 bg-avgst-yellow px-4 py-2.5 text-center text-sm font-semibold text-black"
      >
        Предпросмотр витрины дилера · не опубликован · фото и описания с завода · цены и допы —
        ваши · релиз 01.09
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-lg font-semibold tracking-tight">{draft.name}</p>
            <p className="text-xs text-slate-500">Официальный дилер AVGST · {host}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {draft.contactPhone ? (
              <a href={`tel:${draft.contactPhone}`} className="font-medium text-avgst-green">
                {draft.contactPhone}
              </a>
            ) : null}
            <Button type="button" size="sm">
              {draft.ctaLabel || "Запросить цену"}
            </Button>
          </div>
        </div>
      </header>

      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-avgst-green">
              Дилер AVGST
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              {draft.seoTitle || draft.name}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              {draft.seoDescription}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" size="lg" className="bg-avgst-yellow text-avgst-ink hover:bg-avgst-yellow/90">
                Смотреть каталог
              </Button>
              <Button type="button" size="lg" variant="outline" asChild>
                <a href={`tel:${draft.contactPhone}`}>{draft.ctaLabel || "Связаться"}</a>
              </Button>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xl font-semibold text-avgst-green">Завод</p>
                <p className="text-slate-500">проекты и комплектации AVGST</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-avgst-green">Ваш регион</p>
                <p className="text-slate-500">{draft.address || "локальные цены и сервис"}</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-avgst-green">Допы</p>
                <p className="text-slate-500">опции дилера для покупателя</p>
              </div>
            </div>
          </div>
          <aside className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-sm">
            {projects[0] && primaryImage(projects[0]) ? (
              <img
                src={primaryImage(projects[0])!}
                alt={projects[0].name}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-sm text-slate-400">
                Нет фото проекта
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Каталог для покупателя</h2>
        <p className="mt-1 text-sm text-slate-500">
          Контент домов — с завода. Цена на карточке — ваша розница из раздела «Цены».
        </p>

        {projects.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">Нет проектов для витрины.</p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const image = primaryImage(project);
              const specs = [
                project.area ? `${project.area} м²` : null,
                project.floors ? `${project.floors} эт.` : null,
                project.bedrooms ? `${project.bedrooms} сп.` : null
              ].filter(Boolean);
              const extras = project.dealerExtras?.slice(0, 2) ?? [];

              return (
                <article
                  key={project.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {image ? (
                      <img src={image} alt={project.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        Нет фото
                      </div>
                    )}
                    <Badge
                      variant={technologyBadgeVariant(project.technology)}
                      className="absolute left-3 top-3"
                    >
                      {technologyBadgeCode(project.technology)}
                    </Badge>
                  </div>
                  <div className="space-y-2 p-4">
                    <h3 className="font-semibold">{project.name}</h3>
                    {specs.length ? (
                      <p className="text-sm text-slate-500">{specs.join(" · ")}</p>
                    ) : null}
                    <p className="text-lg font-semibold tabular-nums">
                      {project.priceOnRequest || project.basePrice == null
                        ? "Цена по запросу"
                        : `от ${formatRub(project.basePrice)}`}
                    </p>
                    {extras.length > 0 ? (
                      <ul className="space-y-1 text-xs text-slate-500">
                        {extras.map((extra) => (
                          <li key={extra.id}>
                            + {extra.name}
                            {extra.price != null ? ` · ${formatRub(extra.price)}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <Button type="button" variant="outline" className="w-full" size="sm">
                      {draft.ctaLabel || "Запросить цену"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-6 px-6 py-10 text-sm">
          <div>
            <p className="font-semibold">{draft.name}</p>
            <p className="mt-1 text-slate-500">Дилер AVGST · {host}</p>
          </div>
          <div className="text-slate-600">
            <p>{draft.contactPhone}</p>
            <p>{draft.contactEmail}</p>
            <p>{draft.address}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
