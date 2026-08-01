import {
  BookOpen,
  CircleHelp,
  Globe,
  LayoutDashboard,
  MessagesSquare,
  Plug,
  Users
} from "lucide-react";

export const partnerNavigation = [
  { title: "Обзор", href: "/partner", icon: LayoutDashboard },
  { title: "Сайт", href: "/partner/site", icon: Globe },
  { title: "Сотрудники", href: "/partner/team", icon: Users },
  { title: "CRM", href: "/partner/crm", icon: Plug },
  { title: "Каталог", href: "/partner/catalog", icon: BookOpen },
  { title: "Лиды", href: "/partner/leads", icon: MessagesSquare },
  { title: "Запросы", href: "/partner/inquiries", icon: CircleHelp }
];

export const partnerCabinetLabel = "Партнёрский кабинет";
