import {
  IconBell,
  IconBook,
  IconHelpCircle,
  IconLayoutDashboard,
  IconMessages,
  IconSettings,
  IconWorld
} from "@tabler/icons-react";

import type { NavigationItem } from "@/components/app-sidebar";
import type { PartnerModules } from "@/lib/partner-modules";

export const partnerCabinetLabel = "Дилер";

/** Базовая навигация без опциональных модулей */
const BASE_NAV: NavigationItem[] = [
  { title: "Главная", href: "/partner", icon: IconLayoutDashboard },
  { title: "Сайт", href: "/partner/site", icon: IconWorld },
  { title: "Каталог", href: "/partner/catalog", icon: IconBook },
  { title: "Запросы", href: "/partner/inquiries", icon: IconHelpCircle },
  { title: "Уведомления", href: "/partner/notifications", icon: IconBell },
  { title: "Настройки", href: "/partner/settings", icon: IconSettings }
];

const LEADS_NAV: NavigationItem = {
  title: "Лиды",
  href: "/partner/leads",
  icon: IconMessages
};

/** Собирает меню партнёра с учётом включённых модулей */
export function buildPartnerNavigation(modules: PartnerModules): NavigationItem[] {
  const items = [...BASE_NAV];
  if (modules.leadsEnabled) {
    // Лиды — перед «Запросы»
    const inquiriesIdx = items.findIndex((item) => item.href === "/partner/inquiries");
    items.splice(inquiriesIdx === -1 ? items.length - 1 : inquiriesIdx, 0, LEADS_NAV);
  }
  return items;
}

/** @deprecated используйте buildPartnerNavigation + PartnerShell */
export const partnerNavigation = buildPartnerNavigation({ leadsEnabled: false });
