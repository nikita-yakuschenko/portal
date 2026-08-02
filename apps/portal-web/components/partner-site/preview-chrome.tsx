"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconMenu2, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { ConsultationDialog } from "@/components/partner-site/consultation-dialog";
import { SiteDocumentHead } from "@/components/partner-site/site-document-head";
import { PartnerSiteSocialGlyph, PartnerSiteSocialIcon } from "@/components/partner-site/social-icons";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { previewPaths } from "@/lib/partner-site-preview";
import { resolvePartnerSiteSocials, resolvePostLeadSocialPool } from "@/lib/partner-site-socials";
import type { PartnerSiteDraft } from "@/lib/partner-site-draft";
import { cn } from "@/lib/utils";

const NAV = [
  {
    href: previewPaths.home,
    label: "Главная",
    match: (path: string) => path === previewPaths.home
  },
  {
    href: previewPaths.catalog,
    label: "Каталог проектов",
    match: (path: string) => path.startsWith(previewPaths.catalog)
  },
  {
    href: previewPaths.contacts,
    label: "Контакты",
    match: (_path: string) => false
  }
] as const;

function BrandMark({
  draft,
  compact = false
}: {
  draft: PartnerSiteDraft;
  compact?: boolean;
}) {
  if (draft.logoDataUrl) {
    return (
      <img
        src={draft.logoDataUrl}
        alt={draft.name}
        className={cn(
          "w-auto object-contain drop-shadow-sm",
          compact ? "h-8 max-w-[120px]" : "h-9 max-w-[160px]"
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "font-bold uppercase tracking-wide text-white",
        compact ? "line-clamp-2 max-w-[7.5rem] text-xs leading-tight" : "text-base md:text-lg"
      )}
    >
      {draft.name || "Логотип"}
    </span>
  );
}

function BrandMarkFooter({ draft }: { draft: PartnerSiteDraft }) {
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
    <span className="text-lg font-bold uppercase tracking-wide text-white">
      {draft.name || "Логотип"}
    </span>
  );
}

/** Главная и карточка проекта — шапка поверх hero */
function isHeroUnderlay(pathname: string): boolean {
  if (pathname === previewPaths.home || pathname === "/") return true;
  // Публичный runtime: /catalog/:slug ; кабинет: /partner/site/preview/catalog/:slug
  if (/^\/catalog\/[^/]+$/.test(pathname)) return true;
  if (/^\/partner\/site\/preview\/catalog\/[^/]+$/.test(pathname)) return true;
  return false;
}

