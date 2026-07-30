import {
  IconBook,
  IconBuilding,
  IconHelpCircle,
  IconMessages,
  IconPlugConnected,
  IconUsers
} from "@tabler/icons-react";

import { DashboardShell } from "../../components/dashboard-shell";
import { StatCard } from "../../components/stat-card";

const navigation = [
  { title: "Обзор", href: "/partner", icon: IconBuilding },
  { title: "Сотрудники", href: "/partner/team", icon: IconUsers },
  { title: "CRM", href: "/partner/crm", icon: IconPlugConnected },
  { title: "Каталог", href: "/partner/catalog", icon: IconBook },
  { title: "Лиды", href: "/partner/leads", icon: IconMessages },
  { title: "Запросы", href: "/partner/inquiries", icon: IconHelpCircle }
];

export default function PartnerPage() {
  return (
    <DashboardShell
      title="Кабинет партнёра"
      subtitle="Рабочий контур дилера"
      currentPath="/partner"
      navigation={navigation}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Каталог доступен" value="24" hint="Проекта готовы к работе" />
        <StatCard title="Лиды за неделю" value="7" hint="3 отправлены в CRM сегодня" />
        <StatCard title="CRM статус" value="OK" hint="Подключение активно" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <IconBook size={20} className="text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-950">Проекты в работе</h2>
          </div>

          <div className="mt-4 space-y-3">
            {[
              ["Зимний 54", "Базовая цена видна, 2 запроса"],
              ["Север 87", "Цена по запросу, 1 запрос"],
              ["Лето 102", "Материалы просмотрены 5 раз"]
            ].map(([name, status]) => (
              <div key={name} className="rounded-xl border border-slate-200 px-4 py-3">
                <p className="font-medium text-slate-950">{name}</p>
                <p className="mt-1 text-sm text-slate-500">{status}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <IconMessages size={20} className="text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-950">Последние действия</h2>
          </div>

          <div className="mt-4 space-y-4">
            {[
              ["CRM", "Новая интеграция сохранена"],
              ["Каталог", "Синхронизация обновила 24 проекта"],
              ["Запрос", "Отправлен запрос по комплектации дома"]
            ].map(([label, text]) => (
              <div key={text} className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm text-slate-900">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
