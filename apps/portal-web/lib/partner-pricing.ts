/** Клиентский расчёт розничной цены дилера */
export function resolveDealerDisplayPrice(
  factoryBasePrice: number | null | undefined,
  pricing: {
    pricingMode: "markup" | "exact" | "on_request";
    markupPercent?: number | null;
    publicPrice?: number | null;
  }
): { amount: number | null; onRequest: boolean } {
  if (pricing.pricingMode === "on_request") {
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

export function factoryOptionKey(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

export function resolveDealerFactoryBase(
  housePrice: number | null | undefined,
  offer:
    | {
        assembly?: Array<{ name: string; price: number }>;
        extras?: Array<{ name: string; price: number }>;
      }
    | null
    | undefined,
  selectedKeys: string[]
): number | null {
  const selected = new Set(selectedKeys.map(factoryOptionKey));
  const lines = [...(offer?.assembly ?? []), ...(offer?.extras ?? [])];
  let optionsSum = 0;
  for (const line of lines) {
    if (selected.has(factoryOptionKey(line.name))) {
      optionsSum += line.price;
    }
  }
  if (housePrice == null) {
    return optionsSum > 0 ? optionsSum : null;
  }
  return housePrice + optionsSum;
}

export function formatRub(amount: number | null | undefined): string {
  if (amount == null) return "Цена по запросу";
  return amount.toLocaleString("ru-RU");
}
