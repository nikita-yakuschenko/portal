"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Reorder, useDragControls } from "framer-motion";
import {
  IconArrowBackUp,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconGripVertical,
  IconPlus,
  IconRectangle,
  IconShape3,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconVectorTriangle,
  IconX
} from "@tabler/icons-react";

import {
  ProjectMediaViewer,
  type ViewerItem
} from "@/components/project-media-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/** Одинаковые колонки в просмотре и редакторе: grip | название | действия | площадь */
const ROOM_ROW_GRID =
  "grid h-9 grid-cols-[1.5rem_minmax(0,1fr)_3.75rem_5.5rem] items-center gap-2 px-2 text-sm";

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

/** Точка контура помещения на схеме этажа — проценты 0..100 от картинки */
export type RoomPoint = { x: number; y: number };

/** Прямоугольник (2 клика) или ломаная с углами строго 90° */
type DrawTool = "rectangle" | "orthogonal";

export type ProjectRoom = {
  id: string;
  projectId: string;
  floorNumber: number;
  name: string;
  area: number;
  sortOrder: number;
  polygon: RoomPoint[];
};

export type RoomPatch = {
  name?: string;
  area?: number;
  polygon?: RoomPoint[];
  sortOrder?: number;
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
  rooms = [],
  editable = false,
  savingDescription = false,
  onSaveDescription,
  descriptionProtected = false,
  showDescription = true,
  assetBusyId = null,
  onPatchAsset,
  roomBusyId = null,
  onCreateRoom,
  onPatchRoom,
  onDeleteRoom,
  extra
}: {
  projectName: string;
  description: string;
  assets: AboutAsset[];
  floors: number | null;
  rooms?: ProjectRoom[];
  editable?: boolean;
  savingDescription?: boolean;
  onSaveDescription?: (next: string) => void;
  /** Точка защиты синка — над подписью таба «Описание», без влияния на размер */
  descriptionProtected?: boolean;
  /** Общий раздел дилера: только медиа, без вкладки «Описание» */
  showDescription?: boolean;
  assetBusyId?: string | null;
  onPatchAsset?: (assetId: string, patch: AboutAssetPatch) => void;
  roomBusyId?: string | null;
  onCreateRoom?: (data: { floorNumber: number; name: string; area: number }) => void;
  onPatchRoom?: (roomId: string, patch: RoomPatch) => void;
  onDeleteRoom?: (roomId: string) => void;
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

  const defaultTab = showDescription
    ? "description"
    : (MEDIA_TABS.find((tab) => byType(tab.type).length > 0)?.id ?? MEDIA_TABS[0]!.id);

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
      <Tabs defaultValue={defaultTab}>
        <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
          {showDescription ? (
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
          ) : null}
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

        {showDescription ? (
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
        ) : null}

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
                  rooms={rooms}
                  busyId={assetBusyId}
                  roomBusyId={roomBusyId}
                  onOpen={(index) => openViewer([items[index]!], 0)}
                  {...(onPatchAsset ? { onPatch: onPatchAsset } : {})}
                  {...(onCreateRoom ? { onCreateRoom } : {})}
                  {...(onPatchRoom ? { onPatchRoom } : {})}
                  {...(onDeleteRoom ? { onDeleteRoom } : {})}
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

/** Прямоугольник, в который картинка реально вписывается внутри контейнера (object-contain) —
 * нужен, чтобы точки контура (в % от картинки) совпадали с пикселями при леттербоксинге */
function useContainedImageRect(
  imgRef: React.RefObject<HTMLImageElement | null>,
  boxRef: React.RefObject<HTMLElement | null>,
  dep: string
) {
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null
  );

  useEffect(() => {
    const img = imgRef.current;
    const box = boxRef.current;
    if (!img || !box) return;

    function update() {
      if (!img || !box) return;
      const cw = box.clientWidth;
      const ch = box.clientHeight;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!cw || !ch || !nw || !nh) return;
      const scale = Math.min(cw / nw, ch / nh);
      const width = nw * scale;
      const height = nh * scale;
      setRect({ left: (cw - width) / 2, top: (ch - height) / 2, width, height });
    }

    update();
    if (!img.complete) img.addEventListener("load", update);
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(box);
    return () => {
      img.removeEventListener("load", update);
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);

  return rect;
}

function formatArea(area: number) {
  return `${area.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} м²`;
}

/** Следующая точка ломаной всегда либо строго по горизонтали, либо строго по вертикали от предыдущей */
function snapOrthogonal(from: RoomPoint, to: RoomPoint): RoomPoint {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}

function buildRectanglePolygon(a: RoomPoint, b: RoomPoint): RoomPoint[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y }
  ];
}

