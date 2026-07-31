import {
  IconBuildingStore,
  IconFolder,
  IconRefresh,
  IconUsersGroup
} from "@tabler/icons-react";

export const companyNavigation = [
  { title: "Заявки", href: "/company", icon: IconFolder },
  { title: "Партнёры", href: "/company/partners", icon: IconUsersGroup },
  { title: "Каталог", href: "/company/catalog", icon: IconBuildingStore },
  { title: "Синхронизации", href: "/company/sync", icon: IconRefresh }
];

export const companyCabinetLabel = "Управление дилерской сетью";
