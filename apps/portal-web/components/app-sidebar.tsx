"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TablerIcon } from "@tabler/icons-react";

import { AdaptiveBrandMark } from "@/components/adaptive-brand-mark";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import { apiFetch } from "@/lib/api";
import { PORTAL_EVENT } from "@/lib/portal-events";
import { playPortalSound } from "@/lib/portal-sounds";

export type NavigationItem = {
  title: string;
  href: string;
  icon: TablerIcon;
};

function brandInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isMessengerHref(href: string) {
  return href.endsWith("/messenger");
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  cabinetLabel: string;
  navigation: NavigationItem[];
  activeHref?: string | undefined;
  /** Пункты «Настройки» в меню профиля */
  accountMenuItems?: NavigationItem[];
  /** Заголовок бренда в шапке сайдбара */
  brandTitle?: string;
  /** Свой логотип (партнёр — сокращённая версия) */
  brandLogoSrc?: string | null;
  /** Лого AVGST без цветного поля (кабинет завода) */
  plainBrandMark?: boolean;
  brandHref?: string;
};

export function AppSidebar({
  cabinetLabel,
  navigation,
  activeHref,
  accountMenuItems = [],
  brandTitle = "Авангард Строй",
  brandLogoSrc = null,
  plainBrandMark = false,
  brandHref = "/",
  ...props
}: AppSidebarProps) {
  const logo = brandLogoSrc?.trim() || null;
  const hasMessenger = navigation.some((item) => isMessengerHref(item.href));
  const [messengerUnread, setMessengerUnread] = useState(0);
  // null — первая загрузка, на ней не звучим
  const seenUnreadRef = useRef<number | null>(null);

  const refreshMessengerUnread = useCallback(async () => {
    if (!hasMessenger) return;
    try {
      const res = await apiFetch<{ count: number }>("/api/messenger/unread-count");
      const count = res.count ?? 0;
      const seen = seenUnreadRef.current;
      // На самой странице мессенджера звук даёт мессенджер — здесь молчим
      const onMessengerPage = isMessengerHref(window.location.pathname);
      if (seen !== null && count > seen && !onMessengerPage) {
        playPortalSound("message");
      }
      seenUnreadRef.current = count;
      setMessengerUnread(count);
    } catch {
      /* сессия/сеть — бейдж молчит */
    }
  }, [hasMessenger]);

  useEffect(() => {
    if (!hasMessenger) return;
    void refreshMessengerUnread();
    const timer = window.setInterval(() => void refreshMessengerUnread(), 8_000);
    const onRefresh = () => void refreshMessengerUnread();
    window.addEventListener(PORTAL_EVENT.messengerActivity, onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(PORTAL_EVENT.messengerActivity, onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [hasMessenger, refreshMessengerUnread]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={brandHref}>
                {logo ? (
                  <AdaptiveBrandMark
                    src={logo}
                    className="size-8 shrink-0 rounded-lg"
                  />
                ) : plainBrandMark ? (
                  <AdaptiveBrandMark
                    src="/logo.svg"
                    toneHint="light"
                    className="size-8 shrink-0"
                  />
                ) : (
                  <div className="bg-muted text-muted-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
                    {brandInitials(brandTitle) || "—"}
                  </div>
                )}
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{brandTitle}</span>
                  <span className="text-muted-foreground truncate text-xs">{cabinetLabel}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Разделы</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const Icon = item.icon;
                const showUnread = isMessengerHref(item.href) && messengerUnread > 0;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.href === activeHref}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {showUnread ? (
                      <SidebarMenuBadge className="bg-primary text-primary-foreground rounded-full">
                        {messengerUnread > 99 ? "99+" : messengerUnread}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser accountMenuItems={accountMenuItems} />
      </SidebarFooter>
    </Sidebar>
  );
}