/** Если последняя точка не выровнена с первой ни по одной оси — добавляем угол, чтобы замыкание тоже было под 90° */
function closeOrthogonalPolygon(points: RoomPoint[]): RoomPoint[] {
  if (points.length < 3) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (Math.abs(last.x - first.x) < 0.01 || Math.abs(last.y - first.y) < 0.01) {
    return points;
  }
  return [...points, { x: first.x, y: last.y }];
}

/** Узел контура — обычный HTML-кружок поверх картинки, а не SVG-circle: иначе он сплющивается
 * при preserveAspectRatio="none" на некватратной картинке */
function ContourNodeHandle({
  point,
  containedRect,
  variant = "default"
}: {
  point: RoomPoint;
  containedRect: { left: number; top: number; width: number; height: number };
  variant?: "default" | "closable";
}) {
  const size = variant === "closable" ? 16 : 10;
  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.4)]",
        variant === "closable" ? "bg-emerald-500 animate-pulse" : "bg-blue-600"
      )}
      style={{
        left: containedRect.left + (point.x / 100) * containedRect.width,
        top: containedRect.top + (point.y / 100) * containedRect.height,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)"
      }}
    />
  );
}

/** Строка экспликации: Framer Motion Reorder + drag только за grip */
function ReorderRoomRow({
  room,
  roomBusy,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
  onPatchRoom,
  onStartDrawing,
  onDeleteRoom,
  onDragStart,
  onDragEnd
}: {
  room: ProjectRoom;
  roomBusy: boolean;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPatchRoom?: (roomId: string, patch: RoomPatch) => void;
  onStartDrawing: (room: ProjectRoom) => void;
  onDeleteRoom?: (roomId: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  // Стили drag только через React-state — whileDrag иногда «залипает» после drop
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Reorder.Item
      as="div"
      value={room.id}
      dragListener={false}
      dragControls={controls}
      dragElastic={0.08}
      onDragStart={() => {
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      className={cn(
        ROOM_ROW_GRID,
        "relative border-b bg-background last:border-b-0",
        isHighlighted && !isDragging && "bg-muted/60",
        isDragging && "z-20 cursor-grabbing shadow-md"
      )}
      style={{ position: "relative" }}
      transition={{ type: "spring", stiffness: 500, damping: 38, mass: 0.6 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex cursor-grab items-center touch-none active:cursor-grabbing"
        aria-label="Перетащить, чтобы изменить порядок"
        title="Перетащить, чтобы изменить порядок"
        onPointerDown={(event) => {
          // Без preventDefault фокус может уехать в input и оборвать gesture
          event.preventDefault();
          controls.start(event);
        }}
      >
        <IconGripVertical className="size-4" />
      </button>
      <div className="min-w-0 whitespace-normal">
        <Input
          key={`${room.id}-name`}
          defaultValue={room.name}
          disabled={roomBusy}
          className="h-7 border-transparent bg-transparent px-1 text-sm shadow-none focus-visible:border-input focus-visible:bg-background"
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next && next !== room.name) {
              onPatchRoom?.(room.id, { name: next });
            } else {
              event.target.value = room.name;
            }
          }}
        />
      </div>
      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={roomBusy}
          onClick={() => onStartDrawing(room)}
          aria-label="Обвести контур на схеме"
          title="Обвести контур на схеме"
        >
          <IconVectorTriangle className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={roomBusy}
          onClick={() => onDeleteRoom?.(room.id)}
          aria-label="Удалить помещение"
        >
          {roomBusy ? <Spinner className="size-4" /> : <IconTrash className="size-4" />}
        </Button>
      </div>
      <div className="flex justify-end text-right tabular-nums">
        <Input
          key={`${room.id}-area`}
          type="number"
          step="0.1"
          min="0"
          defaultValue={room.area}
          disabled={roomBusy}
          className="h-7 w-20 border-transparent bg-transparent px-1 text-right text-sm shadow-none focus-visible:border-input focus-visible:bg-background"
          onBlur={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next) && next > 0 && next !== room.area) {
              onPatchRoom?.(room.id, { area: next });
            } else {
              event.target.value = String(room.area);
            }
          }}
        />
      </div>
    </Reorder.Item>
  );
}

