"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type PricingRow = {
  projectId: string;
  pricingMode: "markup" | "exact" | "on_request";
  markupPercent: number | null;
  publicPrice: number | null;
  isPublished: boolean;
  extras: Array<{ id?: string; name: string; price?: number; note?: string }>;
};

/** Публикация проекта на сайт компании — отдельно от ценообразования */
export function PartnerProjectSiteVisibility({
  projectId,
  canManage
}: {
  projectId: string;
  canManage: boolean;
}) {
  const [row, setRow] = useState<PricingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const rows = await apiFetch<PricingRow[]>("/api/partner/pricing");
        setRow(rows.find((item) => item.projectId === projectId) ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const published = row?.isPublished ?? false;

  async function toggle() {
    if (!canManage) return;
    setSaving(true);
    setNotice("");
    const nextPublished = !published;
    try {
      await apiFetch("/api/partner/pricing", {
        method: "PUT",
        body: JSON.stringify({
          projectId,
          pricingMode: row?.pricingMode ?? "on_request",
          markupPercent: row?.markupPercent ?? undefined,
          publicPrice: row?.publicPrice ?? undefined,
          isPublished: nextPublished,
          extras: row?.extras ?? []
        })
      });
      setRow((prev) =>
        prev
          ? { ...prev, isPublished: nextPublished }
          : {
              projectId,
              pricingMode: "on_request",
              markupPercent: null,
              publicPrice: null,
              isPublished: nextPublished,
              extras: []
            }
      );
      setNotice(nextPublished ? "Проект на сайте" : "Проект скрыт с сайта");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-xs text-slate-400">Сайт…</p>;
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        type="button"
        size="sm"
        variant={published ? "default" : "outline"}
        disabled={!canManage || saving}
        onClick={() => void toggle()}
        className={
          published
            ? "bg-avgst-green text-white hover:bg-avgst-green/90"
            : undefined
        }
      >
        {saving
          ? "Сохраняем…"
          : published
            ? "На сайте компании"
            : "Не на сайте"}
      </Button>
      <p className="text-xs text-slate-500">
        {published
          ? "Показывается в каталоге вашего сайта"
          : "Скрыт — покупатели его не видят"}
      </p>
      {notice ? <p className="text-xs text-slate-600">{notice}</p> : null}
    </div>
  );
}
