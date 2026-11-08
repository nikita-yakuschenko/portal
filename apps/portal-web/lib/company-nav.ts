import {
  IconBuildingFactory2,
  IconLayoutDashboard,
  IconMessageCircle,
  IconSmartHome,
  IconUsers,
  IconUserShield
} from "@tabler/icons-react";

import type { NavigationItem } from "@/components/app-sidebar";

export const companyNavigation: NavigationItem[] = [
  { title: "Главная", href: "/portal", icon: IconLayoutDashboard },
  { title: "Партнёры", href: "/portal/partners", icon: IconUsers },
  { title: "Каталог", href: "/portal/catalog", icon: IconSmartHome },
  { title: "Общий раздел", href: "/portal/general", icon: IconBuildingFactory2 },
  { title: "Мессенджер", href: "/portal/messenger", icon: IconMessageCircle }
];

/** Пункты в меню профиля (низ сайдбара) */
export const companyAccountMenu: NavigationItem[] = [
  { title: "Команда", href: "/portal/team", icon: IconUserShield }
];

export const companyCabinetLabel = "Управление B2B-порталом";
