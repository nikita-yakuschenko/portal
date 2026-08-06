"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconEye, IconEyeOff, IconStar, IconStarFilled } from "@tabler/icons-react";

import {
  ProjectMediaViewer,
  type ViewerItem
} from "@/components/project-media-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { floorPlanLabel } from "@/lib/floor-plan";
import { cn } from "@/lib/utils";

export const ASSET_TYPE_OPTIONS = [
  { value: "exterior", label: "Экстерьер" },
  { value: "floor_plan", label: "Планировка" },
  { value: "interior", label: "Интерьер" },
  { value: "unknown", label: "Неизвестно" }
] as const;

const MEDIA_TABS: Array<{ id: string; title: string; type: string }> = [
  { id: "floor_plan", title: "Планировка", type: "floor_plan" },
  { id: "exterior", title: "Экстерьер", type: "exterior" },
  { id: "interior", title: "Интерьер", type: "interior" }
];

export type AboutAsset = {
  id: string;
  sourceUrl: string;
  type: string;
  floorNumber?: number | null;
  sortOrder: number;
  isPrimary: boolean;
  isHidden?: boolean;
};

export type AboutAssetPatch = {
  type?: string;
  floorNumber?: number | null;
  isPrimary?: boolean;
  isHidden?: boolean;
};

function assetLabel(asset: AboutAsset, projectName: string) {
  return asset.type === "floor_plan" ? floorPlanLabel(asset.floorNumber) : projectName;
}

function sortAssets(items: AboutAsset[]) {
  return [...items].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder
  );
}

/**
 * Вкладка «О проекте» — второй уровень: Описание / Планировка / Экстерьер / Интерьер [/ Служебное].
 * Правка описания и управление ассетами — только HQ.
 */
