import {
  IconBuildingStore,
  IconInbox,
  IconRefresh,
  IconUsers,
  IconUserShield,
  IconWorldWww
} from "@tabler/icons-react";

export const companyNavigation = [
  { title: "Заявки", href: "/company", icon: IconInbox },
  { title: "Партнёры", href: "/company/partners", icon: IconUsers },
  { title: "Сайты", href: "/company/sites", icon: IconWorldWww },
  { title: "Каталог", href: "/company/catalog", icon: IconBuildingStore },
  { title: "Синхронизации", href: "/company/sync", icon: IconRefresh },
  { title: "Команда", href: "/company/team", icon: IconUserShield }
];

export const companyCabinetLabel = "Управление дилерской сетью";
