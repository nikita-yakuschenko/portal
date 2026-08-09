"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconPhoto, IconPlus, IconSearch, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POPULAR_PROJECTS_MAX, primaryImage, type StorefrontProject } from "@/lib/partner-site-preview";
import { cn } from "@/lib/utils";

/** ease-out — соседние плитки «догоняют» место */
const SLOT_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const CATALOG_PREFIX = "catalog:";
const EMPTY_PREFIX = "empty:";

const dropAnimation: DropAnimation = {
  duration: 220,
  easing: SLOT_EASE,
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } }
  })
};

function catalogDragId(projectId: string) {
  return `${CATALOG_PREFIX}${projectId}`;
}

function parseCatalogId(id: string): string | null {
  return id.startsWith(CATALOG_PREFIX) ? id.slice(CATALOG_PREFIX.length) : null;
}

function parseEmptyIndex(id: string): number | null {
  if (!id.startsWith(EMPTY_PREFIX)) return null;
  const index = Number(id.slice(EMPTY_PREFIX.length));
  return Number.isFinite(index) ? index : null;
}

/** Лицо плитки 16:9: фото на весь кадр, подпись поверх */
function SlotCardFace({
  project,
  index,
  onRemove
}: {
  project: StorefrontProject;
  index: number;
  onRemove?: () => void;
}) {
  const src = primaryImage(project);

  return (
    <div className="relative aspect-video w-full overflow-hidden">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
      ) : (
        <div className="bg-muted text-muted-foreground absolute inset-0 flex items-center justify-center">
          <IconPhoto className="size-5" aria-hidden />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5">
        <p className="truncate text-xs font-medium text-white">{project.name}</p>
        <p className="text-[11px] text-white/75 tabular-nums">
          {project.area ? `${project.area} м²` : "—"}
        </p>
      </div>

      <span className="bg-background/90 absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded text-[11px] font-medium tabular-nums shadow-xs backdrop-blur">
        {index + 1}
      </span>

      {onRemove ? (
        <button
          type="button"
          className="bg-background/90 text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded shadow-xs backdrop-blur transition-colors duration-150"
          aria-label={`Убрать с главной: ${project.name}`}
          onClick={onRemove}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <IconX className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

/** Занятый слот: тащим за всю карточку; принимает дроп из каталога */
function SortableSlot({
  project,
  index,
  onRemove
}: {
  project: StorefrontProject;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: project.id,
      data: { type: "slot", projectId: project.id, index }
    });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? `transform 220ms ${SLOT_EASE}`,
        zIndex: isDragging ? 20 : undefined
      }}
      className={cn(
        "bg-card group/slot relative touch-none overflow-hidden rounded-lg border",
        "cursor-grab active:cursor-grabbing",
        "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        isDragging && "opacity-40 shadow-none",
        isOver && !isDragging && "border-ring ring-ring/40 ring-2"
      )}
      {...attributes}
      {...listeners}
    >
      <SlotCardFace project={project} index={index} onRemove={onRemove} />
    </li>
  );
}

