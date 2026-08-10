import {
  IconBuildingFactory2,
  IconLayoutDashboard,
  IconMessageCircle,
  IconRefresh,
  IconSmartHome,
  IconUsers,
  IconUserShield
} from "@tabler/icons-react";

import type { NavigationItem } from "@/components/app-sidebar";

export const companyNavigation: NavigationItem[] = [
  { title: "Главная", href: "/company", icon: IconLayoutDashboard },
  { title: "Партнёры", href: "/company/partners", icon: IconUsers },
  { title: "Каталог", href: "/company/catalog", icon: IconSmartHome },
  { title: "Общий раздел", href: "/company/general", icon: IconBuildingFactory2 },
  { title: "Мессенджер", href: "/company/messenger", icon: IconMessageCircle }
];

/** Пункты в меню профиля (низ сайдбара) */
export const companyAccountMenu: NavigationItem[] = [
  { title: "Синхронизации", href: "/company/sync", icon: IconRefresh },
  { title: "Команда", href: "/company/team", icon: IconUserShield }
];

export const companyCabinetLabel = "Управление B2B-порталом";
