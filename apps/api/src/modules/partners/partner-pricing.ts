import type {
  PartnerPricingMode,
  PartnerProjectExtra,
  PartnerProjectExtraGroup,
  PartnerProjectPrice
} from "@b2b/domain";

/** Ключ заводской опции — по имени, чтобы переживать реимпорт Excel с новыми id */
export function factoryOptionKey(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

export function normalizeFactorySelectedOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys = value
    .filter((item): item is string => typeof item === "string")
    .map(factoryOptionKey)
    .filter(Boolean);
  return [...new Set(keys)];
}

type FactoryOfferLike = {
  assembly?: Array<{ name: string; price: number }>;
  extras?: Array<{ name: string; price: number }>;
} | null;

/** База завода для наценки: дом + включённые дилером заводские опции */
export function resolveDealerFactoryBase(
  housePrice: number | null | undefined,
  offer: FactoryOfferLike | undefined,
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

/** Итоговая цена для витрины дилера поверх заводской basePrice */
export function resolvePartnerDisplayPrice(
  factoryBasePrice: number | null | undefined,
  // markupPercent и publicPrice могут прийти как undefined из БД — функция это учитывает ниже
  pricing?: {
    pricingMode: PartnerPricingMode;
    markupPercent?: number | undefined;
    publicPrice?: number | undefined;
    priceOnRequest: boolean;
  } | null
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

function cryptoRandomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeExtraItem(item: unknown): PartnerProjectExtra | null {
  if (!item || typeof item !== "object") return null;
  const row = item as { id?: string; name?: unknown; price?: unknown; note?: unknown };
  if (typeof row.name !== "string") return null;
  const name = row.name.trim();
  if (!name) return null;

  const extra: PartnerProjectExtra = {
    id: typeof row.id === "string" && row.id ? row.id : cryptoRandomId("extra"),
    name
  };
  if (typeof row.price === "number" && Number.isFinite(row.price)) extra.price = row.price;
  if (typeof row.note === "string" && row.note.trim()) extra.note = row.note.trim();
  return extra;
}

/** Одна опция из legacy/плоского формата */
export function normalizeExtras(value: unknown): PartnerProjectExtra[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeExtraItem).filter((item): item is PartnerProjectExtra => item != null);
}

function isGroupRow(item: unknown): boolean {
  return Boolean(item && typeof item === "object" && Array.isArray((item as { items?: unknown }).items));
}

/**
 * Нормализует extras в группы.
 * Старый плоский массив [{ name, price }] → одна untitled-группа.
 */
export function normalizeExtraGroups(value: unknown): PartnerProjectExtraGroup[] {
  if (!Array.isArray(value) || value.length === 0) return [];

  // Новый формат: хотя бы один элемент с items[]
  if (value.some(isGroupRow)) {
    return value
      .filter(isGroupRow)
      .map((item) => {
        const row = item as { id?: string; title?: unknown; items: unknown[] };
        const items = row.items
          .map(normalizeExtraItem)
          .filter((x): x is PartnerProjectExtra => x != null);
        const title = typeof row.title === "string" ? row.title.trim() : "";
        if (!title && items.length === 0) return null;
        return {
          id: typeof row.id === "string" && row.id ? row.id : cryptoRandomId("group"),
          title,
          items
        } satisfies PartnerProjectExtraGroup;
      })
      .filter((g): g is PartnerProjectExtraGroup => g != null);
  }

  // Legacy: плоский список опций
  const items = normalizeExtras(value);
  if (items.length === 0) return [];
  return [{ id: cryptoRandomId("group"), title: "", items }];
}

/** Плоский список всех опций (для мест, где группы не нужны) */
export function flattenExtraGroups(groups: PartnerProjectExtraGroup[]): PartnerProjectExtra[] {
  return groups.flatMap((group) => group.items);
}

function sectionKey(title: string): string {
  return title.trim().toLowerCase();
}

function optionKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Пополняет библиотеку партнёра из extras проекта.
 * Ключ раздела — title (trim, case-insensitive); ключ опции — name внутри раздела.
 * Одинаковые названия в разных разделах остаются разными записями.
 */
export function mergeExtraOptionLibrary(
  existing: unknown,
  incoming: PartnerProjectExtraGroup[]
): PartnerProjectExtraGroup[] {
  const result = normalizeExtraGroups(existing).map((group) => ({
    id: group.id,
    title: group.title,
    items: group.items.map((item) => ({ ...item }))
  }));

  for (const group of normalizeExtraGroups(incoming)) {
    const key = sectionKey(group.title);
    let target = result.find((row) => sectionKey(row.title) === key);
    if (!target) {
      target = {
        id: cryptoRandomId("libg"),
        title: group.title.trim(),
        items: []
      };
      result.push(target);
    }

    for (const item of group.items) {
      const name = item.name.trim();
      const idx = target.items.findIndex((row) => optionKey(row.name) === optionKey(name));
      const next: PartnerProjectExtra = {
        id: idx >= 0 ? target.items[idx]!.id : cryptoRandomId("libx"),
        name
      };
      if (item.price != null) next.price = item.price;
      if (item.note) next.note = item.note;

      if (idx >= 0) target.items[idx] = next;
      else target.items.push(next);
    }
  }

  return result.filter((group) => group.title || group.items.length > 0);
}

export type { PartnerProjectPrice };
