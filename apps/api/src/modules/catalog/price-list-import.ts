import ExcelJS from "exceljs";
import type { CatalogTechnology, FactoryOffer, FactoryOfferLine } from "@b2b/domain";

export type ParsedPriceBlock = {
  excelName: string;
  basePrice: number | null;
  assembly: FactoryOfferLine[];
  extras: FactoryOfferLine[];
};

export type PriceListImportFile = {
  fileName: string;
  buffer: Buffer;
  technology: CatalogTechnology;
};

export type MatchKey = {
  family: string;
  area: number | null;
  normalized: string;
};

export type CatalogMatchTarget = {
  id: string;
  name: string;
  technology: CatalogTechnology;
};

export type PriceImportReport = {
  updated: Array<{ projectId: string; projectName: string; excelName: string }>;
  skippedUnmatched: string[];
  ambiguous: Array<{ excelName: string; candidates: string[] }>;
  errors: string[];
};

function cryptoId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Алиасы семейств: укороченные имена Excel ↔ каталог */
const FAMILY_ALIASES: Record<string, string> = {
  барн: "барн",
  барнхаус: "барн",
  куб: "куб",
  фрейм: "фрейм",
  сканди: "сканди",
  экохаус: "экохаус",
  "а-фрейм": "афрейм",
  афрейм: "афрейм",
  "а фрейм": "афрейм",
  норвегия: "норвегия",
  шведский: "шведский",
  финляндия: "финляндия",
  дуплекс: "дуплекс",
  камелот: "камелот"
};

export function normalizeProjectName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\u00a0/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/домокомплект/gi, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchKeyFromName(raw: string): MatchKey {
  const normalized = normalizeProjectName(raw);
  const numbers = normalized.match(/\d+/g);
  const area = numbers?.length ? Number(numbers[numbers.length - 1]) : null;
  const withoutArea = normalized
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const alias = FAMILY_ALIASES[withoutArea] ?? withoutArea;
  return { family: alias, area: Number.isFinite(area) ? area : null, normalized };
}

function matchScore(excel: MatchKey, catalog: MatchKey): number {
  if (excel.normalized === catalog.normalized) return 100;
  if (excel.family && catalog.family && excel.family === catalog.family) {
    if (excel.area != null && catalog.area != null && excel.area === catalog.area) return 90;
    if (excel.area == null && catalog.area == null) return 70;
  }
  // «барн 113» vs «барнхаус 113» уже через alias; fallback: catalog contains excel tokens
  if (
    excel.area != null &&
    catalog.area === excel.area &&
    excel.family &&
    catalog.normalized.includes(excel.family)
  ) {
    return 80;
  }
  return 0;
}

export function findCatalogMatches(
  excelName: string,
  targets: CatalogMatchTarget[]
): CatalogMatchTarget[] {
  const excelKey = matchKeyFromName(excelName);
  const scored = targets
    .map((target) => ({
      target,
      score: matchScore(excelKey, matchKeyFromName(target.name))
    }))
    .filter((row) => row.score >= 80)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  const best = scored[0]!.score;
  return scored.filter((row) => row.score === best).map((row) => row.target);
}

function parsePriceValue(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "-" || trimmed === "—" || trimmed === "–") return null;
    const digits = trimmed.replace(/\s/g, "").replace(",", ".");
    const num = Number(digits);
    if (Number.isFinite(num)) return Math.round(num);
  }
  return null;
}

function isAssemblyLabel(label: string): boolean {
  const name = label.trim().toLowerCase().replace(/ё/g, "е");
  return name.startsWith("сборка");
}

function isSectionHeader(label: string, value: unknown): boolean {
  const name = label.trim().toLowerCase().replace(/ё/g, "е");
  if (name === "допы" || name === "доп" || name === "дополнительно") return true;
  return value == null || String(value).trim() === "";
}

