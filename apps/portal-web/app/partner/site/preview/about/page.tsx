"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { previewPaths } from "@/lib/partner-site-preview";

export default function PartnerSiteAboutPage() {
  const { draft, openLeadForm } = usePartnerSitePreview();
  if (!draft) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        {draft.aboutTitle || "О компании"}
      </h1>
      <p className="mt-6 text-base leading-relaxed text-slate-600 whitespace-pre-line">
        {draft.aboutText}
      </p>

      <dl className="mt-10 grid gap-6 border-t border-slate-200 pt-10 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-slate-500">Компания</dt>
          <dd className="mt-1 text-lg font-medium">{draft.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Регион</dt>
          <dd className="mt-1 text-lg font-medium">{draft.address || "—"}</dd>
        </div>
      </dl>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild className="bg-slate-900 text-white hover:bg-slate-800">
          <Link href={previewPaths.catalog}>Смотреть проекты</Link>
        </Button>
        <Button type="button" variant="outline" onClick={() => openLeadForm({ kind: "contact" })}>
          Связаться
        </Button>
      </div>
    </div>
  );
}
