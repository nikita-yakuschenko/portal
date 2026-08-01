import { config } from "../../config.js";
import { enrichImagesFromProductPage } from "./page-images.js";

export type TildaTechnology = "modular" | "panel_frame";

export interface TildaProduct {
  id: string;
  title: string;
  description: string;
  technology: TildaTechnology;
  summary?: string;
  mark?: string;
  dimensionsLabel?: string;
  lengthM?: number;
  widthM?: number;
  characteristics?: Array<{ title: string; value: string }>;
  packages?: Array<{ id: string; name: string; price?: number }>;
  pack?: { x?: number; y?: number; z?: number; m?: number };
  area?: number;
  floors?: number;
  bedrooms?: number;
  bathrooms?: string;
  price?: number;
  url: string;
  images: string[];
}

export interface TildaClient {
  fetchProducts(): Promise<TildaProduct[]>;
}

type TildaSource = {
  key: string;
  storepartuid: string;
  recid: string;
  catalogPath: string;
};

const TITLE_PREFIXES = [/^\s*модульный\s+дом\s+/i, /^\s*панельно[-\s]?каркасный\s+дом\s+/i];

export function cleanCatalogTitle(title: string): string {
  let next = title.trim();
  for (const prefix of TITLE_PREFIXES) {
    next = next.replace(prefix, "");
  }
  return next.trim() || title.trim();
}

function technologyFromSource(source: TildaSource): TildaTechnology {
  return source.key === "panel" ? "panel_frame" : "modular";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractProducts(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
  }

  const root = asRecord(payload);
  if (!root) {
    return [];
  }

  for (const key of ["products", "items", "result", "data"]) {
    const value = root[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
    }

    const nested = asRecord(value);
    if (nested) {
      const nestedList = nested.products ?? nested.items;
      if (Array.isArray(nestedList)) {
        return nestedList.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
      }
    }
  }

  const parts = root.parts;
  if (Array.isArray(parts)) {
    const products: Record<string, unknown>[] = [];
    for (const part of parts) {
      const partRecord = asRecord(part);
      if (!partRecord || !Array.isArray(partRecord.products)) {
        continue;
      }
      products.push(
        ...partRecord.products.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
      );
    }
    return products;
  }

  return [];
}

