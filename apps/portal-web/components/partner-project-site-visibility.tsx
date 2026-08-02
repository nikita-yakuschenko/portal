"use client";

import { useEffect, useState } from "react";
import { IconCircleCheck, IconEyeOff } from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Публикация на сайте</CardTitle>
        <CardDescription>
          {published
            ? "Проект показывается в каталоге вашего сайта — покупатели могут оставить заявку."
            : "Проект виден только в кабинете. На сайте покупатели его не найдут."}
        </CardDescription>
        {canManage ? (
          <CardAction>
            <Button
              type="button"
              variant={published ? "outline" : "default"}
              disabled={saving}
              onClick={() => void toggle(!published)}
            >
              {saving ? <Spinner /> : null}
              {published ? "Снять с публикации" : "Опубликовать"}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Badge
          key={published ? "published" : "hidden"}
          variant={published ? "default" : "secondary"}
          className="animate-in fade-in zoom-in-95 duration-200"
        >
          {published ? <IconCircleCheck /> : <IconEyeOff />}
          {published ? "Опубликован на сайте" : "Скрыт с сайта"}
        </Badge>
      </CardContent>
    </Card>
  );
}
