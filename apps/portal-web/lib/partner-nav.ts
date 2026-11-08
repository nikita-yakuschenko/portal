import {
  IconBook,
  IconBuildingFactory2,
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
  { title: "Главная", href: "/portal", icon: IconLayoutDashboard },
  { title: "Сайт", href: "/portal/site", icon: IconWorld },
  { title: "Общий раздел", href: "/portal/general", icon: IconBuildingFactory2 },
  { title: "Каталог", href: "/portal/catalog", icon: IconBook },
  { title: "Сделки", href: "/portal/deals", icon: IconInbox },
  { title: "Мессенджер", href: "/portal/messenger", icon: IconMessageCircle }
];

/** Пункты в меню профиля (низ сайдбара) */
export const partnerAccountMenu: NavigationItem[] = [
  { title: "Настройки", href: "/portal/settings", icon: IconSettings }
];

/**
 * Общий дилерский вход (роль dealer_guest): своего кабинета у него нет,
 * поэтому в меню только то, ради чего он заходит.
 */
export const dealerGuestNavigation: NavigationItem[] = [
  { title: "Общий раздел", href: "/portal/general", icon: IconBuildingFactory2 }
];
