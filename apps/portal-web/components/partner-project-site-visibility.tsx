"use client";

import { useEffect, useState } from "react";
import { IconCircleCheck, IconEyeCheck, IconEyeOff } from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";

type PricingRow = {
  projectId: string;
  pricingMode: "markup" | "exact" | "on_request";
  markupPercent: number | null;
  publicPrice: number | null;
  isPublished: boolean;
  extras: Array<{
    id: string;
    title: string;
    items: Array<{ id: string; name: string; price?: number; note?: string }>;
  }>;
};

/** Публикация на сайт — бейдж + ссылка рядом с технологией в шапке проекта */
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

  async function toggle(nextPublished: boolean) {
    if (!canManage) return;
    setSaving(true);
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
      toast.success(
        nextPublished ? "Проект опубликован на сайте" : "Проект скрыт с сайта"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить публикацию");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <span className="bg-muted inline-block h-6 w-28 animate-pulse rounded-full" />;
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
      <Badge
        key={published ? "published" : "hidden"}
        variant={published ? "default" : "warning"}
        className="animate-in fade-in zoom-in-95 duration-200"
      >
        {published ? <IconCircleCheck /> : <IconEyeOff />}
        {published ? "Опубликован на сайте" : "Скрыт с сайта"}
      </Badge>

      {canManage ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          disabled={saving}
          className="text-muted-foreground hover:text-foreground h-auto gap-1.5 px-0"
          onClick={() => void toggle(!published)}
        >
          {saving ? (
            <Spinner className="size-3.5" />
          ) : published ? (
            <IconEyeOff className="size-3.5" />
          ) : (
            <IconEyeCheck className="size-3.5" />
          )}
          {published ? "Снять с публикации" : "Опубликовать"}
        </Button>
      ) : null}
    </span>
  );
}