/** Парсит блоки «Название проекта» из листа МАРКЕТИНГ */
export async function parsePriceListBuffer(buffer: Buffer): Promise<ParsedPriceBlock[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs принимает Buffer / ArrayBuffer / Uint8Array
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet =
    workbook.getWorksheet("МАРКЕТИНГ") ??
    workbook.worksheets.find((ws) => /маркетинг/i.test(ws.name)) ??
    workbook.worksheets[0];

  if (!sheet) return [];

  const blocks: ParsedPriceBlock[] = [];
  let current: ParsedPriceBlock | null = null;
  let inExtras = false;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
    inExtras = false;
  };

  sheet.eachRow({ includeEmpty: true }, (row) => {
    const labelRaw = row.getCell(1).value;
    const label =
      labelRaw == null
        ? ""
        : typeof labelRaw === "object" && labelRaw && "text" in labelRaw
          ? String((labelRaw as { text: string }).text)
          : String(labelRaw);
    const labelTrim = label.replace(/\t/g, "").trim();

    // В прайсах подпись продублирована в B–E (merged), цена/имя — в крайней правой колонке (F)
    let value: unknown = null;
    let valueCol = 0;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber <= 1) return;
      const v = cell.value;
      if (v == null || (typeof v === "string" && !v.trim())) return;
      let resolved: unknown = v;
      if (typeof v === "object" && v && "result" in v) {
        resolved = (v as { result: unknown }).result;
      } else if (typeof v === "object" && v && "text" in v) {
        resolved = (v as { text: string }).text;
      }
      // Берём самую правую заполненную ячейку
      if (colNumber >= valueCol) {
        valueCol = colNumber;
        value = resolved;
      }
    });

    // Если «значение» совпало с подписью — это не цена (типично для строки «Допы»)
    if (
      value != null &&
      labelTrim &&
      String(value).replace(/\s+/g, " ").trim().toLowerCase() ===
        labelTrim.replace(/\s+/g, " ").trim().toLowerCase()
    ) {
      value = null;
    }

    if (!labelTrim && value == null) {
      flush();
      return;
    }

    if (labelTrim.toLowerCase().replace(/ё/g, "е") === "название проекта") {
      flush();
      const name =
        value == null
          ? ""
          : typeof value === "object" && value && "text" in value
            ? String((value as { text: string }).text)
            : String(value);
      current = {
        excelName: name.replace(/\s+/g, " ").trim(),
        basePrice: null,
        assembly: [],
        extras: []
      };
      inExtras = false;
      return;
    }

    if (!current || !labelTrim) return;

    if (isSectionHeader(labelTrim, value) && labelTrim.trim().toLowerCase().replace(/ё/g, "е").startsWith("доп")) {
      inExtras = true;
      return;
    }

    if (labelTrim.trim().toLowerCase().replace(/ё/g, "е") === "стоимость дома") {
      current.basePrice = parsePriceValue(value);
      return;
    }

    const price = parsePriceValue(value);
    if (price == null) return;

    const line: FactoryOfferLine = {
      id: cryptoId("fo"),
      name: labelTrim,
      price
    };

    if (isAssemblyLabel(labelTrim)) {
      current.assembly.push(line);
      return;
    }

    // ПКД без маркера «Допы»: всё кроме стоимости/сборки — extras
    if (inExtras || !isAssemblyLabel(labelTrim)) {
      current.extras.push(line);
    }
  });

  flush();
  return blocks.filter((block) => block.excelName.length > 0);
}

export function buildFactoryOffer(
  block: ParsedPriceBlock,
  sources: string[],
  importedAt = new Date().toISOString()
): FactoryOffer {
  return {
    importedAt,
    sources,
    assembly: block.assembly,
    extras: block.extras
  };
}

export function normalizeFactoryOffer(value: unknown): FactoryOffer | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<FactoryOffer>;
  if (!Array.isArray(row.assembly) && !Array.isArray(row.extras)) return null;

  const mapLine = (item: unknown): FactoryOfferLine | null => {
    if (!item || typeof item !== "object") return null;
    const line = item as Partial<FactoryOfferLine>;
    if (typeof line.name !== "string" || !line.name.trim()) return null;
    if (typeof line.price !== "number" || !Number.isFinite(line.price)) return null;
    return {
      id: typeof line.id === "string" && line.id ? line.id : cryptoId("fo"),
      name: line.name.trim(),
      price: Math.round(line.price)
    };
  };

  return {
    importedAt: typeof row.importedAt === "string" ? row.importedAt : "",
    sources: Array.isArray(row.sources)
      ? row.sources.filter((s): s is string => typeof s === "string")
      : [],
    assembly: (row.assembly ?? []).map(mapLine).filter((x): x is FactoryOfferLine => x != null),
    extras: (row.extras ?? []).map(mapLine).filter((x): x is FactoryOfferLine => x != null)
  };
}