function productUid(product: Record<string, unknown>): string {
  for (const key of ["uid", "productuid", "id", "externalid"]) {
    const value = product[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }

  const title = String(product.title ?? product.name ?? "unknown");
  return title.toLowerCase().replace(/\W+/g, "-");
}

function productPrice(product: Record<string, unknown>): number | undefined {
  for (const key of ["price", "price_min", "priceold"]) {
    const raw = product[key];
    if (raw === undefined || raw === null || raw === "") {
      continue;
    }

    const num = Number(String(raw).replace(/\s+/g, "").replace(",", "."));
    if (!Number.isFinite(num)) {
      continue;
    }
    if (num > 100_000_000) {
      return Math.trunc(num / 100);
    }
    return Math.trunc(num);
  }

  return undefined;
}

function galleryUrls(product: Record<string, unknown>): string[] {
  const urls: string[] = [];
  let gallery: unknown = product.gallery ?? product.galleryjson ?? [];

  if (typeof gallery === "string") {
    try {
      gallery = JSON.parse(gallery);
    } catch {
      gallery = [];
    }
  }

  if (Array.isArray(gallery)) {
    for (const item of gallery) {
      if (typeof item === "string" && item.startsWith("http")) {
        urls.push(item);
        continue;
      }

      const record = asRecord(item);
      if (!record) {
        continue;
      }

      for (const key of ["img", "image", "url", "src"]) {
        const value = record[key];
        if (typeof value === "string" && value.startsWith("http")) {
          urls.push(value);
          break;
        }
      }
    }
  }

  for (const key of ["photo", "image", "img"]) {
    const value = product[key];
    if (typeof value === "string" && value.startsWith("http") && !urls.includes(value)) {
      urls.unshift(value);
    }
  }

  return [...new Set(urls)];
}

function productUrl(product: Record<string, unknown>, source: TildaSource): string {
  const slug = product.url ?? product.alias ?? product.slug ?? "";
  if (typeof slug === "string" && slug.startsWith("http")) {
    return slug;
  }

  if (typeof slug === "string" && slug) {
    return `${config.tilda.siteBaseUrl}${slug.startsWith("/") ? slug : `/${slug}`}`;
  }

  return `${config.tilda.siteBaseUrl}${source.catalogPath}/tproduct/${productUid(product)}`;
}

/** Tilda отдаёт descr/text с HTML-разметкой — приводим к чистому тексту */
function stripTildaHtml(text: string): string {
  return text
    .replace(/<sup>\s*2\s*<\/sup>/gi, "²")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function parseCharacteristics(text: string): {
  area?: number;
  floors?: number;
  bedrooms?: number;
  bathrooms?: string;
  dimensionsLabel?: string;
  lengthM?: number;
  widthM?: number;
} {
  const normalized = stripTildaHtml(text);
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const areaMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*м(?:2|²)/i);
  const floorsMatch =
    normalized.match(/(\d+)\s*(?:эт|этаж)/i) ??
    normalized.match(/кол-?во\s*этаж(?:ей|а)?\s*:\s*(\d+)/i);
  const bedroomsMatch =
    normalized.match(/(\d+)\s*(?:спал|комн)/i) ??
    normalized.match(/кол-?во\s*спаль(?:ен|ни)\s*:\s*(\d+)/i);
  const bathroomsMatch =
    normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:сан|с\/у|санузел)/i) ??
    normalized.match(/кол-?во\s*санузл(?:ов|а)?\s*:\s*(\d+)/i);
  const sizeMatch =
    normalized.match(/размеры(?:\s*дома)?\s*:\s*([\d.,]+)\s*[xх×]\s*([\d.,]+)\s*м?/i) ??
    normalized.match(/([\d.,]+)\s*[xх×]\s*([\d.,]+)\s*м(?!\s*кв)/i);

  const result: {
    area?: number;
    floors?: number;
    bedrooms?: number;
    bathrooms?: string;
    dimensionsLabel?: string;
    lengthM?: number;
    widthM?: number;
  } = {};

  if (areaMatch?.[1]) {
    result.area = Number(areaMatch[1].replace(",", "."));
  }
  if (floorsMatch?.[1]) {
    result.floors = Number(floorsMatch[1]);
  }
  if (bedroomsMatch?.[1]) {
    result.bedrooms = Number(bedroomsMatch[1]);
  }
  if (bathroomsMatch?.[1]) {
    result.bathrooms = bathroomsMatch[1];
  }
  if (sizeMatch?.[1] && sizeMatch[2]) {
    result.lengthM = Number(sizeMatch[1].replace(",", "."));
    result.widthM = Number(sizeMatch[2].replace(",", "."));
    result.dimensionsLabel = `${sizeMatch[1].replace(".", ",")}×${sizeMatch[2].replace(".", ",")} м`;
  }

  // Tilda: ul → площадь, габариты, этажи/санузлы, спальни
  if (result.floors === undefined || result.bedrooms === undefined || result.bathrooms === undefined) {
    const bareNumbers = lines.filter((line) => /^\d+$/.test(line)).map(Number);
    if (result.bathrooms === undefined && bareNumbers[0] !== undefined && lines.some((l) => /[xх×]/.test(l))) {
      // после строки габаритов обычно: санузлы, спальни
      if (bareNumbers[0] !== undefined && result.bathrooms === undefined) {
        result.bathrooms = String(bareNumbers[0]);
      }
      if (bareNumbers[1] !== undefined && result.bedrooms === undefined) {
        result.bedrooms = bareNumbers[1];
      }
    } else {
      if (result.floors === undefined && bareNumbers[0] !== undefined) {
        result.floors = bareNumbers[0];
      }
      if (result.bedrooms === undefined && bareNumbers[1] !== undefined) {
        result.bedrooms = bareNumbers[1];
      }
    }
  }

  return result;
}

function parseCharacteristicRows(product: Record<string, unknown>): Array<{ title: string; value: string }> {
  if (!Array.isArray(product.characteristics)) {
    return [];
  }

  return product.characteristics
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      title: String(item.title ?? "").trim(),
      value: String(item.value ?? "").trim()
    }))
    .filter((item) => item.title && item.value);
}

function parsePackagePrices(product: Record<string, unknown>): number[] {
  if (!Array.isArray(product.properties)) {
    return [];
  }

  for (const item of product.properties) {
    const row = asRecord(item);
    if (!row) continue;
    const title = String(row.title ?? "").toLowerCase();
    if (!title.includes("комплект")) continue;
    const values = String(row.values ?? "")
      .split(/\n+/)
      .map((value) => Number(value.replace(/\s+/g, "").replace(",", ".")))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length) return values.map((value) => Math.trunc(value));
  }

  return [];
}

type RootOption = { title: string; values: Array<{ id: string; value: string }> };

