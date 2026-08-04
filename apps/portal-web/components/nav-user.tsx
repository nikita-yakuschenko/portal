"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  IconCheck,
  IconDeviceDesktop,
  IconLogout,
  IconMoon,
  IconSelector,
  IconSun
} from "@tabler/icons-react";

import type { NavigationItem } from "@/components/app-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

type SessionUser = {
  role: string;
  fullName?: string;
  email?: string;
};

const ROLE_LABEL: Record<string, string> = {
  company_admin: "Администратор завода",
  company_manager: "Менеджер завода",
  partner_owner: "Владелец кабинета",
  partner_member: "Сотрудник"
};

const THEME_OPTIONS = [
  { value: "light", label: "Светлая", icon: IconSun },
  { value: "dark", label: "Тёмная", icon: IconMoon },
  { value: "system", label: "Системная", icon: IconDeviceDesktop }
] as const;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function NavUser({
  accountMenuItems = []
}: {
  accountMenuItems?: NavigationItem[];
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await apiFetch<{ user: SessionUser }>("/api/auth/session");
        if (!cancelled) setUser(session.user);
      } catch {
        // роль уже проверил AuthGate на сервере; здесь только имя в меню
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // всё равно уходим на логин
    }
    router.replace("/login");
  }

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="size-8 rounded-lg" />
            <div className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const name = user.fullName || user.email || "Пользователь";
  const activeTheme = mounted ? theme : undefined;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
              </div>
              <IconSelector className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side="top"
            align="start"
            sideOffset={8}
            collisionPadding={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
              Настройки
            </DropdownMenuLabel>
            {accountMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>
                    <Icon />
                    {item.title}
                  </Link>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconSun />
                Тема
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {THEME_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = activeTheme === option.value;
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => setTheme(option.value)}
                    >
                      <Icon />
                      {option.label}
                      {selected ? <IconCheck className="ml-auto size-4" /> : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void handleLogout()}>
              <IconLogout />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
