"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { formatRub, resolveDealerDisplayPrice } from "@/lib/partner-pricing";

type Extra = { id: string; name: string; price?: number; note?: string };

type PricingMode = "markup" | "exact" | "on_request";

type PricingState = {
  pricingMode: PricingMode;
  markupPercent: number | null;
  publicPrice: number | null;
  isPublished: boolean;
  extras: Extra[];
};

function newExtraId() {
  return `extra_${Math.random().toString(36).slice(2, 9)}`;
}

export function PartnerProjectPricingPanel({
  projectId,
  factoryBasePrice,
  canManage
}: {
  projectId: string;
  factoryBasePrice: number | null;
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<PricingState>({
    pricingMode: "on_request",
    markupPercent: null,
    publicPrice: null,
    isPublished: false,
    extras: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const rows = await apiFetch<
          Array<{
            projectId: string;
            pricingMode: PricingMode;
            markupPercent: number | null;
            publicPrice: number | null;
            isPublished: boolean;
            extras: Extra[];
          }>
        >("/api/partner/pricing");
        const row = rows.find((item) => item.projectId === projectId);
        if (row) {
          setDraft({
            pricingMode: row.pricingMode,
            markupPercent: row.markupPercent,
            publicPrice: row.publicPrice,
            isPublished: row.isPublished,
            extras: row.extras ?? []
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const preview = resolveDealerDisplayPrice(factoryBasePrice, draft);

  async function handleSave() {
    setSaving(true);
    setNotice("");
    try {
      await apiFetch("/api/partner/pricing", {
        method: "PUT",
        body: JSON.stringify({
          projectId,
          pricingMode: draft.pricingMode,
          markupPercent: draft.markupPercent ?? undefined,
          publicPrice: draft.publicPrice ?? undefined,
          isPublished: draft.isPublished,
          extras: draft.extras
        })
      });
      setNotice("Цена и допы сохранены.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Загрузка цены...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <p className="text-slate-500">
          Заводская цена:{" "}
          <span className="font-medium text-slate-950">{formatRub(factoryBasePrice)}</span>
        </p>
        <p className="mt-1 text-slate-500">
          Ваша цена для покупателя:{" "}
          <span className="font-medium text-slate-950">
            {preview.onRequest ? "по запросу" : formatRub(preview.amount)}
          </span>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Режим цены</Label>
          <Select
            value={draft.pricingMode}
            disabled={!canManage}
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, pricingMode: value as PricingMode }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="markup">Наценка % от завода</SelectItem>
              <SelectItem value="exact">Точная цена</SelectItem>
              <SelectItem value="on_request">По запросу</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {draft.pricingMode === "markup" ? (
          <div className="space-y-1.5">
            <Label>Наценка, %</Label>
            <Input
              type="number"
              min={0}
              disabled={!canManage}
              value={draft.markupPercent ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  markupPercent: e.target.value === "" ? null : Number(e.target.value)
                }))
              }
            />
          </div>
        ) : null}

        {draft.pricingMode === "exact" ? (
          <div className="space-y-1.5">
            <Label>Ваша цена, ₽</Label>
            <Input
              type="number"
              min={0}
              disabled={!canManage}
              value={draft.publicPrice ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  publicPrice: e.target.value === "" ? null : Number(e.target.value)
                }))
              }
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={draft.isPublished ? "secondary" : "outline"}
          disabled={!canManage}
          onClick={() => setDraft((prev) => ({ ...prev, isPublished: !prev.isPublished }))}
        >
          {draft.isPublished ? "Показывать на сайте дилера" : "Скрыт с сайта дилера"}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Допы для покупателя</Label>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  extras: [...prev.extras, { id: newExtraId(), name: "Новая опция", price: 0 }]
                }))
              }
            >
              Добавить
            </Button>
          ) : null}
        </div>
        {draft.extras.length === 0 ? (
          <p className="text-sm text-slate-500">Пока без допов.</p>
        ) : (
          draft.extras.map((extra, index) => (
            <div key={extra.id} className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
              <Input
                value={extra.name}
                disabled={!canManage}
                onChange={(e) => {
                  const extras = [...draft.extras];
                  extras[index] = { ...extra, name: e.target.value };
                  setDraft((prev) => ({ ...prev, extras }));
                }}
              />
              <Input
                type="number"
                placeholder="Цена"
                disabled={!canManage}
                value={extra.price ?? ""}
                onChange={(e) => {
                  const extras = [...draft.extras];
                  extras[index] = {
                    ...extra,
                    price: e.target.value === "" ? undefined : Number(e.target.value)
                  };
                  setDraft((prev) => ({ ...prev, extras }));
                }}
              />
              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      extras: prev.extras.filter((item) => item.id !== extra.id)
                    }))
                  }
                >
                  Удалить
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>

      {notice ? <p className="text-sm text-slate-600">{notice}</p> : null}

      {canManage ? (
        <Button type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Сохраняем..." : "Сохранить цену"}
        </Button>
      ) : (
        <p className="text-sm text-slate-500">Изменять цены может только владелец кабинета.</p>
      )}
    </div>
  );
}
