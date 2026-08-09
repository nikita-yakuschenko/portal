import {
  IconBook,
  IconInbox,
  IconLayoutDashboard,
  IconMessageCircle,
  IconSettings,
  IconWorld
} from "@tabler/icons-react";

import type { NavigationItem } from "@/components/app-sidebar";

export const partnerCabinetLabel = "Дилер";

/** Основное меню сайдбара — без аккаунтных разделов */
export const partnerNavigation: NavigationItem[] = [
  { title: "Главная", href: "/partner", icon: IconLayoutDashboard },
  { title: "Сайт", href: "/partner/site", icon: IconWorld },
  { title: "Каталог", href: "/partner/catalog", icon: IconBook },
  { title: "Сделки", href: "/partner/deals", icon: IconInbox },
  { title: "Мессенджер", href: "/partner/messenger", icon: IconMessageCircle }
];

/** Пункты в меню профиля (низ сайдбара) */
export const partnerAccountMenu: NavigationItem[] = [
  { title: "Настройки", href: "/partner/settings", icon: IconSettings }
];
