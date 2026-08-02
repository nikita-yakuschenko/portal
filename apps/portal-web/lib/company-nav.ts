import {
  IconBuildingStore,
  IconInbox,
  IconRefresh,
  IconUsers
} from "@tabler/icons-react";

export const companyNavigation = [
  { title: "Заявки", href: "/company", icon: IconInbox },
  { title: "Партнёры", href: "/company/partners", icon: IconUsers },
  { title: "Каталог", href: "/company/catalog", icon: IconBuildingStore },
  { title: "Синхронизации", href: "/company/sync", icon: IconRefresh }
];

export const companyCabinetLabel = "Управление дилерской сетью";
