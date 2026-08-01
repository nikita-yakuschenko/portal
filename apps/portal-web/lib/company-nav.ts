import { Inbox, RefreshCw, Store, Users } from "lucide-react";

export const companyNavigation = [
  { title: "Заявки", href: "/company", icon: Inbox },
  { title: "Партнёры", href: "/company/partners", icon: Users },
  { title: "Каталог", href: "/company/catalog", icon: Store },
  { title: "Синхронизации", href: "/company/sync", icon: RefreshCw }
];

export const companyCabinetLabel = "Управление дилерской сетью";
