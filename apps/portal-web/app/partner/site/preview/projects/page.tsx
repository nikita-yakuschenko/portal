"use client";

import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { PartnerSiteProjectCard } from "@/components/partner-site/project-card";

export default function PartnerSiteProjectsPage() {
  const { draft, projects } = usePartnerSitePreview();
  if (!draft) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        {draft.catalogTitle || "Проекты"}
      </h1>
      <p className="mt-3 max-w-2xl text-base text-slate-600">
        {draft.catalogText || "Выберите дом по площади и планировке."}
      </p>

      {projects.length === 0 ? (
        <p className="mt-12 text-sm text-slate-500">Пока нет опубликованных проектов.</p>
      ) : (
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <PartnerSiteProjectCard
              key={project.id}
              project={project}
              ctaLabel="Посмотреть проект"
            />
          ))}
        </div>
      )}
    </div>
  );
}
