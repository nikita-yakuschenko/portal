"use client";

import { AppSidebar, type NavigationItem } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { NotificationsBell } from "@/components/notifications-bell";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { companyAccountMenu } from "@/lib/company-nav";
import { partnerCabinetLabel } from "@/lib/partner-nav";

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
  children: React.ReactNode;
}) {
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
    <SidebarProvider>
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
      <SidebarInset className="min-w-0">
        {isPartnerCabinet ? <PartnerTestModeBanner /> : null}

        <header
          className={[
            "bg-background sticky top-0 z-30 flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3",
            isPartnerCabinet ? "" : "md:rounded-t-xl"
          ].join(" ")}
        >
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <NotificationsBell
            listHref={isPartnerCabinet ? "/partner/notifications" : "/company/notifications"}
          />
          {props.breadcrumbs ?? (
            <h1 className="truncate text-base font-medium">{sectionTitle}</h1>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {props.headerActions}
            {/* Тема — в Настройках партнёра; для HQ оставляем быстрый переключатель */}
            {!isPartnerCabinet ? <ModeToggle /> : null}
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{props.children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
