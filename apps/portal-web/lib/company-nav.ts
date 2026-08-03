import {
  IconBell,
  IconBuildingStore,
  IconInbox,
  IconRefresh,
  IconUsers,
  IconUserShield
} from "@tabler/icons-react";

export const companyNavigation = [
  { title: "Заявки", href: "/company", icon: IconInbox },
  { title: "Партнёры", href: "/company/partners", icon: IconUsers },
  { title: "Каталог", href: "/company/catalog", icon: IconBuildingStore },
  { title: "Синхронизации", href: "/company/sync", icon: IconRefresh },
  { title: "Команда", href: "/company/team", icon: IconUserShield },
  { title: "Уведомления", href: "/company/notifications", icon: IconBell }
];

export const companyCabinetLabel = "Управление дилерской сетью";
