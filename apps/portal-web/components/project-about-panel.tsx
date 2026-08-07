"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconStar,
  IconStarFilled
} from "@tabler/icons-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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
      <Tabs defaultValue="description">
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
              ) : tab.type === "floor_plan" ? (
                <FloorPlanExplication
                  assets={items}
                  projectName={projectName}
                  floors={floors}
                  busyId={assetBusyId}
                  onOpen={(index) => openViewer([items[index]!], 0)}
                  {...(onPatchAsset ? { onPatch: onPatchAsset } : {})}
                />
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

type ExplicationRoom = { name: string; area: number };

// Мок на время прототипа — в будущем данные пойдут из БД (плюс подсветка геометрии на схеме по выбранной строке)
const MOCK_ROOMS_BY_FLOOR: Record<number, ExplicationRoom[]> = {
  1: [
    { name: "Гостиная-кухня", area: 32.4 },
    { name: "Спальня", area: 14.1 },
    { name: "Санузел", area: 4.8 },
    { name: "Прихожая", area: 6.2 },
    { name: "Терраса", area: 12.5 },
    { name: "Крыльцо", area: 3.1 }
  ],
  2: [
    { name: "Спальня 1", area: 16.3 },
    { name: "Спальня 2", area: 13.7 },
    { name: "Санузел", area: 5.4 },
    { name: "Балкон", area: 6.8 }
  ]
};

function mockRoomsForFloor(floor: number): ExplicationRoom[] {
  return MOCK_ROOMS_BY_FLOOR[floor] ?? MOCK_ROOMS_BY_FLOOR[1]!;
}

function formatArea(area: number) {
  return `${area.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} м²`;
}

/** Планировка: схема этажа слева + экспликация помещений справа (с переключателем этажей) */
function FloorPlanExplication({
  assets,
  projectName,
  floors,
  busyId,
  onOpen,
  onPatch
}: {
  assets: AboutAsset[];
  projectName: string;
  floors: number | null;
  busyId: string | null;
  onOpen: (index: number) => void;
  onPatch?: (assetId: string, patch: AboutAssetPatch) => void;
}) {
  // Таб-этажи ведём от floors проекта, а не от тегов ассетов — реальные фото планировок
  // часто не размечены по этажу (особенно после синка из Tilda), и без этого второй этаж пропадал
  const floorCount = Math.max(floors ?? 1, 1);
  const floorNumbers = floorCount > 1 ? Array.from({ length: floorCount }, (_, i) => i + 1) : [1];
  const [selectedFloor, setSelectedFloor] = useState(floorNumbers[0] ?? 1);
  const [floorAssetIndex, setFloorAssetIndex] = useState(0);

  useEffect(() => {
    setFloorAssetIndex(0);
  }, [selectedFloor]);

  // Дом одноэтажный — разметка по этажу не нужна, любой ассет планировки однозначно 1-й этаж.
  // Если этажность здания вырастет, ассеты автоматически перестанут маркироваться неявно.
  const taggedForFloor =
    floorCount === 1
      ? assets
      : assets.filter((asset) => asset.floorNumber === selectedFloor);
  const untagged =
    floorCount === 1 ? [] : assets.filter((asset) => asset.floorNumber == null);
  // В редактировании неразмеченные фото — кандидаты на любой этаж, их нужно видеть и листать
  // независимо от того, есть ли уже тегированное фото. В обычном просмотре показываем только тегированное
  const floorAssets = onPatch ? [...taggedForFloor, ...untagged] : taggedForFloor;
  const current = floorAssets[Math.min(floorAssetIndex, floorAssets.length - 1)];

  function stepFloorAsset(delta: number) {
    if (floorAssets.length < 2) return;
    setFloorAssetIndex((prev) => (prev + delta + floorAssets.length) % floorAssets.length);
  }

  const assetIndex = current ? assets.indexOf(current) : -1;
  const busy = current ? busyId === current.id : false;
  const floorOptions = Array.from({ length: Math.max(floors ?? 0, 0) }, (_, i) => i + 1);
  const rooms = mockRoomsForFloor(selectedFloor);
  const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);

  return (
    <div className="flex flex-col gap-2 gallery-compact:h-[clamp(320px,52vh,560px)] gallery-compact:flex-row">
      <div className="bg-muted relative overflow-hidden rounded-xl border gallery-compact:h-full gallery-compact:min-w-0 gallery-compact:flex-[2]">
        {current ? (
          <>
            <button
              type="button"
              onClick={() => onOpen(assetIndex)}
              className="bg-background relative block aspect-video w-full cursor-zoom-in transition hover:opacity-95 gallery-compact:aspect-auto gallery-compact:h-full"
              aria-label={`Открыть: ${assetLabel(current, projectName)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.sourceUrl}
                alt={assetLabel(current, projectName)}
                loading="eager"
                decoding="async"
                draggable={false}
                className="absolute inset-0 size-full object-contain select-none"
              />
            </button>

            <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1">
              {current.isPrimary ? <Badge>Главный</Badge> : null}
              {current.isHidden ? <Badge variant="secondary">Скрыт</Badge> : null}
            </div>

            {onPatch && floorAssets.length > 1 ? (
              <div
                className="bg-background/90 absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full p-1 shadow-sm backdrop-blur"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-full"
                  onClick={() => stepFloorAsset(-1)}
                  aria-label="Предыдущий ассет"
                >
                  <IconChevronLeft className="size-4" />
                </Button>
                <span className="text-muted-foreground min-w-8 text-center text-xs tabular-nums">
                  {Math.min(floorAssetIndex, floorAssets.length - 1) + 1} / {floorAssets.length}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-full"
                  onClick={() => stepFloorAsset(1)}
                  aria-label="Следующий ассет"
                >
                  <IconChevronRight className="size-4" />
                </Button>
              </div>
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

                {floorOptions.length > 1 ? (
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
          </>
        ) : (
          <div className="text-muted-foreground flex aspect-video w-full items-center justify-center text-center text-sm gallery-compact:aspect-auto gallery-compact:h-full">
            Схема {selectedFloor}-го этажа ещё не загружена
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2 gallery-compact:h-full gallery-compact:min-w-0 gallery-compact:flex-1">
        {floorNumbers.length > 1 ? (
          <div className="flex shrink-0 flex-wrap items-center justify-start gap-2">
            <Tabs
              value={String(selectedFloor)}
              onValueChange={(value) => setSelectedFloor(Number(value))}
            >
              <TabsList className="h-8">
                {floorNumbers.map((floor) => (
                  <TabsTrigger key={floor} value={String(floor)} className="text-xs">
                    {floor}-й этаж
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        ) : null}

        <div className="min-h-0 overflow-hidden rounded-xl border gallery-compact:flex-1 gallery-compact:overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Помещение</TableHead>
                <TableHead className="text-right">Площадь</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.name}>
                  <TableCell className="whitespace-normal">{room.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatArea(room.area)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Итого</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatArea(totalArea)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <p className="text-muted-foreground shrink-0 text-xs gallery-compact:hidden">
          Данные для примера — экспликация ещё не подключена к проекту.
        </p>
      </div>
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
  const activeRef = useRef(active);
  activeRef.current = active;
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridScrollable, setGridScrollable] = useState(false);

  // Переключение компактной раскладки (gallery-compact) меняет ширину слайда —
  // без пересчёта scrollLeft слайдер застревает между кадрами
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(() => {
      if (scrollLockRef.current || el.clientWidth <= 0) return;
      el.scrollTo({ left: activeRef.current * el.clientWidth, behavior: "instant" as ScrollBehavior });
    });
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  // Фейд по краям сетки миниатюр нужен только когда она реально скроллится
  useEffect(() => {
    const el = gridRef.current;
    if (!el) {
      setGridScrollable(false);
      return;
    }
    const check = () => setGridScrollable(el.scrollHeight - el.clientHeight > 1);
    check();
    const resizeObserver = new ResizeObserver(check);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [assets.length]);

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
      <div className="flex flex-col gap-2 gallery-compact:h-[clamp(320px,52vh,560px)] gallery-compact:flex-row">
        <div className="bg-muted relative overflow-hidden rounded-xl border gallery-compact:h-full gallery-compact:min-w-0 gallery-compact:flex-[2]">
          <div
            ref={scrollerRef}
            onScroll={syncActiveFromScroll}
            className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain gallery-compact:h-full gallery-compact:snap-none gallery-compact:overflow-hidden"
          >
            {assets.map((asset, assetIndex) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onOpen(assetIndex)}
                className={cn(
                  "relative aspect-video w-full min-w-full shrink-0 cursor-zoom-in snap-center snap-always transition hover:opacity-95",
                  "gallery-compact:aspect-auto gallery-compact:h-full",
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

        {assets.length > 1 ? (
          <div className="relative gallery-compact:min-w-0 gallery-compact:flex-1">
            <div
              ref={gridRef}
              className={cn(
                "scrollbar-none flex gap-2 overflow-x-auto pb-0.5 gallery-compact:h-full gallery-compact:content-start gallery-compact:gap-1.5 gallery-compact:overflow-x-hidden gallery-compact:overflow-y-auto gallery-compact:overscroll-contain gallery-compact:pr-0.5 gallery-compact:pb-0",
                assets.length > 8
                  ? "gallery-compact:grid gallery-compact:grid-cols-3"
                  : "gallery-compact:grid gallery-compact:grid-cols-2"
              )}
            >
              {assets.map((asset, assetIndex) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => goTo(assetIndex)}
                  aria-label={`${title} ${assetIndex + 1}`}
                  aria-pressed={assetIndex === index}
                  className={cn(
                    "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-16 sm:w-24",
                    "gallery-compact:h-auto gallery-compact:w-full gallery-compact:shrink gallery-compact:aspect-video",
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

            {/* Фейд по краям сетки — только когда она реально скроллится, и еле заметный */}
            {gridScrollable ? (
              <>
                <div className="from-background/60 pointer-events-none absolute inset-x-0 top-0 hidden h-4 bg-gradient-to-b to-transparent gallery-compact:block" />
                <div className="from-background/60 pointer-events-none absolute inset-x-0 bottom-0 hidden h-4 bg-gradient-to-t to-transparent gallery-compact:block" />
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {isPlan && current.floorNumber != null ? (
        <p className="text-muted-foreground text-center text-xs font-medium">
          {floorPlanLabel(current.floorNumber)}
        </p>
      ) : null}
    </div>
  );
}
