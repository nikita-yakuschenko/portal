import type { PartnerPricingMode, PartnerProjectExtra, PartnerProjectPrice } from "@b2b/domain";

/** Итоговая цена для витрины дилера поверх заводской basePrice */
export function resolvePartnerDisplayPrice(
  factoryBasePrice: number | null | undefined,
  pricing?: Pick<
    PartnerProjectPrice,
    "pricingMode" | "markupPercent" | "publicPrice" | "priceOnRequest"
  > | null
): { amount: number | null; onRequest: boolean } {
  if (!pricing || pricing.priceOnRequest || pricing.pricingMode === "on_request") {
    return { amount: null, onRequest: true };
  }

  if (pricing.pricingMode === "exact" && pricing.publicPrice != null) {
    return { amount: pricing.publicPrice, onRequest: false };
  }

  if (
    pricing.pricingMode === "markup" &&
    factoryBasePrice != null &&
    pricing.markupPercent != null
  ) {
    return {
      amount: Math.round(factoryBasePrice * (1 + pricing.markupPercent / 100)),
      onRequest: false
    };
  }

  return { amount: null, onRequest: true };
}

export function normalizePricingMode(value: unknown): PartnerPricingMode {
  if (value === "markup" || value === "exact" || value === "on_request") return value;
  return "on_request";
}

export function normalizeExtras(value: unknown): PartnerProjectExtra[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string")
    .map((item) => {
      const row = item as { id?: string; name: string; price?: number; note?: string };
      const extra: PartnerProjectExtra = {
        id: typeof row.id === "string" && row.id ? row.id : cryptoRandomId(),
        name: row.name.trim()
      };
      if (typeof row.price === "number" && Number.isFinite(row.price)) extra.price = row.price;
      if (typeof row.note === "string" && row.note.trim()) extra.note = row.note.trim();
      return extra;
    })
    .filter((item) => item.name.length > 0);
}

function cryptoRandomId(): string {
  return `extra_${Math.random().toString(36).slice(2, 10)}`;
}
