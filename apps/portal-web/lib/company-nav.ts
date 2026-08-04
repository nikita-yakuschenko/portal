import {
  IconBuildingStore,
  IconLayoutDashboard,
  IconMessage,
  IconRefresh,
  IconUsers,
  IconUserShield
} from "@tabler/icons-react";

export const companyNavigation = [
  { title: "Главная", href: "/company", icon: IconLayoutDashboard },
  { title: "Партнёры", href: "/company/partners", icon: IconUsers },
  { title: "Каталог", href: "/company/catalog", icon: IconBuildingStore },
  { title: "Синхронизации", href: "/company/sync", icon: IconRefresh },
  { title: "Команда", href: "/company/team", icon: IconUserShield },
  { title: "Мессенджер", href: "/company/messenger", icon: IconMessage }
];

export const companyCabinetLabel = "Управление B2B-порталом";