function extractRootOptions(payload: unknown): RootOption[] {
  const root = asRecord(payload);
  if (!root || !Array.isArray(root.options)) {
    return [];
  }

  return root.options
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => {
      const values = Array.isArray(item.values)
        ? item.values
            .map((value) => asRecord(value))
            .filter((value): value is Record<string, unknown> => Boolean(value))
            .map((value) => ({
              id: String(value.id ?? value.value ?? ""),
              value: String(value.value ?? "").trim()
            }))
            .filter((value) => value.id && value.value)
        : [];

      return {
        title: String(item.title ?? "").trim(),
        values
      };
    })
    .filter((item) => item.title && item.values.length > 0);
}

function mapPackages(
  product: Record<string, unknown>,
  rootOptions: RootOption[]
): Array<{ id: string; name: string; price?: number }> {
  const prices = parsePackagePrices(product);
  const packageOption =
    rootOptions.find((item) => /комплект/i.test(item.title)) ?? rootOptions[0];

  if (packageOption) {
    return packageOption.values.map((value, index) => {
      const row: { id: string; name: string; price?: number } = {
        id: value.id,
        name: value.value
      };
      if (prices[index] !== undefined) {
        row.price = prices[index];
      }
      return row;
    });
  }

  return prices.map((price, index) => ({
    id: `package-${index + 1}`,
    name: index === 0 ? "Домокомплект" : `Комплектация ${index + 1}`,
    price
  }));
}

function mapProduct(
  product: Record<string, unknown>,
  source: TildaSource,
  rootOptions: RootOption[] = []
): TildaProduct {
  const rawTitle = String(product.title ?? product.name ?? `Проект ${productUid(product)}`);
  const title = cleanCatalogTitle(rawTitle);
  const description = stripTildaHtml(String(product.descr ?? product.description ?? ""));
  const summary = stripTildaHtml(String(product.text ?? ""));
  const mark = String(product.mark ?? "").trim();
  const parsed = parseCharacteristics(`${rawTitle}\n${summary}\n${description}`);
  const charRows = parseCharacteristicRows(product);
  const packages = mapPackages(product, rootOptions);

  for (const row of charRows) {
    const titleLower = row.title.toLowerCase();
    if (parsed.floors === undefined && titleLower.includes("этаж")) {
      const num = Number(row.value);
      if (Number.isFinite(num)) parsed.floors = num;
    }
    if (parsed.bedrooms === undefined && titleLower.includes("спаль")) {
      const num = Number(row.value);
      if (Number.isFinite(num)) parsed.bedrooms = num;
    }
  }

  const mapped: TildaProduct = {
    id: productUid(product),
    title,
    description: description || summary,
    technology: technologyFromSource(source),
    url: productUrl(product, source),
    images: galleryUrls(product),
    characteristics: charRows,
    packages
  };

  if (summary) mapped.summary = summary;
  if (mark) mapped.mark = mark;
  if (parsed.dimensionsLabel) mapped.dimensionsLabel = parsed.dimensionsLabel;
  if (parsed.lengthM !== undefined) mapped.lengthM = parsed.lengthM;
  if (parsed.widthM !== undefined) mapped.widthM = parsed.widthM;

  const packX = Number(product.pack_x);
  const packY = Number(product.pack_y);
  const packZ = Number(product.pack_z);
  const packM = Number(product.pack_m);
  if ([packX, packY, packZ, packM].some((value) => Number.isFinite(value) && value > 0)) {
    mapped.pack = {
      ...(Number.isFinite(packX) ? { x: packX } : {}),
      ...(Number.isFinite(packY) ? { y: packY } : {}),
      ...(Number.isFinite(packZ) ? { z: packZ } : {}),
      ...(Number.isFinite(packM) ? { m: packM } : {})
    };
  }

  const price = productPrice(product);
  if (price !== undefined) mapped.price = price;
  if (parsed.area !== undefined) mapped.area = parsed.area;
  if (parsed.floors !== undefined) mapped.floors = parsed.floors;
  if (parsed.bedrooms !== undefined) mapped.bedrooms = parsed.bedrooms;
  if (parsed.bathrooms !== undefined) mapped.bathrooms = parsed.bathrooms;

  return mapped;
}

