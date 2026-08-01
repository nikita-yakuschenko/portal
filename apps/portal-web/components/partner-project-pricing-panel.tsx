"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";
import { formatRub, resolveDealerDisplayPrice } from "@/lib/partner-pricing";

type Extra = { id: string; name: string; price?: number; note?: string };

type PricingMode = "markup" | "exact" | "on_request";

type PricingState = {
  pricingMode: PricingMode;
  markupPercent: number | null;
  publicPrice: number | null;
  extras: Extra[];
};

function newExtraId() {
  return `extra_${Math.random().toString(36).slice(2, 9)}`;
}

/** Extra с price: undefined нельзя собрать спредом при exactOptionalPropertyTypes */
function withPrice(extra: Extra, price: number | undefined): Extra {
  const { price: _omit, ...rest } = extra;
  return price === undefined ? rest : { ...rest, price };
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
            extras: Extra[];
          }>
        >("/api/partner/pricing");
        const row = rows.find((item) => item.projectId === projectId);
        if (row) {
          setDraft({
            pricingMode: row.pricingMode,
            markupPercent: row.markupPercent,
            publicPrice: row.publicPrice,
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
          markupPercent:
            draft.pricingMode === "markup" && draft.markupPercent != null
              ? Math.round(draft.markupPercent)
              : undefined,
          publicPrice:
            draft.pricingMode === "exact" && draft.publicPrice != null
              ? Math.round(draft.publicPrice)
              : undefined,
          extras: draft.extras.map((item) =>
            withPrice(item, item.price != null ? Math.round(item.price) : undefined)
          )
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
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-5">
      <div className="bg-muted rounded-lg px-4 py-3 text-sm">
        <p className="text-muted-foreground">
          Заводская цена: <span className="text-foreground font-medium">{formatRub(factoryBasePrice)}</span>
        </p>
        <p className="text-muted-foreground mt-1">
          Ваша цена для покупателя:{" "}
          <span className="text-foreground font-medium">
            {preview.onRequest ? "по запросу" : formatRub(preview.amount)}
          </span>
        </p>
      </div>

      <FieldGroup className="md:grid md:grid-cols-2 md:gap-4">
        <Field>
          <FieldLabel htmlFor="pricing-mode">Режим цены</FieldLabel>
          <Select
            value={draft.pricingMode}
            disabled={!canManage}
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, pricingMode: value as PricingMode }))
            }
          >
            <SelectTrigger id="pricing-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="markup">Наценка % от завода</SelectItem>
              <SelectItem value="exact">Точная цена</SelectItem>
              <SelectItem value="on_request">По запросу</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {draft.pricingMode === "markup" ? (
          <Field>
            <FieldLabel htmlFor="pricing-markup">Наценка, %</FieldLabel>
            <Input
              id="pricing-markup"
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
          </Field>
        ) : null}

        {draft.pricingMode === "exact" ? (
          <Field>
            <FieldLabel htmlFor="pricing-public">Ваша цена, ₽</FieldLabel>
            <Input
              id="pricing-public"
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
          </Field>
        ) : null}
      </FieldGroup>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel asChild>
            <p>Допы для покупателя</p>
          </FieldLabel>
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
              <Plus />
              Добавить
            </Button>
          ) : null}
        </div>

        {draft.extras.length === 0 ? (
          <p className="text-muted-foreground text-sm">Пока без допов.</p>
        ) : (
          draft.extras.map((extra, index) => (
            <div key={extra.id} className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
              <Input
                value={extra.name}
                disabled={!canManage}
                aria-label="Название опции"
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
                aria-label="Цена опции"
                value={extra.price ?? ""}
                onChange={(e) => {
                  const extras = [...draft.extras];
                  extras[index] = withPrice(
                    extra,
                    e.target.value === "" ? undefined : Number(e.target.value)
                  );
                  setDraft((prev) => ({ ...prev, extras }));
                }}
              />
              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Удалить «${extra.name}»`}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      extras: prev.extras.filter((item) => item.id !== extra.id)
                    }))
                  }
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>

      {notice ? <p className="text-muted-foreground text-sm">{notice}</p> : null}

      {canManage ? (
        <Button type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? <Spinner /> : null}
          {saving ? "Сохраняем…" : "Сохранить цену"}
        </Button>
      ) : (
        <p className="text-muted-foreground text-sm">
          Изменять цены может только владелец кабинета.
        </p>
      )}
    </div>
  );
}
