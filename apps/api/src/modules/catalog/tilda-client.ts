import { config } from "../../config.js";

export interface TildaProduct {
  id: string;
  title: string;
  description: string;
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

function parseCharacteristics(text: string): {
  area?: number;
  floors?: number;
  bedrooms?: number;
  bathrooms?: string;
} {
  const areaMatch = text.match(/(\d+(?:[.,]\d+)?)\s*м(?:2|²)/i);
  const floorsMatch = text.match(/(\d+)\s*(?:эт|этаж)/i);
  const bedroomsMatch = text.match(/(\d+)\s*(?:спал|комн)/i);
  const bathroomsMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:сан|с\/у|санузел)/i);

  const result: {
    area?: number;
    floors?: number;
    bedrooms?: number;
    bathrooms?: string;
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

  return result;
}

function mapProduct(product: Record<string, unknown>, source: TildaSource): TildaProduct {
  const title = String(product.title ?? product.name ?? `Проект ${productUid(product)}`);
  const description = String(product.descr ?? product.description ?? product.text ?? "");
  const characteristics = parseCharacteristics(`${title}\n${description}`);
  const mapped: TildaProduct = {
    id: productUid(product),
    title,
    description,
    url: productUrl(product, source),
    images: galleryUrls(product)
  };

  const price = productPrice(product);
  if (price !== undefined) {
    mapped.price = price;
  }
  if (characteristics.area !== undefined) {
    mapped.area = characteristics.area;
  }
  if (characteristics.floors !== undefined) {
    mapped.floors = characteristics.floors;
  }
  if (characteristics.bedrooms !== undefined) {
    mapped.bedrooms = characteristics.bedrooms;
  }
  if (characteristics.bathrooms !== undefined) {
    mapped.bathrooms = characteristics.bathrooms;
  }

  return mapped;
}

export class MockTildaClient implements TildaClient {
  async fetchProducts(): Promise<TildaProduct[]> {
    return [
      {
        id: "house-54",
        title: "Зимний 54",
        description: "Компактный дом для круглогодичного проживания.",
        area: 54,
        floors: 1,
        bedrooms: 2,
        bathrooms: "1",
        price: 2768000,
        url: "https://avgst.ru/projects/house-54",
        images: [
          "https://avgst.ru/storage/house-54/main.jpg",
          "https://avgst.ru/storage/house-54/plan.jpg"
        ]
      },
      {
        id: "house-87",
        title: "Север 87",
        description: "Дом для семьи с просторной кухней-гостиной.",
        area: 87,
        floors: 1,
        bedrooms: 3,
        bathrooms: "2",
        price: 4210000,
        url: "https://avgst.ru/projects/house-87",
        images: ["https://avgst.ru/storage/house-87/main.jpg"]
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
    return extractProducts(payload).map((product) => mapProduct(product, source));
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
