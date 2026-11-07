import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { CatalogProjectDetails, CatalogTechnology } from "@b2b/domain";

import { config } from "../../config.js";
import { db } from "../../db/client.js";
import { catalogAssets, catalogProjectRooms, catalogProjects, catalogSyncRuns } from "../../db/schema.js";
import { normalizeCatalogTechnology } from "./project-details.js";

const seriesTitle: Record<string, string> = {
  panel: "Панельно-каркасные дома",
  barn: "Барнхаусы",
  classic: "Классика",
  modular: "Модульные дома",
  aframe: "А-фрейм"
};

type CmsCatalogItem = {
  cmsId?: string;
  slug: string;
  name: string;
  href?: string;
  areaValue?: number;
  floorsValue?: number;
  bedrooms?: string;
  bathrooms?: string;
  technology?: string;
  series?: string;
  exteriors?: string[];
  interiors?: string[];
  readyHome?: unknown;
};

type CmsPlanFloor = {
  label?: string;
  image?: string | null;
  rooms?: Array<{ name?: string; area?: string }>;
};

type CmsPlans = {
  variants?: Array<{ label?: string; floors?: CmsPlanFloor[] }>;
};

type CmsCabinet = {
  seriesLabel?: string | null;
  dimensions?: { lengthM?: number | null; widthM?: number | null; label?: string | null };
  documents?: Array<{ kind?: string; title?: string; url?: string; note?: string }>;
  cargo?: CatalogProjectDetails["cargo"];
  transport?: CatalogProjectDetails["transport"];
  dealerPrice?: number | null;
};

type DesiredAsset = {
  sourceUrl: string;
  type: "exterior" | "floor_plan" | "interior";
  floorNumber: number | null;
  floorLabel: string | null;
  variantLabel: string | null;
  variantIndex: number | null;
  sortOrder: number;
  isPrimary: boolean;
};

type DesiredRoom = {
  floorNumber: number;
  floorLabel: string | null;
  variantLabel: string | null;
  variantIndex: number | null;
  name: string;
  area: number;
  sortOrder: number;
};

const overrideFields = ["name", "description", "technology", "area", "floors", "bedrooms", "bathrooms", "basePrice", "active"] as const;
type OverrideField = (typeof overrideFields)[number];
type Overrides = Partial<Record<OverrideField, boolean>>;

function overridesOf(value: unknown): Overrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: Overrides = {};
  for (const field of overrideFields) {
    if (raw[field] === true) out[field] = true;
  }
  return out;
}

function kept<T>(overrides: Overrides, field: OverrideField, next: T, current: T): T {
  return overrides[field] ? current : next;
}

