"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { previewPaths } from "@/lib/partner-site-preview";
import type { PartnerSiteDraft } from "@/lib/partner-site-draft";

const NAV = [
  {
    href: previewPaths.projects,
    label: "Каталог проектов",
    match: (path: string) => path.startsWith(previewPaths.projects)
  },
  {
    href: previewPaths.about,
    label: "О нас",
    match: (path: string) => path === previewPaths.about
  },
  {
    href: previewPaths.contacts,
    label: "Контакты",
    match: (path: string) => path === previewPaths.contacts
  }
] as const;

function BrandMark({ draft }: { draft: PartnerSiteDraft }) {
  if (draft.logoDataUrl) {
    return (
      <img
        src={draft.logoDataUrl}
        alt={draft.name}
        className="h-10 w-auto max-w-[180px] object-contain"
      />
    );
  }

  return (
    <span className="text-lg font-bold uppercase tracking-wide text-slate-900">
      {draft.name || "Логотип"}
    </span>
  );
}

function SiteHeader({ draft }: { draft: PartnerSiteDraft }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white">
      {/* Основная шапка как на msk — без верхней плашки города/соцсетей */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <Link href={previewPaths.home} className="shrink-0">
          <BrandMark draft={draft} />
        </Link>

        <nav className="flex flex-wrap items-center gap-6 text-sm font-medium text-slate-800">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.match(pathname)
                  ? "text-avgst-green"
                  : "transition hover:text-avgst-green"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-4">
          {draft.contactPhone ? (
            <a
              href={`tel:${draft.contactPhone}`}
              className="text-sm font-semibold tabular-nums text-slate-900"
            >
              {draft.contactPhone}
            </a>
          ) : null}
          <Button
            asChild
            size="sm"
            className="rounded-md bg-avgst-yellow px-4 font-semibold text-slate-950 hover:bg-avgst-yellow/90"
          >
            <Link href={previewPaths.contacts}>Задать вопрос</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function SiteFooter({
  draft,
  socials
}: {
  draft: PartnerSiteDraft;
  socials: Array<{ label: string; href: string }>;
}) {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 md:flex-row md:justify-between">
        <div>
          <Link href={previewPaths.home}>
            <BrandMark draft={draft} />
          </Link>
          {draft.address ? <p className="mt-3 text-sm text-slate-500">{draft.address}</p> : null}
          <nav className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
            <Link href={previewPaths.projects} className="hover:text-avgst-green">
              Каталог проектов
            </Link>
            <Link href={previewPaths.about} className="hover:text-avgst-green">
              О нас
            </Link>
            <Link href={previewPaths.contacts} className="hover:text-avgst-green">
              Контакты
            </Link>
          </nav>
        </div>
        <div className="space-y-1 text-sm text-slate-600">
          {draft.contactPhone ? (
            <p>
              <a href={`tel:${draft.contactPhone}`} className="font-medium hover:text-avgst-green">
                {draft.contactPhone}
              </a>
            </p>
          ) : null}
          {draft.contactEmail ? (
            <p>
              <a href={`mailto:${draft.contactEmail}`} className="hover:text-avgst-green">
                {draft.contactEmail}
              </a>
            </p>
          ) : null}
        </div>
        {socials.length > 0 ? (
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            {socials.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-avgst-green"
              >
                {item.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </footer>
  );
}

export function PartnerSitePreviewChrome({ children }: { children: React.ReactNode }) {
  const { draft, host, socials, loading, error } = usePartnerSitePreview();

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
    <div className="flex min-h-svh flex-col bg-[#F5F6F8] text-slate-950">
      <div
        role="status"
        className="border-b border-slate-300/80 bg-slate-900 px-4 py-1.5 text-center text-[11px] font-medium text-slate-200"
      >
        Предпросмотр · {host || "домен не задан"} · структура как msk.avgst.ru · не опубликован
      </div>
      <SiteHeader draft={draft} />
      <main className="flex-1">{children}</main>
      <SiteFooter draft={draft} socials={socials} />
    </div>
  );
}
