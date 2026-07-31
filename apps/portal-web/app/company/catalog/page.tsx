"use client";

import { useEffect, useState } from "react";

import { DashboardShell } from "../../../components/dashboard-shell";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

type Project = {
  id: string;
  name: string;
  area: number | null;
  floors: number | null;
  basePrice: number | null;
  projectUrl: string;
  active: boolean;
};

export default function CompanyCatalogPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setProjects(await apiFetch<Project[]>("/api/company/catalog/projects"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить каталог");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/catalog"
      navigation={companyNavigation}
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Проекты ({projects.length})</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-slate-500">
              Каталог пуст. Запустите синхронизацию с Tilda в разделе «Синхронизации».
            </p>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-950">{project.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {[
                      project.area ? `${project.area} м²` : null,
                      project.floors ? `${project.floors} эт.` : null,
                      project.basePrice
                        ? `${project.basePrice.toLocaleString("ru-RU")} ₽`
                        : "цена по запросу",
                      project.active ? "активен" : "скрыт"
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <a
                  href={project.projectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-avgst-green hover:underline"
                >
                  На сайте
                </a>
              </div>
            ))
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
