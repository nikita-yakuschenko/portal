import Link from "next/link";
import type { Icon } from "@tabler/icons-react";
import { IconChevronRight, IconLogout2, IconUserCircle } from "@tabler/icons-react";

import { BrandLogo } from "./brand-logo";

type NavigationItem = {
  title: string;
  href: string;
  icon: Icon;
};

export function DashboardShell(props: {
  title: string;
  subtitle: string;
  currentPath: string;
  navigation: NavigationItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="grid min-h-screen md:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="inline-flex rounded-md bg-avgst-graphite px-3 py-2">
              <BrandLogo href="/" variant="wordmark" className="h-7" />
            </div>
            <h1 className="mt-3 text-lg font-semibold text-slate-950">{props.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p>
          </div>

          <nav className="px-4 py-4">
            <ul className="space-y-1">
              {props.navigation.map((item) => {
                const isActive = props.currentPath === item.href;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={[
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      ].join(" ")}
                    >
                      <Icon size={18} stroke={1.75} />
                      <span>{item.title}</span>
                      <IconChevronRight size={16} className="ml-auto opacity-60" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto border-t border-slate-200 px-4 py-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-900 p-2 text-white">
                  <IconUserCircle size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-950">Рабочая сессия</p>
                  <p className="truncate text-xs text-slate-500">Inter + Tabler</p>
                </div>
              </div>
              <button className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950">
                <IconLogout2 size={16} />
                Выйти
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col">
          <header className="border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-950">{props.title}</p>
                <p className="text-sm text-slate-500">{props.subtitle}</p>
              </div>
            </div>
          </header>

          <div className="flex-1 p-6">{props.children}</div>
        </main>
      </div>
    </div>
  );
}
