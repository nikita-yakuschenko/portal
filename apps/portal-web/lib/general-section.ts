/** Общий дилерский раздел — то, что раньше жило в закрытом разделе на Tilda */

export type GeneralOverview = {
  panelFrame: number;
  panelFrameCover: string | null;
  panelFrameFrom: number | null;
  modular: number;
  modularCover: string | null;
  modularFrom: number | null;
  trusses: number;
  trussCover: string | null;
  roofPanels: number;
  roofPanelCover: string | null;
  roofPanelPrice: number | null;
  materials: number;
};

export type GeneralHouse = {
  id: string;
  slug: string;
  name: string;
  technology: "panel_frame" | "modular";
  area: number | null;
  floors: number | null;
  bedrooms: number | null;
  basePrice: number | null;
  dimensions: string | null;
  imageUrl: string | null;
};

export type FactoryProduct = {
  id: string;
  kind: "truss" | "roof_panel";
  name: string;
  description: string;
  sizes: string;
  imageUrl: string | null;
  price: number | null;
  priceUnit: string;
  sortOrder: number;
  isActive: boolean;
};

export type DealerMaterial = {
  id: string;
  title: string;
  description: string;
  url: string;
  storageKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  hasFile?: boolean;
  category: string;
  sortOrder: number;
  isActive: boolean;
};

export function formatPrice(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value);
}

/** imageUrl может хранить несколько ссылок через перевод строки (галерея) */
export function parseProductImageUrls(imageUrl: string | null | undefined): string[] {
  if (!imageUrl?.trim()) return [];
  return imageUrl
    .split(/\n+/)
    .map((url) => url.trim())
    .filter(Boolean);
}

/** «17 проектов» / «2 проекта» — счётчик под плиткой раздела */
export function pluralize(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${forms[0]}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}

export const MATERIAL_CATEGORY_LABEL: Record<string, string> = {
  media: "Фото и видео",
  presentation: "Презентации",
  docs: "Документы",
  brand: "Фирменный стиль",
  other: "Материалы"
};