function whole(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function roomArea(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/(\d+(?:[.,]\d+)?)/);
  if (!match?.[1]) return null;
  const number = Number(match[1].replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function floorNumber(label: string | undefined, index: number): number {
  const match = label?.match(/(\d+)/);
  const number = match ? Number(match[1]) : index + 1;
  return number > 0 ? number : index + 1;
}

async function cmsGet<T>(path: string): Promise<T | null> {
  const response = await fetch(new URL(path, config.cms.baseUrl), {
    headers: { authorization: `Bearer ${config.cms.apiKey}` },
    signal: AbortSignal.timeout(20000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`CMS ${path} ответила ${response.status}`);
  return (await response.json()) as T;
}

function technologyOf(value: string | undefined): CatalogTechnology {
  if (value === "panel") return "panel_frame";
  return normalizeCatalogTechnology(value);
}

function documentsOf(cabinet: CmsCabinet | null): CatalogProjectDetails["techDocs"] {
  const slots = [
    ["passport", "Паспорт проекта"],
    ["spec", "Спецификация комплектации"],
    ["plan", "Планировочное решение"],
    ["manual", "Инструкция по монтажу"]
  ] as const;
  return slots.map(([kind, title]) => {
    const row = cabinet?.documents?.find((item) => item.kind === kind);
    const url = row?.url?.trim() || undefined;
    return {
      id: kind,
      title: row?.title?.trim() || title,
      kind,
      status: url ? "available" : "on_request",
      ...(url ? { url } : {}),
      note: row?.note?.trim() ?? ""
    };
  });
}

function detailsOf(current: CatalogProjectDetails | null, item: CmsCatalogItem, cabinet: CmsCabinet | null): CatalogProjectDetails {
  const lengthM = cabinet?.dimensions?.lengthM ?? undefined;
  const widthM = cabinet?.dimensions?.widthM ?? undefined;
  const label = cabinet?.dimensions?.label?.trim() || undefined;
  const dimensions = lengthM || widthM || label ? { ...(lengthM ? { lengthM } : {}), ...(widthM ? { widthM } : {}), ...(label ? { label } : {}) } : undefined;
  const series = cabinet?.seriesLabel?.trim() || (item.series ? seriesTitle[item.series] : "") || "";
  return {
    ...(current ?? { characteristics: [], packages: [], optionGroups: [], techDocs: [], cargo: {}, transport: {} }),
    ...(series ? { series } : {}),
    ...(dimensions ? { dimensions } : { dimensions: {} }),
    characteristics: current?.characteristics ?? [],
    packages: current?.packages ?? [],
    optionGroups: current?.optionGroups ?? [],
    techDocs: documentsOf(cabinet),
    cargo: {
      modulesNote: cabinet?.cargo?.modulesNote ?? "",
      dimensionsNote: cabinet?.cargo?.dimensionsNote ?? "",
      weightNote: cabinet?.cargo?.weightNote ?? "",
      packingNote: cabinet?.cargo?.packingNote ?? ""
    },
    transport: {
      method: cabinet?.transport?.method ?? "",
      leadTimeNote: cabinet?.transport?.leadTimeNote ?? "",
      deliveryNote: cabinet?.transport?.deliveryNote ?? "",
      unloadingNote: cabinet?.transport?.unloadingNote ?? "",
      mountingNote: cabinet?.transport?.mountingNote ?? ""
    }
  };
}

function mediaKey(url: string): string {
  try {
    return new URL(url).pathname.match(/\/api\/media\/(?:file|fit\/\d+)\/([^/]+)$/)?.[1] ?? url;
  } catch {
    return url;
  }
}

// Уже показанный кадр не затираем полной ссылкой CMS: страница берёт адрес как есть.
function fittedSource(url: string): string {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.match(/\/api\/media\/file\/([^/]+)$/)?.[1];
    if (parsed.origin !== "https://cms.avgst.ru" || !name) return url;
    return `https://b2b.avgst.ru/api/media/fit/828/${name}`;
  } catch {
    return url;
  }
}

function desiredAssets(item: CmsCatalogItem, plans: CmsPlans | null): DesiredAsset[] {
  const assets: DesiredAsset[] = [];
  (item.exteriors ?? []).filter(Boolean).forEach((sourceUrl, index) => {
    assets.push({ sourceUrl, type: "exterior", floorNumber: null, floorLabel: null, variantLabel: null, variantIndex: null, sortOrder: index, isPrimary: index === 0 });
  });
  (item.interiors ?? []).filter(Boolean).forEach((sourceUrl, index) => {
    assets.push({ sourceUrl, type: "interior", floorNumber: null, floorLabel: null, variantLabel: null, variantIndex: null, sortOrder: index, isPrimary: false });
  });
  (plans?.variants ?? []).forEach((variant, variantIndex) => {
    const variantLabel = variant.label?.trim() || `Вариант ${variantIndex + 1}`;
    (variant.floors ?? []).forEach((floor, floorIndex) => {
      if (!floor.image) return;
      assets.push({
        sourceUrl: floor.image,
        type: "floor_plan",
        floorNumber: floorNumber(floor.label, floorIndex),
        floorLabel: floor.label?.trim() || null,
        variantLabel,
        variantIndex,
        sortOrder: floorIndex,
        isPrimary: false
      });
    });
  });
  return assets;
}

function desiredRooms(plans: CmsPlans | null): DesiredRoom[] {
  const rooms: DesiredRoom[] = [];
  (plans?.variants ?? []).forEach((variant, variantIndex) => {
    const variantLabel = variant.label?.trim() || `Вариант ${variantIndex + 1}`;
    (variant.floors ?? []).forEach((floor, floorIndex) => {
      const floorNo = floorNumber(floor.label, floorIndex);
      (floor.rooms ?? []).forEach((room, sortOrder) => {
        const name = room.name?.trim();
        const area = roomArea(room.area);
        if (!name || area == null) return;
        rooms.push({ floorNumber: floorNo, floorLabel: floor.label?.trim() || null, variantLabel, variantIndex, name, area, sortOrder });
      });
    });
  });
  return rooms;
}

function roomKey(room: { variantLabel?: string | null; floorNumber: number; name: string }, occurrence: number) {
  return `${room.variantLabel ?? ""}|${room.floorNumber}|${room.name}|${occurrence}`;
}

function polygonEmpty(value: unknown) {
  return !Array.isArray(value) || value.length === 0;
}

export async function syncCmsCatalog() {
  if (!config.cms.apiKey) throw new Error("Ключ CMS не задан");
  const runId = randomUUID();
  await db.insert(catalogSyncRuns).values({ id: runId, status: "running" });
  const errors: string[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let assetsDiscovered = 0;
  try {
    const catalog = await cmsGet<{ items?: CmsCatalogItem[] }>("/api/projects/catalog");
    const items = (catalog?.items ?? []).filter((item) => item.slug && !item.readyHome);
    const seen = new Set<string>();
    for (const item of items) {
      const sourceUid = item.cmsId?.trim() || item.slug;
      seen.add(sourceUid);
      try {
        const [plans, cabinet] = await Promise.all([
          cmsGet<CmsPlans>(`/api/projects/plans?slug=${encodeURIComponent(item.slug)}`),
          cmsGet<CmsCabinet>(`/api/projects/partner-cabinet?slug=${encodeURIComponent(item.slug)}`)
        ]);
        const counts = await db.transaction(async (tx) => {
          const [existing] = await tx
            .select()
            .from(catalogProjects)
            .where(and(eq(catalogProjects.source, "cms"), eq(catalogProjects.sourceUid, sourceUid)))
            .limit(1);
          const locked = overridesOf(existing?.syncOverrides);
          const currentDetails = (existing?.details ?? null) as CatalogProjectDetails | null;
          const dealerPrice = typeof cabinet?.dealerPrice === "number" && cabinet.dealerPrice > 0 ? Math.round(cabinet.dealerPrice) : null;
          const next = {
            name: item.name.trim() || item.slug,
            slug: item.slug,
            description: "",
            technology: technologyOf(item.technology),
            details: detailsOf(currentDetails, item, cabinet),
            area: whole(item.areaValue),
            floors: whole(item.floorsValue),
            bedrooms: whole(item.bedrooms),
            bathrooms: item.bathrooms?.trim() || null,
            basePrice: dealerPrice,
            projectUrl: `https://avgst.ru${item.href || `/catalog/${item.slug}`}`,
            active: true,
            sourcePayload: { code: sourceUid, slug: item.slug },
            lastSyncedAt: new Date()
          };
          const projectId = existing?.id ?? randomUUID();
          if (!existing) {
            await tx.insert(catalogProjects).values({
              id: projectId,
              source: "cms",
              sourceUid,
              ...next,
              currency: "RUB"
            });
          } else {
            await tx
              .update(catalogProjects)
              .set({
                name: kept(locked, "name", next.name, existing.name),
                slug: next.slug,
                description: kept(locked, "description", "", existing.description),
                technology: kept(locked, "technology", next.technology, existing.technology),
                details: next.details,
                area: kept(locked, "area", next.area, existing.area),
                floors: kept(locked, "floors", next.floors, existing.floors),
                bedrooms: kept(locked, "bedrooms", next.bedrooms, existing.bedrooms),
                bathrooms: kept(locked, "bathrooms", next.bathrooms, existing.bathrooms),
                basePrice: kept(locked, "basePrice", next.basePrice, existing.basePrice),
                projectUrl: next.projectUrl,
                active: kept(locked, "active", next.active, existing.active),
                sourcePayload: next.sourcePayload,
                lastSyncedAt: next.lastSyncedAt
              })
              .where(eq(catalogProjects.id, existing.id));
          }

          const incomingAssets = desiredAssets(item, plans);
          const storedAssets = await tx.select().from(catalogAssets).where(eq(catalogAssets.projectId, projectId));
          const usedAssets = new Set<string>();
          for (const asset of incomingAssets) {
            const current = storedAssets.find((row) => !usedAssets.has(row.id) && row.type === asset.type && mediaKey(row.sourceUrl) === mediaKey(asset.sourceUrl));
            if (current) {
              usedAssets.add(current.id);
              await tx
                .update(catalogAssets)
                .set({
                  floorNumber: asset.floorNumber,
                  floorLabel: asset.floorLabel,
                  variantLabel: asset.variantLabel,
                  variantIndex: asset.variantIndex,
                  sortOrder: asset.sortOrder,
                  isPrimary: asset.isPrimary
                })
                .where(eq(catalogAssets.id, current.id));
            } else {
              await tx.insert(catalogAssets).values({ id: randomUUID(), projectId, localPath: "", ...asset, sourceUrl: fittedSource(asset.sourceUrl) });
            }
          }
          for (const asset of storedAssets) {
            if (!usedAssets.has(asset.id) && !asset.localPath) {
              await tx.delete(catalogAssets).where(eq(catalogAssets.id, asset.id));
            }
          }

          const incomingRooms = desiredRooms(plans);
          const storedRooms = await tx.select().from(catalogProjectRooms).where(eq(catalogProjectRooms.projectId, projectId));
          const usedRooms = new Set<string>();
          const occurrence = new Map<string, number>();
          for (const room of incomingRooms) {
            const key = roomKey(room, occurrence.get(`${room.variantLabel}|${room.floorNumber}|${room.name}`) ?? 0);
            occurrence.set(`${room.variantLabel}|${room.floorNumber}|${room.name}`, (occurrence.get(`${room.variantLabel}|${room.floorNumber}|${room.name}`) ?? 0) + 1);
            const storedOccurrence = new Map<string, number>();
            const current = storedRooms.find((row) => {
              const rowCount = storedOccurrence.get(`${row.variantLabel}|${row.floorNumber}|${row.name}`) ?? 0;
              storedOccurrence.set(`${row.variantLabel}|${row.floorNumber}|${row.name}`, rowCount + 1);
              return !usedRooms.has(row.id) && roomKey(row, rowCount) === key;
            });
            if (current) {
              usedRooms.add(current.id);
              await tx
                .update(catalogProjectRooms)
                .set({ area: room.area, sortOrder: room.sortOrder, variantIndex: room.variantIndex, variantLabel: room.variantLabel, floorLabel: room.floorLabel })
                .where(eq(catalogProjectRooms.id, current.id));
            } else {
              await tx.insert(catalogProjectRooms).values({ id: randomUUID(), projectId, polygon: [], ...room });
            }
          }
          for (const room of storedRooms) {
            if (!usedRooms.has(room.id) && polygonEmpty(room.polygon)) {
              await tx.delete(catalogProjectRooms).where(eq(catalogProjectRooms.id, room.id));
            }
          }
          return { created: !existing, assets: incomingAssets.length };
        });
        if (counts.created) createdCount += 1;
        else updatedCount += 1;
        assetsDiscovered += counts.assets;
      } catch (error) {
        errors.push(`${item.slug}: ${error instanceof Error ? error.message : "не записан"}`);
      }
    }

    const stored = await db.select().from(catalogProjects).where(eq(catalogProjects.source, "cms"));
    for (const project of stored) {
      if (seen.has(project.sourceUid) || overridesOf(project.syncOverrides).active) continue;
      await db.update(catalogProjects).set({ active: false, lastSyncedAt: new Date() }).where(eq(catalogProjects.id, project.id));
    }

    await db
      .update(catalogSyncRuns)
      .set({ status: "completed", createdCount, updatedCount, assetsDiscovered, errors, finishedAt: new Date() })
      .where(eq(catalogSyncRuns.id, runId));
    return { createdCount, updatedCount, assetsDiscovered, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Синхронизация не выполнена";
    await db
      .update(catalogSyncRuns)
      .set({ status: "failed", errors: [message], finishedAt: new Date() })
      .where(eq(catalogSyncRuns.id, runId));
    throw error;
  }
}
