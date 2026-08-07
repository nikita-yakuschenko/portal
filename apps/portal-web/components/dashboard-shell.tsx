"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { AppSidebar, type NavigationItem } from "@/components/app-sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { companyAccountMenu } from "@/lib/company-nav";
import { partnerCabinetLabel } from "@/lib/partner-nav";
import {
  enablePortalSound,
  initPortalSounds,
  subscribePortalSound,
  wasPortalSoundBlocked
} from "@/lib/portal-sounds";

const PARTNER_TEST_BANNER =
  "Партнёрский кабинет работает в тестовом и экспериментальном режиме · доступ к функционалу может прерываться · информация носит тестовый характер · релиз полноценного функционала запланирован на 01.09";

function PartnerTestModeBanner() {
  return (
    <div
      role="status"
      className="bg-brand-yellow text-brand-yellow-foreground shrink-0 overflow-hidden border-b md:rounded-t-xl"
    >
      <div className="animate-partner-marquee flex w-max py-2 text-xs font-semibold tracking-wide uppercase">
        <span className="inline-block px-10">{PARTNER_TEST_BANNER}</span>
        <span className="inline-block px-10" aria-hidden>
          {PARTNER_TEST_BANNER}
        </span>
      </div>
    </div>
  );
}

export function DashboardShell(props: {
  /** Подпись кабинета под названием бренда в сайдбаре */
  cabinetLabel: string;
  /** Явный тип кабинета — не завязываемся только на текст подписи */
  cabinetKind?: "company" | "partner";
  currentPath: string;
  navigation: NavigationItem[];
  /** Заголовок бренда в сайдбаре (по умолчанию AVGST / Партнёр) */
  brandTitle?: string;
  /** Логотип партнёра (сокращённая версия) */
  brandLogoSrc?: string | null;
  /** Ссылка с логотипа/названия */
  brandHref?: string;
  /** Заголовок хедера; по умолчанию — title активного пункта навигации */
  title?: string;
  /** Классические breadcrumbs вместо заголовка */
  breadcrumbs?: React.ReactNode;
  /** Контент справа в верхнем хедере */
  headerActions?: React.ReactNode;
  /** Контент по центру хедера (поверх заголовка), например поиск раздела мессенджера */
  headerCenter?: React.ReactNode;
  /** Без паддингов, центрирующей колонки и скролла шелла — контент сам занимает всё пространство и сам скроллится (мессенджер) */
  fluidContent?: boolean;
  children: React.ReactNode;
}) {
  // Звук готовим заранее, а о блокировке браузером говорим прямо — молча терять сигнал нельзя
  useEffect(() => {
    initPortalSounds();
    let notified = false;
    const sync = () => {
      if (notified || !wasPortalSoundBlocked()) return;
      notified = true;
      toast.info("Браузер заблокировал звук уведомлений", {
        description: "Уведомления приходят, но без сигнала. Включите звук в этой вкладке.",
        duration: 15_000,
        action: { label: "Включить", onClick: () => void enablePortalSound() }
      });
    };
    sync();
    return subscribePortalSound(sync);
  }, []);

  const isPartnerCabinet =
    props.cabinetKind === "partner" || props.cabinetLabel === partnerCabinetLabel;

  const accountMenuItems = isPartnerCabinet ? [] : companyAccountMenu;

  const navForTitle = [...props.navigation, ...accountMenuItems];
  const activeHref = navForTitle
    .map((item) => item.href)
    .filter(
      (href) => props.currentPath === href || props.currentPath.startsWith(`${href}/`)
    )
    .sort((a, b) => b.length - a.length)[0];

  const sectionTitle =
    props.title ??
    navForTitle.find((item) => item.href === props.currentPath)?.title ??
    navForTitle.find((item) => item.href === activeHref)?.title ??
    "";

  const sidebarActiveHref = props.navigation.some(
    (item) =>
      props.currentPath === item.href || props.currentPath.startsWith(`${item.href}/`)
  )
    ? activeHref
    : undefined;

  return (
    // Кабинет = высота вьюпорта. Шапка на месте. Крутится только контент под ней.
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        variant="inset"
        cabinetLabel={props.cabinetLabel}
        navigation={props.navigation}
        accountMenuItems={accountMenuItems}
        activeHref={sidebarActiveHref}
        plainBrandMark={!isPartnerCabinet}
        brandTitle={props.brandTitle ?? (isPartnerCabinet ? "Партнёр" : "Авангард Строй")}
        brandLogoSrc={props.brandLogoSrc ?? null}
        brandHref={props.brandHref ?? (isPartnerCabinet ? "/partner" : "/")}
      />
      <SidebarInset className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        {isPartnerCabinet ? <PartnerTestModeBanner /> : null}

        <header
          className={[
            "bg-background relative z-30 flex min-h-16 shrink-0 items-center gap-2 border-b px-4 py-3",
            isPartnerCabinet ? "" : "md:rounded-t-xl"
          ].join(" ")}
        >
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="mr-1 data-[orientation=vertical]:h-4"
          />
          {props.breadcrumbs ?? (
            <h1 className="min-w-0 flex-1 truncate text-base font-medium">{sectionTitle}</h1>
          )}
          {props.headerCenter ? (
            <div className="pointer-events-none absolute inset-x-0 hidden justify-center sm:flex">
              <div className="pointer-events-auto">{props.headerCenter}</div>
            </div>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {props.headerActions}
            <NotificationsBell
              listHref={isPartnerCabinet ? "/partner/notifications" : "/company/notifications"}
            />
          </div>
        </header>

        {props.fluidContent ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{props.children}</div>
        ) : (
          <div className="cabinet-content-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6">
            {/* Колонка по центру: 980 → 1280 (≥1600) → 1366 (≥1920) */}
            <div className="mx-auto flex w-full max-w-[980px] flex-1 flex-col gap-4 md:gap-6 min-[1600px]:max-w-[1280px] min-[1920px]:max-w-[1366px]">
              {props.children}
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