export function ProjectAboutPanel({
  projectName,
  description,
  assets,
  floors,
  editable = false,
  savingDescription = false,
  onSaveDescription,
  descriptionProtected = false,
  assetBusyId = null,
  onPatchAsset,
  extra
}: {
  projectName: string;
  description: string;
  assets: AboutAsset[];
  floors: number | null;
  editable?: boolean;
  savingDescription?: boolean;
  onSaveDescription?: (next: string) => void;
  /** Точка защиты синка — над подписью таба «Описание», без влияния на размер */
  descriptionProtected?: boolean;
  assetBusyId?: string | null;
  onPatchAsset?: (assetId: string, patch: AboutAssetPatch) => void;
  extra?: ReactNode;
}) {
  const [viewer, setViewer] = useState<{ items: ViewerItem[]; index: number } | null>(
    null
  );
  const [descriptionDraft, setDescriptionDraft] = useState(description);

  // Синхронизация с сервером и сброс черновика при выходе из edit
  useEffect(() => {
    setDescriptionDraft(description);
  }, [description]);

  useEffect(() => {
    if (!editable) setDescriptionDraft(description);
  }, [editable, description]);

  const byType = (type: string) =>
    sortAssets(assets.filter((asset) => asset.type === type));

  const unknownAssets = byType("unknown");

  function openViewer(sectionAssets: AboutAsset[], index: number) {
    setViewer({
      items: sectionAssets.map((asset) => ({
        id: asset.id,
        sourceUrl: asset.sourceUrl,
        label: assetLabel(asset, projectName)
      })),
      index
    });
  }

  return (
    <div className="space-y-3">
      <Tabs defaultValue="description" className="gap-2">
        <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="description">
            <span className="relative inline-flex items-center">
              Описание
              {descriptionProtected ? (
                <span
                  className="bg-amber-500/90 absolute top-0 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  title="Защищено от синхронизации Tilda"
                  aria-label="Описание защищено от синхронизации Tilda"
                />
              ) : null}
            </span>
          </TabsTrigger>
          {MEDIA_TABS.map((tab) => {
            const count = byType(tab.type).length;
            return (
              <TabsTrigger key={tab.id} value={tab.id} disabled={count === 0}>
                {tab.title}
                <span className="text-muted-foreground ml-1 tabular-nums">({count})</span>
              </TabsTrigger>
            );
          })}
          {extra ? <TabsTrigger value="service">Служебное</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="description" className="space-y-3">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editable) return;
              onSaveDescription?.(descriptionDraft);
            }}
          >
            {/* Один каркас в обоих режимах — иначе textarea ↔ текст прыгает по размеру */}
            <Textarea
              name="description"
              rows={10}
              value={descriptionDraft}
              readOnly={!editable}
              tabIndex={editable ? 0 : -1}
              aria-readonly={!editable}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              className={cn(
                "min-h-48 resize-none text-sm shadow-none",
                editable
                  ? undefined
                  : "border-transparent bg-transparent focus-visible:border-transparent focus-visible:ring-0"
              )}
            />
            {onSaveDescription ? (
              <div className="flex h-8 items-center">
                {editable ? (
                  <Button type="submit" size="sm" disabled={savingDescription}>
                    {savingDescription ? <Spinner /> : null}
                    Сохранить
                  </Button>
                ) : null}
              </div>
            ) : null}
          </form>
        </TabsContent>

        {MEDIA_TABS.map((tab) => {
          const items = byType(tab.type);
          return (
            <TabsContent key={tab.id} value={tab.id}>
              {items.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">Пока пусто</p>
              ) : (
                <AssetCarousel
                  title={tab.title}
                  assets={items}
                  projectName={projectName}
                  floors={floors}
                  busyId={assetBusyId}
                  onOpen={(index) => openViewer(items, index)}
                  {...(onPatchAsset ? { onPatch: onPatchAsset } : {})}
                />
              )}
            </TabsContent>
          );
        })}

        {extra ? (
          <TabsContent value="service" className="space-y-4">
            {editable && unknownAssets.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Неразмеченные фото
                  <span className="text-muted-foreground ml-1 tabular-nums">
                    ({unknownAssets.length})
                  </span>
                </p>
                <AssetCarousel
                  title="Неразмеченные"
                  assets={unknownAssets}
                  projectName={projectName}
                  floors={floors}
                  busyId={assetBusyId}
                  onOpen={(index) => openViewer(unknownAssets, index)}
                  {...(onPatchAsset ? { onPatch: onPatchAsset } : {})}
                />
              </div>
            ) : null}
            {extra}
          </TabsContent>
        ) : null}
      </Tabs>

      <ProjectMediaViewer
        items={viewer?.items ?? []}
        index={viewer?.index ?? 0}
        open={Boolean(viewer)}
        title={projectName}
        onIndexChange={(next) => setViewer((prev) => (prev ? { ...prev, index: next } : prev))}
        onOpenChange={(open) => {
          if (!open) setViewer(null);
        }}
      />
    </div>
  );
}