export class MockTildaClient implements TildaClient {
  async fetchProducts(): Promise<TildaProduct[]> {
    return [
      {
        id: "house-54",
        title: "Зимний 54",
        description: "Компактный дом для круглогодичного проживания.",
        summary: "Дом площадью 54 м2. Размеры дома: 9х7 м. Кол-во санузлов: 1. Кол-во спален: 2",
        technology: "modular",
        dimensionsLabel: "9×7 м",
        lengthM: 9,
        widthM: 7,
        characteristics: [
          { title: "Тип дома", value: "Модульные дома" },
          { title: "Кол-во этажей", value: "1" },
          { title: "Кол-во спален", value: "2" }
        ],
        packages: [
          { id: "std", name: "Домокомплект", price: 2768000 },
          { id: "prem", name: "Премиум", price: 3890000 }
        ],
        area: 54,
        floors: 1,
        bedrooms: 2,
        bathrooms: "1",
        price: 2768000,
        url: "https://avgst.ru/projects/house-54",
        images: [
          "https://avgst.ru/storage/house-54/main.jpg",
          "https://avgst.ru/storage/house-54/plan.jpg",
          "https://avgst.ru/storage/house-54/side.jpg",
          "https://avgst.ru/storage/house-54/kitchen.jpg",
          "https://avgst.ru/storage/house-54/bedroom.jpg"
        ]
      },
      {
        id: "house-87",
        title: "Север 87",
        description: "Дом для семьи с просторной кухней-гостиной.",
        summary: "Дом площадью 87 м2. Размеры дома: 11х9 м. Кол-во санузлов: 2. Кол-во спален: 3",
        technology: "panel_frame",
        dimensionsLabel: "11×9 м",
        lengthM: 11,
        widthM: 9,
        characteristics: [
          { title: "Тип дома", value: "Панельно-каркасные дома" },
          { title: "Кол-во этажей", value: "1" },
          { title: "Кол-во спален", value: "3" }
        ],
        packages: [
          { id: "std", name: "Домокомплект", price: 4210000 },
          { id: "prem", name: "Премиум", price: 5900000 }
        ],
        area: 87,
        floors: 1,
        bedrooms: 3,
        bathrooms: "2",
        price: 4210000,
        url: "https://avgst.ru/projects/house-87",
        images: [
          "https://avgst.ru/storage/house-87/main.jpg",
          "https://avgst.ru/storage/house-87/plan.jpg",
          "https://avgst.ru/storage/house-87/facade.jpg",
          "https://avgst.ru/storage/house-87/living.jpg",
          "https://avgst.ru/storage/house-87/terrace.jpg"
        ]
      }
    ];
  }
}

export class StoreTildaClient implements TildaClient {
  constructor(private readonly sources: TildaSource[] = config.tilda.sources) {}

  async fetchProducts(): Promise<TildaProduct[]> {
    if (this.sources.length === 0) {
      throw new Error("Tilda Store sources are not configured (storepartuid/recid).");
    }

    const products: TildaProduct[] = [];
    const seen = new Set<string>();

    for (const source of this.sources) {
      const batch = await this.fetchSource(source);
      for (const product of batch) {
        if (seen.has(product.id)) {
          continue;
        }
        seen.add(product.id);
        products.push(product);
      }
    }

    // Store API отдаёт 1–2 фото — добираем слайдер со страницы проекта
    const concurrency = 5;
    for (let i = 0; i < products.length; i += concurrency) {
      const chunk = products.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (product) => {
          product.images = await enrichImagesFromProductPage(product.url, product.images);
        })
      );
    }

    return products;
  }

  private async fetchSource(source: TildaSource): Promise<TildaProduct[]> {
    const url = new URL(config.tilda.apiBase);
    url.searchParams.set("storepartuid", source.storepartuid);
    url.searchParams.set("recid", source.recid);
    url.searchParams.set("c", String(Date.now()));
    url.searchParams.set("getparts", "true");
    url.searchParams.set("getoptions", "true");
    url.searchParams.set("size", "100");
    url.searchParams.set("flag_root", "withroot");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Tilda Store API failed for ${source.key}: HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    const rootOptions = extractRootOptions(payload);
    return extractProducts(payload).map((product) => mapProduct(product, source, rootOptions));
  }
}

/** Optional check that official site API keys are valid. Not used for catalog product sync. */
export async function verifyOfficialTildaKeys(): Promise<{ ok: boolean; message: string }> {
  if (!config.tilda.publicKey || !config.tilda.secretKey) {
    return { ok: false, message: "Official Tilda API keys are empty." };
  }

  const url = new URL("https://api.tildacdn.info/v1/getprojectslist/");
  url.searchParams.set("publickey", config.tilda.publicKey);
  url.searchParams.set("secretkey", config.tilda.secretKey);

  const response = await fetch(url);
  if (!response.ok) {
    return { ok: false, message: `Official Tilda API HTTP ${response.status}` };
  }

  const payload = (await response.json()) as { status?: string; message?: string };
  if (payload.status === "FOUND" || payload.status === "SUCCESS") {
    return { ok: true, message: "Official Tilda API keys are valid." };
  }

  return {
    ok: false,
    message: payload.message ?? `Official Tilda API status: ${payload.status ?? "unknown"}`
  };
}