function SiteHeader({ draft }: { draft: PartnerSiteDraft }) {
  const pathname = usePathname();
  const { openLeadForm } = usePartnerSitePreview();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20">
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-6">
        {/* Мобилка: лого | телефон по центру | вопрос + бургер */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-2 shadow-sm backdrop-blur-md sm:px-3 lg:hidden">
          <Link href={previewPaths.home} className="min-w-0 shrink-0">
            <BrandMark draft={draft} compact />
          </Link>

          <div className="flex min-w-0 flex-1 justify-center px-1">
            {draft.contactPhone ? (
              <a
                href={`tel:${draft.contactPhone}`}
                className="truncate text-sm font-semibold tabular-nums text-white/95"
              >
                {draft.contactPhone}
              </a>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              size="lg"
              className="h-10 rounded-md bg-avgst-yellow px-2.5 text-xs font-semibold text-slate-950 hover:bg-avgst-yellow/90 sm:px-3 sm:text-sm"
              onClick={() => openLeadForm({ kind: "question" })}
            >
              Задать вопрос
            </Button>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white transition hover:bg-white/20 focus-visible:ring-[3px] focus-visible:ring-white/40 focus-visible:outline-none"
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <IconX className="size-5" stroke={1.75} />
              ) : (
                <IconMenu2 className="size-5" stroke={1.75} />
              )}
            </button>
          </div>
        </div>

        {/* Десктоп: лого + нав + телефон + вопрос */}
        <div className="pointer-events-auto hidden items-center justify-between gap-4 rounded-xl bg-black/25 px-4 py-2.5 shadow-sm backdrop-blur-md lg:flex">
          <Link href={previewPaths.home} className="shrink-0">
            <BrandMark draft={draft} />
          </Link>

          <nav className="flex items-center gap-1 text-sm text-white/80">
            {NAV.filter((item) => item.href !== previewPaths.home).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white",
                  item.match(pathname) && "bg-white/10 text-white"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {draft.contactPhone ? (
              <a
                href={`tel:${draft.contactPhone}`}
                className="text-sm font-semibold tabular-nums text-white/90 transition hover:text-white"
              >
                {draft.contactPhone}
              </a>
            ) : null}
            <Button
              type="button"
              size="lg"
              className="h-10 w-44 rounded-md bg-avgst-yellow font-semibold text-slate-950 hover:bg-avgst-yellow/90"
              onClick={() => openLeadForm({ kind: "question" })}
            >
              Задать вопрос
            </Button>
          </div>
        </div>
      </div>

      {/* Мобильное меню — на всю высоту, выезд справа */}
      <div
        className={cn(
          "pointer-events-auto fixed inset-0 z-50 lg:hidden",
          !menuOpen && "pointer-events-none"
        )}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300",
            menuOpen ? "opacity-100" : "opacity-0"
          )}
          aria-label="Закрыть меню"
          tabIndex={menuOpen ? 0 : -1}
          onClick={() => setMenuOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 right-0 flex h-dvh w-[min(100vw-3.5rem,19rem)] flex-col border-l border-white/15 bg-[#0f1216]/95 shadow-2xl shadow-black/50 backdrop-blur-xl transition-transform duration-300 ease-out",
            menuOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-5 pb-4">
            <Link href={previewPaths.home} onClick={() => setMenuOpen(false)} className="min-w-0">
              <BrandMark draft={draft} compact />
            </Link>
            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/15 focus-visible:ring-[3px] focus-visible:ring-white/40 focus-visible:outline-none"
              aria-label="Закрыть меню"
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
            >
              <IconX className="size-5" stroke={1.75} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 pb-4">
            <ul className="space-y-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    tabIndex={menuOpen ? 0 : -1}
                    className="block py-3 text-[0.95rem] font-semibold tracking-wide text-white/85 transition hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto space-y-3 border-t border-white/10 px-4 py-5">
            {draft.contactPhone ? (
              <a
                href={`tel:${draft.contactPhone}`}
                className="block text-sm font-semibold tabular-nums text-white/90"
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => setMenuOpen(false)}
              >
                {draft.contactPhone}
              </a>
            ) : null}
            <Button
              type="button"
              size="lg"
              tabIndex={menuOpen ? 0 : -1}
              className="h-10 w-44 rounded-md bg-avgst-yellow font-semibold text-slate-950 hover:bg-avgst-yellow/90"
              onClick={() => {
                setMenuOpen(false);
                openLeadForm({ kind: "question" });
              }}
            >
              Задать вопрос
            </Button>
          </div>
        </aside>
      </div>
    </header>
  );
}

