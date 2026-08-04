"use client";

import Link from "next/link";
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "@/components/ui/sidebar";

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

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  cabinetLabel: string;
  navigation: NavigationItem[];
  activeHref?: string | undefined;
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
  brandTitle = "Авангард Строй",
  brandLogoSrc = null,
  plainBrandMark = false,
  brandHref = "/",
  ...props
}: AppSidebarProps) {
  const logo = brandLogoSrc?.trim() || null;

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
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