/** Пустой слот 16:9 — цель для дропа из каталога и при перестановке */
function EmptySlot({ index }: { index: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${EMPTY_PREFIX}${index}`,
    data: { type: "empty", index }
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "text-muted-foreground flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed",
        "transition-colors duration-150",
        isOver ? "border-ring bg-accent/60 text-foreground" : "bg-muted/20"
      )}
    >
      <span className="text-xs font-medium tabular-nums">{index + 1}</span>
      <span className="mt-0.5 text-[11px]">свободно</span>
    </li>
  );
}

/**
 * Строка каталога: клик по «+» добавляет, перетаскивание всей строки — в слот.
 * Кнопка «+» останавливает pointerdown, чтобы клик не превращался в drag.
 */
function CatalogRow({
  project,
  disabled,
  onAdd
}: {
  project: StorefrontProject;
  disabled: boolean;
  onAdd: () => void;
}) {
  const src = primaryImage(project);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: catalogDragId(project.id),
    disabled,
    data: { type: "catalog", projectId: project.id }
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "hover:bg-accent/60 flex items-center gap-2 rounded-md px-1.5 py-1.5",
        "transition-colors duration-150",
        isDragging && "bg-accent/40 opacity-40",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none",
          "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "cursor-grab active:cursor-grabbing touch-none"
        )}
        aria-label={`Перетащить на главную: ${project.name}`}
        {...listeners}
        {...attributes}
      >
        <span className="bg-muted relative aspect-video w-14 shrink-0 overflow-hidden rounded">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="size-full object-cover" draggable={false} />
          ) : (
            <span className="text-muted-foreground flex size-full items-center justify-center">
              <IconPhoto className="size-3.5" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{project.name}</span>
          <span className="text-muted-foreground block text-[11px] tabular-nums">
            {project.area ? `${project.area} м²` : "Площадь не указана"}
          </span>
        </span>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={disabled}
        className="text-muted-foreground shrink-0"
        aria-label={`Добавить на главную: ${project.name}`}
        onClick={onAdd}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <IconPlus className="size-3.5" />
      </Button>
    </li>
  );
}

/** Выбор и DnD: слоты слева, каталог справа — тянем и оттуда, и между слотами */
export function PopularProjectsPicker({
  projects,
  selectedIds,
  onChange
}: {
  projects: StorefrontProject[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((project): project is StorefrontProject => Boolean(project)),
    [selectedIds, byId]
  );

  const available = useMemo(() => {
    const rest = projects.filter((project) => !selectedIds.includes(project.id));
    const needle = query.trim().toLowerCase();
    if (!needle) return rest;
    return rest.filter((project) => project.name.toLowerCase().includes(needle));
  }, [projects, selectedIds, query]);

  const activeCatalogId = activeId ? parseCatalogId(activeId) : null;
  const activeProjectId = activeCatalogId ?? activeId;
  const activeProject = activeProjectId ? (byId.get(activeProjectId) ?? null) : null;
  const full = selectedIds.length >= POPULAR_PROJECTS_MAX;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function insertAt(ids: string[], projectId: string, index: number) {
    const next = ids.filter((id) => id !== projectId);
    const at = Math.min(Math.max(index, 0), next.length);
    next.splice(at, 0, projectId);
    return next.slice(0, POPULAR_PROJECTS_MAX);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeKey = String(active.id);
    const overKey = String(over.id);
    if (activeKey === overKey) return;

    const fromCatalog = parseCatalogId(activeKey);
    const emptyIndex = parseEmptyIndex(overKey);

    // Из каталога → в пустой слот или перед занятым
    if (fromCatalog) {
      if (selectedIds.includes(fromCatalog) || selectedIds.length >= POPULAR_PROJECTS_MAX) return;

      if (emptyIndex !== null) {
        onChange(insertAt(selectedIds, fromCatalog, emptyIndex));
        return;
      }

      const overSlot = selectedIds.indexOf(overKey);
      if (overSlot >= 0) {
        onChange(insertAt(selectedIds, fromCatalog, overSlot));
      }
      return;
    }

    // Перестановка между слотами
    const from = selectedIds.indexOf(activeKey);
    if (from < 0) return;

    if (emptyIndex !== null) {
      onChange(insertAt(selectedIds, activeKey, emptyIndex));
      return;
    }

    const to = selectedIds.indexOf(overKey);
    if (to < 0) return;
    onChange(arrayMove(selectedIds, from, to));
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function addProject(id: string) {
    if (selectedIds.includes(id) || selectedIds.length >= POPULAR_PROJECTS_MAX) return;
    onChange([...selectedIds, id]);
  }

  function removeProject(id: string) {
    onChange(selectedIds.filter((item) => item !== id));
  }

  if (projects.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Нет проектов в каталоге. Опубликуйте проекты — и они появятся здесь.
      </p>
    );
  }

  const overlayIndex = activeCatalogId
    ? selectedIds.length
    : Math.max(selectedIds.indexOf(activeProjectId ?? ""), 0);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-0">
        <div className="min-w-0 flex-1 lg:pr-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              На главной{" "}
              <span className="text-muted-foreground font-normal tabular-nums">
                {selected.length}/{POPULAR_PROJECTS_MAX}
              </span>
            </p>
            {selected.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
                Очистить
              </Button>
            ) : null}
          </div>

          <SortableContext
            items={selected.map((project) => project.id)}
            strategy={rectSortingStrategy}
          >
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: POPULAR_PROJECTS_MAX }, (_, index) => {
                const project = selected[index];
                if (project) {
                  return (
                    <SortableSlot
                      key={project.id}
                      project={project}
                      index={index}
                      onRemove={() => removeProject(project.id)}
                    />
                  );
                }
                return <EmptySlot key={`empty-${index}`} index={index} />;
              })}
            </ul>
          </SortableContext>

          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Перетащите из каталога в слот или нажмите «+». Между слотами — тоже перетаскиванием.
            Если ничего не выбрать, на сайте покажутся первые {POPULAR_PROJECTS_MAX} из каталога.
          </p>
        </div>

        <aside className="flex min-h-0 flex-col border-t pt-4 lg:w-56 lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Каталог</p>
            {full ? (
              <span className="text-muted-foreground text-[11px] tabular-nums">6/6</span>
            ) : null}
          </div>

          <div className="relative mb-2">
            <IconSearch
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти"
              aria-label="Поиск проекта в каталоге"
              className="h-8 pl-7 text-xs"
            />
          </div>

          {full ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Все слоты заняты. Уберите проект слева, чтобы добавить другой.
            </p>
          ) : available.length === 0 ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {query.trim() ? "Ничего не нашлось." : "Все проекты уже на главной."}
            </p>
          ) : (
            <ul className="max-h-[22rem] space-y-0.5 overflow-y-auto overscroll-contain pr-0.5 lg:max-h-[26rem]">
              {available.map((project) => (
                <CatalogRow
                  key={project.id}
                  project={project}
                  disabled={full}
                  onAdd={() => addProject(project.id)}
                />
              ))}
            </ul>
          )}
        </aside>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeProject ? (
          <div
            className={cn(
              "bg-card w-48 overflow-hidden rounded-lg border shadow-lg ring-1 ring-black/5",
              activeCatalogId && "rotate-1"
            )}
          >
            <SlotCardFace project={activeProject} index={overlayIndex} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
