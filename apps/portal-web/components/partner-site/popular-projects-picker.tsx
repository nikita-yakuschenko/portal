"use client";

import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGripVertical, IconPlus, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  POPULAR_PROJECTS_MAX,
  primaryImage,
  type StorefrontProject
} from "@/lib/partner-site-preview";
import { cn } from "@/lib/utils";

function SortablePopularRow({
  project,
  index,
  onRemove
}: {
  project: StorefrontProject;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id
  });
  const thumb = primaryImage(project);

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-background px-2 py-2",
        isDragging && "z-10 opacity-90 shadow-md"
      )}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
        aria-label="Перетащить"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical className="size-4" />
      </button>
      <span className="text-muted-foreground w-5 shrink-0 text-center text-xs tabular-nums">
        {index + 1}
      </span>
      <div className="bg-muted size-12 shrink-0 overflow-hidden rounded-md">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{project.name}</p>
        <p className="text-muted-foreground text-xs">
          {project.area ? `${project.area} м²` : "Площадь не указана"}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive shrink-0"
        aria-label="Убрать из популярных"
        onClick={onRemove}
      >
        <IconX className="size-4" />
      </Button>
    </li>
  );
}

/** Выбор и DnD-порядок до 6 проектов для блока «Популярные» */
export function PopularProjectsPicker({
  projects,
  selectedIds,
  onChange
}: {
  projects: StorefrontProject[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const byId = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((project): project is StorefrontProject => Boolean(project)),
    [selectedIds, byId]
  );

  const available = useMemo(
    () => projects.filter((project) => !selectedIds.includes(project.id)),
    [projects, selectedIds]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selectedIds.indexOf(String(active.id));
    const newIndex = selectedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(selectedIds, oldIndex, newIndex));
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

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            На главной{" "}
            <span className="text-muted-foreground font-normal">
              ({selected.length}/{POPULAR_PROJECTS_MAX})
            </span>
          </p>
          {selectedIds.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
              Очистить
            </Button>
          ) : null}
        </div>

        {selected.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-sm">
            Ничего не выбрано — на сайте покажутся первые {POPULAR_PROJECTS_MAX} проектов из
            каталога. Перетаскивайте выбранные, чтобы задать свой порядок.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selected.map((project) => project.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {selected.map((project, index) => (
                  <SortablePopularRow
                    key={project.id}
                    project={project}
                    index={index}
                    onRemove={() => removeProject(project.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Добавить из каталога</p>
        {selectedIds.length >= POPULAR_PROJECTS_MAX ? (
          <p className="text-muted-foreground text-sm">
            Уже выбрано {POPULAR_PROJECTS_MAX}. Уберите проект, чтобы добавить другой.
          </p>
        ) : available.length === 0 ? (
          <p className="text-muted-foreground text-sm">Все проекты уже в блоке.</p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
            {available.map((project) => {
              const thumb = primaryImage(project);
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    className="hover:bg-muted/70 flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition"
                    onClick={() => addProject(project.id)}
                  >
                    <div className="bg-muted size-10 shrink-0 overflow-hidden rounded-md">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="size-full object-cover" />
                      ) : null}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm">{project.name}</span>
                    <IconPlus className="text-muted-foreground size-4 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
