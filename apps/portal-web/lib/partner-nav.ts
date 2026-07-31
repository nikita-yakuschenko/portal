import {
  IconBook,
  IconBuilding,
  IconHelpCircle,
  IconMessages,
  IconPlugConnected,
  IconUsers,
  IconWorld
} from "@tabler/icons-react";

export const partnerNavigation = [
  { title: "Обзор", href: "/partner", icon: IconBuilding },
  { title: "Сайт", href: "/partner/site", icon: IconWorld },
  { title: "Сотрудники", href: "/partner/team", icon: IconUsers },
  { title: "CRM", href: "/partner/crm", icon: IconPlugConnected },
  { title: "Каталог", href: "/partner/catalog", icon: IconBook },
  { title: "Лиды", href: "/partner/leads", icon: IconMessages },
  { title: "Запросы", href: "/partner/inquiries", icon: IconHelpCircle }
];

export const partnerCabinetLabel = "Партнёрский кабинет";