function SiteFooter({ draft }: { draft: PartnerSiteDraft }) {
  const { partnerLegal } = usePartnerSitePreview();
  const aboutBlurb = draft.aboutText.trim();
  const year = new Date().getFullYear();
  // Коммерческое имя в копирайте; юр. название и ИНН — отдельными строками
  const copyrightName =
    partnerLegal?.companyName?.trim() || draft.name.trim() || "";
  const legalName = partnerLegal?.legalName?.trim() || "";
  const inn = partnerLegal?.inn || "";
  const footerSocials = resolvePartnerSiteSocials(draft);

  return (
    <footer className="mt-auto bg-[#0f1216] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,auto)] lg:gap-12 xl:gap-16">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <Link href={previewPaths.home} className="inline-block">
              <BrandMarkFooter draft={draft} />
            </Link>
            {aboutBlurb ? (
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55 line-clamp-5 whitespace-pre-line">
                {aboutBlurb}
              </p>
            ) : null}

            <div className="mt-6 max-w-md space-y-3 text-xs leading-relaxed text-white/40">
              <p>
                <Link
                  href={previewPaths.policy}
                  className="text-white/55 transition hover:text-avgst-green hover:underline"
                >
                  Политика конфиденциальности
                </Link>
              </p>
              <p>
                Информация, опубликованная на сайте предназначена для ознакомительных целей и не
                является публичной офертой, определяемой положениями Статьи 437 (2) ГК РФ
              </p>
              {copyrightName ? (
                <p>
                  © {year} {copyrightName}
                </p>
              ) : (
                <p>© {year}</p>
              )}
              {legalName || inn ? (
                <p>
                  {legalName || null}
                  {legalName && inn ? <br /> : null}
                  {inn ? <>ИНН {inn}</> : null}
                </p>
              ) : null}
            </div>
          </div>

          <nav aria-label="Каталог" className="text-sm">
            <p className="text-xs font-semibold tracking-wide text-white/40 uppercase">Каталог</p>
            <ul className="mt-3 space-y-2.5 text-white/75">
              <li>
                <Link
                  href={previewPaths.catalogByTechnology("modular")}
                  className="transition hover:text-avgst-green"
                >
                  Модульные дома
                </Link>
              </li>
              <li>
                <Link
                  href={previewPaths.catalogByTechnology("panel_frame")}
                  className="transition hover:text-avgst-green"
                >
                  Панельно-каркасные дома
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Разделы сайта" className="text-sm">
            <p className="text-xs font-semibold tracking-wide text-white/40 uppercase">Меню</p>
            <ul className="mt-3 space-y-2.5 text-white/75">
              <li>
                <Link href={previewPaths.home} className="transition hover:text-avgst-green">
                  Главная
                </Link>
              </li>
              <li>
                <Link href={previewPaths.catalog} className="transition hover:text-avgst-green">
                  Каталог проектов
                </Link>
              </li>
              <li>
                <Link href={previewPaths.contacts} className="transition hover:text-avgst-green">
                  Контакты
                </Link>
              </li>
            </ul>
          </nav>

          <div className="text-sm">
            <p className="text-xs font-semibold tracking-wide text-white/40 uppercase">Контакты</p>
            <ul className="mt-3 space-y-2.5 text-white/75">
              {draft.address ? <li className="leading-relaxed">{draft.address}</li> : null}
              {draft.contactPhone ? (
                <li>
                  <a
                    href={`tel:${draft.contactPhone}`}
                    className="font-medium tabular-nums transition hover:text-avgst-green"
                  >
                    {draft.contactPhone}
                  </a>
                </li>
              ) : null}
              {draft.contactEmail ? (
                <li>
                  <a
                    href={`mailto:${draft.contactEmail}`}
                    className="transition hover:text-avgst-green"
                  >
                    {draft.contactEmail}
                  </a>
                </li>
              ) : null}
            </ul>

            {footerSocials.length > 0 ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {footerSocials.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    aria-label={item.label}
                    title={item.label}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex overflow-visible text-white/80 transition hover:text-white"
                  >
                    {item.id === "dzen" ? (
                      <PartnerSiteSocialGlyph id={item.id} className="size-5" />
                    ) : (
                      <PartnerSiteSocialIcon id={item.id} tone="onDark" />
                    )}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}

export function PartnerSitePreviewChrome({ children }: { children: React.ReactNode }) {
  const {
    draft,
    loading,
    error,
    consultOpen,
    setConsultOpen,
    leadFormKind,
    consultProjectName,
    consultSelectionSummary,
    consultTechnology,
    consultProjectImageUrl,
    submitLead
  } = usePartnerSitePreview();
  const pathname = usePathname();
  const underlay = draft ? isHeroUnderlay(pathname) : false;

  // Пока нет draft — тихий фон; системные статусы пользователю не показываем
  if (!draft) {
    if (loading) {
      return <div className="min-h-svh bg-[#F5F6F8]" aria-busy="true" />;
    }
    return (
      <div className="flex min-h-svh items-center justify-center px-6 text-sm text-red-600">
        {error || "Нет данных"}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-[#F5F6F8] text-slate-950">
      <SiteDocumentHead draft={draft} />
      <SiteHeader draft={draft} />
      <main className={cn("flex-1", !underlay && "pt-24")}>
        {loading ? <div className="min-h-[50vh]" aria-busy="true" /> : children}
      </main>
      <SiteFooter draft={draft} />
      <ConsultationDialog
        open={consultOpen}
        onOpenChange={setConsultOpen}
        kind={leadFormKind}
        projectName={consultProjectName}
        selectionSummary={consultSelectionSummary}
        technology={consultTechnology}
        projectImageUrl={consultProjectImageUrl}
        brand={{
          name: draft.name,
          address: draft.address,
          logoDataUrl: draft.logoDataUrl
        }}
        postLeadSocialPool={resolvePostLeadSocialPool(draft)}
        onSubmitLead={submitLead}
      />
    </div>
  );
}
