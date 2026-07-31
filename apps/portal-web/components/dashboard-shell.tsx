"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Icon } from "@tabler/icons-react";
import { IconLogout2, IconUserCircle } from "@tabler/icons-react";

import { apiFetch } from "@/lib/api";
import { partnerCabinetLabel } from "@/lib/partner-nav";
import { BrandLogo } from "./brand-logo";

type NavigationItem = {
  title: string;
  href: string;
  icon: Icon;
};

const PARTNER_TEST_BANNER =
  "Партнёрский кабинет работает в тестовом и экспериментальном режиме · доступ к функционалу может прерываться · информация носит тестовый характер · релиз полноценного функционала запланирован на 01.09";

function PartnerTestModeBanner() {
  return (
    <div
      role="status"
      className="shrink-0 overflow-hidden border-b border-black/15 bg-avgst-yellow"
    >
      <div className="flex w-max animate-partner-marquee py-2.5 text-sm font-extrabold uppercase tracking-[0.04em] text-black">
        <span className="inline-block px-10">{PARTNER_TEST_BANNER}</span>
        <span className="inline-block px-10" aria-hidden>
          {PARTNER_TEST_BANNER}
        </span>
      </div>
    </div>
  );
}

export function DashboardShell(props: {
  /** Подпись кабинета под логотипом в сайдбаре */
  cabinetLabel: string;
  currentPath: string;
  navigation: NavigationItem[];
  /** Заголовок хедера; по умолчанию — title активного пункта навигации */
  title?: string;
  /** Классические breadcrumbs вместо заголовка */
  breadcrumbs?: React.ReactNode;
  /** Контент справа в верхнем хедере (поиск, фильтры) */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const sectionTitle =
    props.title ??
    props.navigation.find((item) => item.href === props.currentPath)?.title ??
    "";

  const activeHref = [...props.navigation]
    .map((item) => item.href)
    .filter(
      (href) => props.currentPath === href || props.currentPath.startsWith(`${href}/`)
    )
    .sort((a, b) => b.length - a.length)[0];

  const isPartnerCabinet = props.cabinetLabel === partnerCabinetLabel;

  async function handleLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // всё равно уходим на логин
    }
    router.replace("/login");
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-slate-50 text-slate-950">
      {isPartnerCabinet ? <PartnerTestModeBanner /> : null}

      <div className="grid min-h-0 flex-1 md:grid-cols-[280px_1fr]">
        <aside className="flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white">
          <div className="flex h-[112px] shrink-0 flex-col justify-center border-b border-slate-200 px-6">
            <BrandLogo href="/" variant="wordmark" className="h-8 brightness-0" />
            <p className="mt-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {props.cabinetLabel}
            </p>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <ul className="space-y-1">
              {props.navigation.map((item) => {
                const isActive = item.href === activeHref;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={[
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      ].join(" ")}
                    >
                      <Icon size={18} stroke={1.75} />
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="shrink-0 border-t border-slate-200 px-4 py-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-900 p-2 text-white">
                  <IconUserCircle size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-950">Рабочая сессия</p>
                  <p className="truncate text-xs text-slate-500">Партнёрский портал</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"
              >
                <IconLogout2 size={16} />
                Выйти
              </button>
            </div>
          </div>
        </aside>

        <main className="flex h-full min-w-0 flex-col overflow-hidden">
          <header className="flex h-[112px] shrink-0 flex-col justify-center gap-3 border-b border-slate-200 bg-white px-6">
            {props.breadcrumbs ? (
              <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950">
                    {sectionTitle}
                  </h1>
                  <div className="min-w-0">{props.breadcrumbs}</div>
                </div>
                {props.headerActions ? (
                  <div className="flex shrink-0 items-center gap-2 pt-1">{props.headerActions}</div>
                ) : null}
              </div>
            ) : (
              <>
                <h1 className="text-base font-semibold text-slate-950">{sectionTitle}</h1>
                {props.headerActions ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {props.headerActions}
                  </div>
                ) : null}
              </>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">{props.children}</div>
        </main>
      </div>
    </div>
  );
}