/** Карусель раздела: крупное фото + миниатюры; в HQ — панель управления */
function AssetCarousel({
  title,
  assets,
  projectName,
  floors,
  busyId,
  onOpen,
  onPatch
}: {
  title: string;
  assets: AboutAsset[];
  projectName: string;
  floors: number | null;
  busyId: string | null;
  onOpen: (index: number) => void;
  onPatch?: (assetId: string, patch: AboutAssetPatch) => void;
}) {
  const [active, setActive] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollLockRef = useRef(false);

  const index = Math.min(active, assets.length - 1);
  const current = assets[index];
  if (!current) return null;

  const isPlan = current.type === "floor_plan";

  function syncActiveFromScroll() {
    const el = scrollerRef.current;
    if (!el || scrollLockRef.current || el.clientWidth <= 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.min(Math.max(next, 0), assets.length - 1);
    setActive((prev) => (prev === clamped ? prev : clamped));
  }

  function goTo(next: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.min(Math.max(next, 0), assets.length - 1);
    setActive(clamped);
    scrollLockRef.current = true;
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    window.setTimeout(() => {
      scrollLockRef.current = false;
      syncActiveFromScroll();
    }, 420);
  }

  const floorOptions = Array.from({ length: Math.max(floors ?? 0, 0) }, (_, i) => i + 1);
  const busy = busyId === current.id;

  return (
    <div className="space-y-2">
      <div className="bg-muted relative overflow-hidden rounded-xl border">
        <div
          ref={scrollerRef}
          onScroll={syncActiveFromScroll}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {assets.map((asset, assetIndex) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => onOpen(assetIndex)}
              className={cn(
                "relative aspect-video w-full min-w-full shrink-0 cursor-zoom-in snap-center snap-always transition hover:opacity-95",
                asset.type === "floor_plan" ? "bg-background" : "bg-muted",
                asset.isHidden && "opacity-55"
              )}
              aria-label={`Открыть: ${assetLabel(asset, projectName)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.sourceUrl}
                alt={assetLabel(asset, projectName)}
                loading={assetIndex === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                className={cn(
                  "absolute inset-0 size-full select-none",
                  asset.type === "floor_plan" ? "object-contain" : "object-cover"
                )}
              />
            </button>
          ))}
        </div>

        <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1">
          {current.isPrimary ? <Badge>Главный</Badge> : null}
          {current.isHidden ? <Badge variant="secondary">Скрыт</Badge> : null}
        </div>

        {assets.length > 1 ? (
          <p className="bg-background/90 text-muted-foreground pointer-events-none absolute top-3 right-3 rounded-md px-2 py-1 text-xs font-medium tabular-nums shadow-sm backdrop-blur">
            {index + 1} / {assets.length}
          </p>
        ) : null}

        {onPatch ? (
          <div
            className="bg-background/90 absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 rounded-lg p-1.5 shadow-sm backdrop-blur"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Select
              value={current.type}
              disabled={busy}
              onValueChange={(value) => onPatch(current.id, { type: value })}
            >
              <SelectTrigger size="sm" className="h-8 w-36 text-xs" aria-label="Раздел">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isPlan && floorOptions.length > 1 ? (
              <Select
                value={current.floorNumber != null ? String(current.floorNumber) : "unset"}
                disabled={busy}
                onValueChange={(value) =>
                  onPatch(current.id, {
                    floorNumber: value === "unset" ? null : Number(value)
                  })
                }
              >
                <SelectTrigger size="sm" className="h-8 w-36 text-xs" aria-label="Этаж">
                  <SelectValue placeholder="Этаж" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Этаж не указан</SelectItem>
                  {floorOptions.map((floor) => (
                    <SelectItem key={floor} value={String(floor)}>
                      {floor}-й этаж
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant={current.isPrimary ? "default" : "outline"}
              className="h-8"
              disabled={busy || current.isPrimary}
              onClick={() => onPatch(current.id, { isPrimary: true })}
            >
              {current.isPrimary ? (
                <IconStarFilled className="size-4" />
              ) : (
                <IconStar className="size-4" />
              )}
              Главный
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={busy}
              onClick={() => onPatch(current.id, { isHidden: !current.isHidden })}
            >
              {current.isHidden ? (
                <IconEye className="size-4" />
              ) : (
                <IconEyeOff className="size-4" />
              )}
              {current.isHidden ? "Показать" : "Скрыть"}
            </Button>

            {busy ? <Spinner className="size-4" /> : null}
          </div>
        ) : null}
      </div>

      {isPlan && current.floorNumber != null ? (
        <p className="text-muted-foreground text-center text-xs font-medium">
          {floorPlanLabel(current.floorNumber)}
        </p>
      ) : null}

      {assets.length > 1 ? (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-0.5">
          {assets.map((asset, assetIndex) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => goTo(assetIndex)}
              aria-label={`${title} ${assetIndex + 1}`}
              aria-pressed={assetIndex === index}
              className={cn(
                "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-16 sm:w-24",
                assetIndex === index
                  ? "border-primary"
                  : "border-border hover:border-muted-foreground/50",
                asset.isHidden && "opacity-55"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.sourceUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className={cn(
                  "size-full",
                  asset.type === "floor_plan" ? "bg-background object-contain" : "object-cover"
                )}
              />
              {asset.type === "floor_plan" && asset.floorNumber != null ? (
                <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] leading-tight font-medium text-white">
                  {asset.floorNumber} эт.
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