/** Компактная плоская панель управления ассетом */
function AssetEditToolbar({
  asset,
  busy,
  floorOptions,
  showFloorSelect,
  onPatch
}: {
  asset: AboutAsset;
  busy: boolean;
  floorOptions: number[];
  showFloorSelect: boolean;
  onPatch: (assetId: string, patch: AboutAssetPatch) => void;
}) {
  const visibilityLabel = asset.isHidden ? "Показать" : "Скрыть";

  return (
    <div
      className="bg-background/90 absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-full p-1.5 shadow-sm backdrop-blur"
      aria-busy={busy}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Select
        value={asset.type}
        disabled={busy}
        onValueChange={(value) => onPatch(asset.id, { type: value })}
      >
        <SelectTrigger
          size="sm"
          className="h-8 w-auto max-w-40 rounded-full text-xs"
          aria-label="Раздел"
        >
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

      {showFloorSelect && floorOptions.length > 1 ? (
        <Select
          value={asset.floorNumber != null ? String(asset.floorNumber) : "unset"}
          disabled={busy}
          onValueChange={(value) =>
            onPatch(asset.id, {
              floorNumber: value === "unset" ? null : Number(value)
            })
          }
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-auto max-w-40 rounded-full text-xs"
            aria-label="Этаж"
          >
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
        size="icon-sm"
        variant={asset.isPrimary ? "default" : "ghost"}
        className="rounded-full"
        disabled={busy}
        aria-label={asset.isPrimary ? "Главный ассет" : "Сделать главным"}
        aria-pressed={asset.isPrimary}
        title={asset.isPrimary ? "Главный ассет" : "Сделать главным"}
        onClick={() => {
          if (!asset.isPrimary) onPatch(asset.id, { isPrimary: true });
        }}
      >
        {asset.isPrimary ? (
          <IconStarFilled className="size-4" />
        ) : (
          <IconStar className="size-4" />
        )}
      </Button>

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="rounded-full"
        disabled={busy}
        aria-label={visibilityLabel}
        title={visibilityLabel}
        onClick={() => onPatch(asset.id, { isHidden: !asset.isHidden })}
      >
        {asset.isHidden ? (
          <IconEye className="size-4" />
        ) : (
          <IconEyeOff className="size-4" />
        )}
      </Button>

      {busy ? <Spinner className="mx-1 size-4" /> : null}
    </div>
  );
}

/** Планировка: схема этажа слева + экспликация помещений справа (с переключателем этажей) */
function FloorPlanExplication({
  assets,
  projectName,
  floors,
  rooms,
  busyId,
  roomBusyId = null,
  onOpen,
  onPatch,
  onCreateRoom,
  onPatchRoom,
  onDeleteRoom
}: {
  assets: AboutAsset[];
  projectName: string;
  floors: number | null;
  rooms: ProjectRoom[];
  busyId: string | null;
  roomBusyId?: string | null;
  onOpen: (index: number) => void;
  onPatch?: (assetId: string, patch: AboutAssetPatch) => void;
  onCreateRoom?: (data: { floorNumber: number; name: string; area: number }) => void;
  onPatchRoom?: (roomId: string, patch: RoomPatch) => void;
  onDeleteRoom?: (roomId: string) => void;
}) {
  // Таб-этажи ведём от floors проекта, а не от тегов ассетов — реальные фото планировок
  // часто не размечены по этажу (особенно после синка из Tilda), и без этого второй этаж пропадал
  const floorCount = Math.max(floors ?? 1, 1);
  const floorNumbers = floorCount > 1 ? Array.from({ length: floorCount }, (_, i) => i + 1) : [1];
  const [selectedFloor, setSelectedFloor] = useState(floorNumbers[0] ?? 1);
  const [floorAssetIndex, setFloorAssetIndex] = useState(0);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const [drawingRoomId, setDrawingRoomId] = useState<string | null>(null);
  const [drawTool, setDrawTool] = useState<DrawTool>("rectangle");
  const [draftPolygon, setDraftPolygon] = useState<RoomPoint[]>([]);
  const [rectStart, setRectStart] = useState<RoomPoint | null>(null);
  const [cursorPoint, setCursorPoint] = useState<RoomPoint | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setFloorAssetIndex(0);
  }, [selectedFloor]);

  // Выход из общего edit mode должен закрывать и локальный режим рисования
  useEffect(() => {
    if (onPatchRoom) return;
    setDrawingRoomId(null);
    setDraftPolygon([]);
    setRectStart(null);
    setCursorPoint(null);
  }, [onPatchRoom]);

  // Плашка инструментов — не оверлей ВНУТРИ схемы (перекрывает точки клика), а портал,
  // подвешенный чуть выше блока схемы; не зависит от overflow-hidden контейнера
  function measureToolbarPos() {
    const box = boxRef.current;
    if (!box) return null;
    const boxRect = box.getBoundingClientRect();
    const toolbarWidth = toolbarRef.current?.offsetWidth ?? 480;
    const toolbarHeight = toolbarRef.current?.offsetHeight ?? 44;
    return {
      top: Math.max(8, boxRect.top - toolbarHeight),
      left: Math.min(
        Math.max(8, boxRect.left + boxRect.width / 2 - toolbarWidth / 2),
        window.innerWidth - toolbarWidth - 8
      )
    };
  }

  useLayoutEffect(() => {
    if (!drawingRoomId) {
      setToolbarPos(null);
      return;
    }
    setToolbarPos(measureToolbarPos());
    const raf = window.requestAnimationFrame(() => setToolbarPos(measureToolbarPos()));
    return () => window.cancelAnimationFrame(raf);
  }, [drawingRoomId, drawTool, rectStart, draftPolygon.length]);

  useEffect(() => {
    if (!drawingRoomId) return;
    function reposition() {
      setToolbarPos(measureToolbarPos());
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [drawingRoomId]);

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
  const containedRect = useContainedImageRect(imgRef, boxRef, `${current?.id ?? ""}`);

  function stepFloorAsset(delta: number) {
    if (floorAssets.length < 2) return;
    setFloorAssetIndex((prev) => (prev + delta + floorAssets.length) % floorAssets.length);
  }

  function resetDraft() {
    setDraftPolygon([]);
    setRectStart(null);
    setCursorPoint(null);
  }

  function startDrawing(room: ProjectRoom) {
    setDrawingRoomId(room.id);
    setDrawTool("rectangle");
    resetDraft();
  }

  function cancelDrawing() {
    setDrawingRoomId(null);
    resetDraft();
  }

  function selectDrawTool(tool: DrawTool) {
    if (tool === drawTool) return;
    setDrawTool(tool);
    resetDraft();
  }

  function commitPolygon(polygon: RoomPoint[]) {
    if (!drawingRoomId) return;
    onPatchRoom?.(drawingRoomId, { polygon });
    setDrawingRoomId(null);
    resetDraft();
  }

  function undoLastStep() {
    if (drawTool === "rectangle") {
      setRectStart(null);
      return;
    }
    setDraftPolygon((prev) => prev.slice(0, -1));
  }

  function finishOrthogonal() {
    if (draftPolygon.length < 3) return;
    commitPolygon(closeOrthogonalPolygon(draftPolygon));
  }

  function pixelDistance(a: RoomPoint, b: RoomPoint): number {
    if (!containedRect) return Infinity;
    const dx = ((a.x - b.x) / 100) * containedRect.width;
    const dy = ((a.y - b.y) / 100) * containedRect.height;
    return Math.hypot(dx, dy);
  }

  // Мягкое примагничивание к вершинам соседних помещений — только пока курсор реально рядом,
  // стоит увести мышь дальше — точка ставится там, где кликнули, без принуждения
  function magnetSnap(point: RoomPoint): RoomPoint {
    const threshold = 10;
    let best = point;
    let bestDist = threshold;
    for (const room of floorRooms) {
      if (room.id === drawingRoomId) continue;
      for (const vertex of room.polygon) {
        const dist = pixelDistance(point, vertex);
        if (dist < bestDist) {
          bestDist = dist;
          best = vertex;
        }
      }
    }
    return best;
  }

  function pointFromEvent(event: React.MouseEvent<SVGSVGElement>): RoomPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    return magnetSnap({ x, y });
  }

  function handleSvgMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    if (!drawingRoomId) return;
    setCursorPoint(pointFromEvent(event));
  }

  function handleSvgClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!drawingRoomId) return;
    const point = pointFromEvent(event);

    if (drawTool === "rectangle") {
      if (!rectStart) {
        setRectStart(point);
        return;
      }
      commitPolygon(buildRectanglePolygon(rectStart, point));
      return;
    }

    // Ломаная: замыкаем клик по первой точке, иначе добавляем следующий угол под 90°
    const first = draftPolygon[0];
    if (first && draftPolygon.length >= 3 && pixelDistance(point, first) < 14) {
      commitPolygon(closeOrthogonalPolygon(draftPolygon));
      return;
    }
    const last = draftPolygon[draftPolygon.length - 1];
    setDraftPolygon((prev) => [...prev, last ? snapOrthogonal(last, point) : point]);
  }

  const assetIndex = current ? assets.indexOf(current) : -1;
  const busy = current ? busyId === current.id : false;
  const floorOptions = Array.from({ length: Math.max(floors ?? 0, 0) }, (_, i) => i + 1);
  const floorRooms = rooms
    .filter((room) => room.floorNumber === selectedFloor)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const canEditRooms = Boolean(onPatchRoom);
  const floorRoomsById = useMemo(
    () => new Map(floorRooms.map((room) => [room.id, room])),
    [floorRooms]
  );
  // Локальный порядок для Reorder — анимация сразу, PATCH только по окончании drag
  const [orderedRoomIds, setOrderedRoomIds] = useState<string[]>(() =>
    floorRooms.map((room) => room.id)
  );
  const orderedRoomIdsRef = useRef(orderedRoomIds);
  orderedRoomIdsRef.current = orderedRoomIds;
  const isReorderingRef = useRef(false);
  const roomsOrderKey = floorRooms.map((room) => `${room.id}:${room.sortOrder}`).join("|");

  useEffect(() => {
    if (isReorderingRef.current) return;
    const next = rooms
      .filter((room) => room.floorNumber === selectedFloor)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((room) => room.id);
    setOrderedRoomIds((prev) =>
      prev.length === next.length && prev.every((id, index) => id === next[index]) ? prev : next
    );
  }, [selectedFloor, roomsOrderKey, rooms]);

  function persistRoomOrder(ids: string[]) {
    ids.forEach((id, index) => {
      const room = floorRoomsById.get(id);
      if (room && room.sortOrder !== index) {
        onPatchRoom?.(id, { sortOrder: index });
      }
    });
  }

  function handleRoomDragEnd() {
    isReorderingRef.current = false;
    // PATCH после кадра — иначе remount от ответа API обрывает layout-анимацию и строка «залипает»
    const ids = orderedRoomIdsRef.current;
    requestAnimationFrame(() => persistRoomOrder(ids));
  }

  function polygonToSvgPoints(polygon: RoomPoint[]) {
    return polygon.map((point) => `${point.x},${point.y}`).join(" ");
  }

  return (
    <div className="flex flex-col gap-2 gallery-split:flex-row gallery-split:items-stretch">
      {drawingRoomId && toolbarPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={toolbarRef}
              style={{ position: "fixed", top: toolbarPos.top, left: toolbarPos.left, zIndex: 9999 }}
              className="flex flex-wrap items-center gap-1.5 rounded-full bg-background/95 p-1.5 shadow-md backdrop-blur"
            >
              <div className="bg-muted flex items-center gap-0.5 rounded-full p-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant={drawTool === "rectangle" ? "default" : "ghost"}
                  className="size-7 rounded-full"
                  onClick={() => selectDrawTool("rectangle")}
                  aria-label="Прямоугольник"
                  title="Прямоугольник"
                >
                  <IconRectangle className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant={drawTool === "orthogonal" ? "default" : "ghost"}
                  className="size-7 rounded-full"
                  onClick={() => selectDrawTool("orthogonal")}
                  aria-label="Ломаная, углы 90°"
                  title="Ломаная, углы 90°"
                >
                  <IconShape3 className="size-4" />
                </Button>
              </div>

              <span className="text-muted-foreground w-96 shrink-0 px-1 text-center text-xs whitespace-nowrap">
                {drawTool === "rectangle"
                  ? rectStart
                    ? "Кликните противоположный угол"
                    : "Кликните первый угол прямоугольника"
                  : draftPolygon.length === 0
                    ? "Кликайте по углам — стороны выравниваются под 90°"
                    : draftPolygon.length < 3
                      ? `Точек: ${draftPolygon.length}`
                      : "Кликните по первой точке или нажмите ✓, чтобы замкнуть"}
              </span>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 rounded-full"
                disabled={drawTool === "rectangle" ? !rectStart : draftPolygon.length === 0}
                onClick={undoLastStep}
                aria-label="Отменить последний шаг"
                title="Отменить последний шаг"
              >
                <IconArrowBackUp className="size-4" />
              </Button>

              {drawTool === "orthogonal" ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-full"
                  disabled={draftPolygon.length < 3}
                  onClick={finishOrthogonal}
                  aria-label="Замкнуть контур"
                  title="Замкнуть контур"
                >
                  <IconCheck className="size-4" />
                </Button>
              ) : null}

              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 rounded-full"
                onClick={cancelDrawing}
                aria-label="Отменить рисование"
                title="Отменить рисование"
              >
                <IconX className="size-4" />
              </Button>
            </div>,
            document.body
          )
        : null}

      <div
        ref={boxRef}
        className="bg-muted relative overflow-hidden rounded-xl border gallery-split:min-w-0 gallery-split:flex-[2]"
      >
        {current ? (
          <>
            {drawingRoomId ? (
              <div className="bg-background relative block aspect-video w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={current.sourceUrl}
                  alt={assetLabel(current, projectName)}
                  loading="eager"
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 size-full object-contain select-none"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(assetIndex)}
                className="bg-background relative block aspect-video w-full cursor-zoom-in transition hover:opacity-95"
                aria-label={`Открыть: ${assetLabel(current, projectName)}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={current.sourceUrl}
                  alt={assetLabel(current, projectName)}
                  loading="eager"
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 size-full object-contain select-none"
                />
              </button>
            )}

            {containedRect ? (
              <svg
                className="absolute"
                style={{
                  left: containedRect.left,
                  top: containedRect.top,
                  width: containedRect.width,
                  height: containedRect.height,
                  cursor: drawingRoomId ? "crosshair" : undefined
                }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                onClick={drawingRoomId ? handleSvgClick : undefined}
                onMouseMove={drawingRoomId ? handleSvgMouseMove : undefined}
                onMouseLeave={drawingRoomId ? () => setCursorPoint(null) : undefined}
              >
                {floorRooms
                  .filter((room) => room.polygon.length >= 3 && room.id !== drawingRoomId)
                  .map((room) => {
                    // Во время рисования — только тонкий ориентир контуром соседей, без интерактива
                    if (drawingRoomId) {
                      return (
                        <polygon
                          key={room.id}
                          points={polygonToSvgPoints(room.polygon)}
                          vectorEffect="non-scaling-stroke"
                          fill="rgba(100,116,139,0.06)"
                          stroke="rgba(100,116,139,0.45)"
                          strokeDasharray="2 2"
                          strokeWidth={1}
                          style={{ pointerEvents: "none" }}
                        />
                      );
                    }
                    const active = hoveredRoomId === room.id;
                    return (
                      <polygon
                        key={room.id}
                        points={polygonToSvgPoints(room.polygon)}
                        fill={active ? "rgba(37,99,235,0.28)" : "rgba(0,0,0,0)"}
                        stroke="none"
                        className="pointer-events-auto cursor-pointer transition-colors duration-150"
                        onMouseEnter={() => setHoveredRoomId(room.id)}
                        onMouseLeave={() => setHoveredRoomId((prev) => (prev === room.id ? null : prev))}
                      />
                    );
                  })}

                {drawingRoomId && drawTool === "rectangle" && rectStart && cursorPoint ? (
                  <polygon
                    points={polygonToSvgPoints(buildRectanglePolygon(rectStart, cursorPoint))}
                    vectorEffect="non-scaling-stroke"
                    fill="rgba(37,99,235,0.18)"
                    stroke="rgba(37,99,235,0.85)"
                    strokeDasharray="2 1.5"
                    strokeWidth={1.5}
                  />
                ) : null}

                {drawingRoomId && drawTool === "orthogonal" && draftPolygon.length > 0 ? (
                  <>
                    {draftPolygon.length >= 2 ? (
                      <polyline
                        points={polygonToSvgPoints(draftPolygon)}
                        vectorEffect="non-scaling-stroke"
                        fill="none"
                        stroke="rgba(37,99,235,0.85)"
                        strokeWidth={1.5}
                      />
                    ) : null}
                    {cursorPoint
                      ? (() => {
                          const last = draftPolygon[draftPolygon.length - 1]!;
                          const snapped = snapOrthogonal(last, cursorPoint);
                          return (
                            <line
                              x1={last.x}
                              y1={last.y}
                              x2={snapped.x}
                              y2={snapped.y}
                              vectorEffect="non-scaling-stroke"
                              stroke="rgba(37,99,235,0.5)"
                              strokeDasharray="2 1.5"
                              strokeWidth={1.5}
                            />
                          );
                        })()
                      : null}
                  </>
                ) : null}
              </svg>
            ) : null}

            {drawingRoomId && containedRect ? (
              <>
                {drawTool === "rectangle" && rectStart ? (
                  <ContourNodeHandle point={rectStart} containedRect={containedRect} />
                ) : null}
                {drawTool === "orthogonal"
                  ? draftPolygon.map((point, index) => (
                      <ContourNodeHandle
                        key={index}
                        point={point}
                        containedRect={containedRect}
                        variant={index === 0 && draftPolygon.length >= 3 ? "closable" : "default"}
                      />
                    ))
                  : null}
              </>
            ) : null}

            <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1">
              {current.isPrimary ? <Badge>Главный</Badge> : null}
              {current.isHidden ? <Badge variant="secondary">Скрыт</Badge> : null}
            </div>

            {onPatch && !drawingRoomId && floorAssets.length > 1 ? (
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

            {onPatch && !drawingRoomId ? (
              <AssetEditToolbar
                asset={current}
                busy={busy}
                floorOptions={floorOptions}
                showFloorSelect
                onPatch={onPatch}
              />
            ) : null}
          </>
        ) : (
          <div className="text-muted-foreground flex aspect-video w-full items-center justify-center text-center text-sm">
            Схема {selectedFloor}-го этажа ещё не загружена
          </div>
        )}
      </div>

      {/* Высоту ряда задаёт медиа 16:9; колонка списка ловит её через stretch,
          а absolute-слой не даёт длинному списку раздувать ряд обратно */}
      <div className="min-w-0 gallery-split:relative gallery-split:min-w-0 gallery-split:flex-1">
      <div className="flex min-w-0 flex-col gap-2 gallery-split:absolute gallery-split:inset-0">
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

        <div className="min-h-0 overflow-y-auto rounded-xl border gallery-split:flex-1">
          {canEditRooms ? (
            <>
              <div
                className={cn(
                  ROOM_ROW_GRID,
                  "text-foreground border-b font-medium"
                )}
              >
                <span aria-hidden />
                <span>Помещение</span>
                <span aria-hidden />
                <span className="text-right">Площадь</span>
              </div>

              {floorRooms.length === 0 ? (
                <div className="text-muted-foreground px-2 py-6 text-center text-sm">
                  Пока нет помещений
                </div>
              ) : (
                <Reorder.Group
                  as="div"
                  axis="y"
                  values={orderedRoomIds}
                  onReorder={setOrderedRoomIds}
                  className="relative"
                >
                  {orderedRoomIds.map((roomId) => {
                    const room = floorRoomsById.get(roomId);
                    if (!room) return null;
                    const roomBusy = roomBusyId === room.id;
                    const isHovered = hoveredRoomId === room.id;
                    return (
                      <ReorderRoomRow
                        key={room.id}
                        room={room}
                        roomBusy={roomBusy}
                        isHighlighted={isHovered}
                        onMouseEnter={() => setHoveredRoomId(room.id)}
                        onMouseLeave={() =>
                          setHoveredRoomId((prev) => (prev === room.id ? null : prev))
                        }
                        {...(onPatchRoom ? { onPatchRoom } : {})}
                        onStartDrawing={startDrawing}
                        {...(onDeleteRoom ? { onDeleteRoom } : {})}
                        onDragStart={() => {
                          isReorderingRef.current = true;
                        }}
                        onDragEnd={handleRoomDragEnd}
                      />
                    );
                  })}
                </Reorder.Group>
              )}
            </>
          ) : (
            <>
              <div className={cn(ROOM_ROW_GRID, "text-foreground border-b font-medium")}>
                <span aria-hidden />
                <span>Помещение</span>
                <span aria-hidden />
                <span className="text-right">Площадь</span>
              </div>
              {floorRooms.length === 0 ? (
                <div className="text-muted-foreground px-2 py-6 text-center text-sm">
                  Пока нет помещений
                </div>
              ) : (
                floorRooms.map((room) => {
                  const isHovered = hoveredRoomId === room.id;
                  return (
                    <div
                      key={room.id}
                      className={cn(
                        ROOM_ROW_GRID,
                        "border-b last:border-b-0",
                        isHovered && "bg-muted/60"
                      )}
                      onMouseEnter={() => setHoveredRoomId(room.id)}
                      onMouseLeave={() =>
                        setHoveredRoomId((prev) => (prev === room.id ? null : prev))
                      }
                    >
                      <span aria-hidden />
                      <div className="min-w-0 whitespace-normal">{room.name}</div>
                      <span aria-hidden />
                      <div className="text-right tabular-nums">{formatArea(room.area)}</div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {onCreateRoom ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => onCreateRoom({ floorNumber: selectedFloor, name: "Новое помещение", area: 1 })}
          >
            <IconPlus className="size-4" />
            Добавить помещение
          </Button>
        ) : null}
      </div>
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

  // Переключение раскладки в две колонки (gallery-split) меняет ширину слайда —
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
      <div className="flex flex-col gap-2 gallery-split:flex-row gallery-split:items-stretch">
        <div className="bg-muted relative overflow-hidden rounded-xl border gallery-split:min-w-0 gallery-split:flex-[2]">
          <div
            ref={scrollerRef}
            onScroll={syncActiveFromScroll}
            className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain gallery-split:snap-none gallery-split:overflow-hidden"
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
            <AssetEditToolbar
              asset={current}
              busy={busy}
              floorOptions={floorOptions}
              showFloorSelect={isPlan}
              onPatch={onPatch}
            />
          ) : null}
        </div>

        {assets.length > 1 ? (
          <div className="relative gallery-split:min-w-0 gallery-split:flex-1">
            <div
              ref={gridRef}
              className={cn(
                "scrollbar-none flex gap-2 overflow-x-auto pb-0.5 gallery-split:absolute gallery-split:inset-0 gallery-split:content-start gallery-split:gap-1.5 gallery-split:overflow-x-hidden gallery-split:overflow-y-auto gallery-split:overscroll-contain gallery-split:pr-0.5 gallery-split:pb-0",
                assets.length > 8
                  ? "gallery-split:grid gallery-split:grid-cols-3"
                  : "gallery-split:grid gallery-split:grid-cols-2"
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
                    "gallery-split:h-auto gallery-split:w-full gallery-split:shrink gallery-split:aspect-video",
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
                <div className="from-background/60 pointer-events-none absolute inset-x-0 top-0 hidden h-4 bg-gradient-to-b to-transparent gallery-split:block" />
                <div className="from-background/60 pointer-events-none absolute inset-x-0 bottom-0 hidden h-4 bg-gradient-to-t to-transparent gallery-split:block" />
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
