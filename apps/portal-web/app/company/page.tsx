import {
  IconActivityHeartbeat,
  IconBuildingStore,
  IconFolder,
  IconRefresh,
  IconUsersGroup
} from "@tabler/icons-react";

import { DashboardShell } from "../../components/dashboard-shell";
import { StatCard } from "../../components/stat-card";

const navigation = [
  { title: "Заявки", href: "/company", icon: IconFolder },
  { title: "Партнёры", href: "/company/partners", icon: IconUsersGroup },
  { title: "Каталог", href: "/company/catalog", icon: IconBuildingStore },
  { title: "Синхронизации", href: "/company/sync", icon: IconRefresh }
];

export default function CompanyPage() {
  return (
    <DashboardShell
      title="Кабинет вашей компании"
      subtitle="Управление дилерской сетью"
      currentPath="/company"
      navigation={navigation}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Заявки на подключение" value="4" hint="1 требует решения сегодня" />
        <StatCard title="Активные партнёры" value="6" hint="Текущий стартовый объём сети" />
        <StatCard title="Последняя синхронизация" value="09:15" hint="Каталог Tilda обновлён без ошибок" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <IconFolder size={20} className="text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-950">Очередь заявок</h2>
          </div>

          <div className="mt-4 space-y-3">
            {[
              ["СтройДом Киров", "Новая заявка, 11:20"],
              ["ДомСевер Тюмень", "На повторном рассмотрении"],
              ["Партнёр Новосибирск", "Ожидает комментарий менеджера"]
            ].map(([name, status]) => (
              <div key={name} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-950">{name}</p>
                  <p className="text-sm text-slate-500">{status}</p>
                </div>
                <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Открыть</button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <IconActivityHeartbeat size={20} className="text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-950">Активность сети</h2>
          </div>

          <div className="mt-4 space-y-4">
            {[
              ["Зимний 54", "12 запросов цены"],
              ["Север 87", "8 запросов цены"],
              ["Лето 102", "5 обращений партнёров"]
            ].map(([project, activity]) => (
              <div key={project} className="rounded-xl bg-slate-50 p-4">
                <p className="font-medium text-slate-950">{project}</p>
                <p className="mt-1 text-sm text-slate-500">{activity}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
