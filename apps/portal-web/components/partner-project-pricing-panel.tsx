"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconCheck, IconGripVertical, IconPlus, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Extra = { id: string; name: string; price?: number; note?: string };
type ExtraGroup = { id: string; title: string; items: Extra[] };

type LibraryOption = {
  sectionTitle: string;
  name: string;
  price?: number;
  note?: string;
};

type PickerMode =
  | { kind: "section" }
  | { kind: "option"; preferSectionTitle?: string };

type PricingMode = "markup" | "exact" | "on_request";

type PricingState = {
  pricingMode: PricingMode;
  markupPercent: number | null;
  publicPrice: number | null;
  extras: ExtraGroup[];
};

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function withPrice(extra: Extra, price: number | undefined): Extra {
  const { price: _omit, ...rest } = extra;
  return price === undefined ? rest : { ...rest, price };
}

function coerceGroups(raw: unknown): ExtraGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const isGroup = (item: unknown) =>
    Boolean(item && typeof item === "object" && Array.isArray((item as { items?: unknown }).items));

  if (raw.some(isGroup)) {
    return raw.filter(isGroup).map((item) => {
      const row = item as { id?: string; title?: string; items: Extra[] };
      return {
        id: row.id || newId("group"),
        title: typeof row.title === "string" ? row.title : "",
        items: (row.items ?? []).map((extra) => ({
          id: extra.id || newId("extra"),
          name: extra.name,
          ...(extra.price != null ? { price: extra.price } : {}),
          ...(extra.note ? { note: extra.note } : {})
        }))
      };
    });
  }

  const items = raw
    .filter((item) => item && typeof item === "object" && typeof (item as Extra).name === "string")
    .map((item) => {
      const extra = item as Extra;
      return {
        id: extra.id || newId("extra"),
        name: extra.name,
        ...(extra.price != null ? { price: extra.price } : {}),
        ...(extra.note ? { note: extra.note } : {})
      };
    });
  if (items.length === 0) return [];
  return [{ id: newId("group"), title: "", items }];
}

function ensureUntitledGroup(groups: ExtraGroup[]): ExtraGroup[] {
  if (groups.some((g) => !g.title)) return groups;
  return [{ id: newId("group"), title: "", items: [] }, ...groups];
}

function sectionKey(title: string): string {
  return title.trim().toLowerCase();
}

function optionKey(name: string): string {
  return name.trim().toLowerCase();
}

function sectionLabel(title: string): string {
  return title.trim() ? title.trim() : "Без раздела";
}

function flattenLibraryOptions(library: ExtraGroup[]): LibraryOption[] {
  return library.flatMap((group) =>
    group.items.map((item) => ({
      sectionTitle: group.title,
      name: item.name,
      ...(item.price != null ? { price: item.price } : {}),
      ...(item.note ? { note: item.note } : {})
    }))
  );
}

function librarySectionTitles(library: ExtraGroup[]): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const group of library) {
    const title = group.title.trim();
    if (!title) continue;
    const key = sectionKey(title);
    if (seen.has(key)) continue;
    seen.add(key);
    titles.push(title);
  }
  return titles;
}

/** Вставить опцию из библиотеки: создать раздел по title при необходимости */
function applyLibraryOption(groups: ExtraGroup[], pick: LibraryOption): ExtraGroup[] {
  const title = pick.sectionTitle.trim();
  let next = title ? [...groups] : ensureUntitledGroup(groups);
  let target = next.find((group) => sectionKey(group.title) === sectionKey(title));

  if (!target) {
    target = { id: newId("group"), title, items: [] };
    next = [...next, target];
  }

  const already = target.items.some((item) => optionKey(item.name) === optionKey(pick.name));
  if (already) return next;

  const extra: Extra = {
    id: newId("extra"),
    name: pick.name,
    ...(pick.price != null ? { price: pick.price } : { price: 0 }),
    ...(pick.note ? { note: pick.note } : {})
  };

  return next.map((group) =>
    group.id === target!.id ? { ...group, items: [...group.items, extra] } : group
  );
}

function applyLibrarySection(groups: ExtraGroup[], title: string): ExtraGroup[] {
  const trimmed = title.trim();
  if (!trimmed) return groups;
  if (groups.some((group) => sectionKey(group.title) === sectionKey(trimmed))) return groups;
  return [
    ...groups,
    {
      id: newId("group"),
      title: trimmed,
      items: [{ id: newId("extra"), name: "", price: 0 }]
    }
  ];
}

function LibraryPickerDialog({
  open,
  mode,
  library,
  currentExtras,
  onOpenChange,
  onPickOption,
  onPickSection,
  onCreateNew
}: {
  open: boolean;
  mode: PickerMode | null;
  library: ExtraGroup[];
  currentExtras: ExtraGroup[];
  onOpenChange: (open: boolean) => void;
  onPickOption: (pick: LibraryOption) => void;
  onPickSection: (title: string) => void;
  onCreateNew: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open, mode]);

  const isSection = mode?.kind === "section";
  const preferSection =
    mode?.kind === "option" ? mode.preferSectionTitle?.trim() ?? "" : "";

  const addedOptionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const group of currentExtras) {
      for (const item of group.items) {
        if (!item.name.trim()) continue;
        keys.add(`${sectionKey(group.title)}::${optionKey(item.name)}`);
      }
    }
    return keys;
  }, [currentExtras]);

  const addedSectionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const group of currentExtras) {
      if (!group.title.trim()) continue;
      keys.add(sectionKey(group.title));
    }
    return keys;
  }, [currentExtras]);

  const sectionSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return librarySectionTitles(library).filter((title) =>
      q ? title.toLowerCase().includes(q) : true
    );
  }, [library, query]);

  const optionSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = flattenLibraryOptions(library);
    if (q) {
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          sectionLabel(row.sectionTitle).toLowerCase().includes(q)
      );
    }
    if (preferSection) {
      const preferKey = sectionKey(preferSection);
      rows = [...rows].sort((a, b) => {
        const aMatch = sectionKey(a.sectionTitle) === preferKey ? 0 : 1;
        const bMatch = sectionKey(b.sectionTitle) === preferKey ? 0 : 1;
        return aMatch - bMatch || a.name.localeCompare(b.name, "ru");
      });
    } else {
      rows = [...rows].sort(
        (a, b) =>
          sectionLabel(a.sectionTitle).localeCompare(sectionLabel(b.sectionTitle), "ru") ||
          a.name.localeCompare(b.name, "ru")
      );
    }
    return rows;
  }, [library, query, preferSection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isSection ? "Добавить раздел" : "Добавить опцию"}</DialogTitle>
          <DialogDescription>
            {isSection
              ? "Можно выбрать несколько разделов подряд. Уже добавленные отмечены."
              : "Можно выбрать несколько опций подряд — окно не закроется. Уже добавленные отмечены; раздел подставится сам."}
          </DialogDescription>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isSection ? "Поиск раздела…" : "Поиск опции…"}
          autoFocus
        />

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {isSection ? (
            sectionSuggestions.length === 0 ? (
              <p className="text-muted-foreground px-1 py-3 text-sm">
                Пока нет сохранённых разделов.
              </p>
            ) : (
              sectionSuggestions.map((title) => {
                const added = addedSectionKeys.has(sectionKey(title));
                return (
                  <button
                    key={title}
                    type="button"
                    disabled={added}
                    aria-pressed={added}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                      added
                        ? "bg-muted/40 text-muted-foreground cursor-default"
                        : "hover:bg-accent"
                    )}
                    onClick={() => {
                      if (!added) onPickSection(title);
                    }}
                  >
                    <span className="min-w-0 flex-1 font-medium">{title}</span>
                    {added ? (
                      <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
                        <IconCheck className="size-3.5" />
                        уже есть
                      </span>
                    ) : null}
                  </button>
                );
              })
            )
          ) : optionSuggestions.length === 0 ? (
            <p className="text-muted-foreground px-1 py-3 text-sm">
              Пока нет сохранённых опций.
            </p>
          ) : (
            optionSuggestions.map((row) => {
              const key = `${sectionKey(row.sectionTitle)}::${optionKey(row.name)}`;
              const added = addedOptionKeys.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={added}
                  aria-pressed={added}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm",
                    added
                      ? "bg-muted/40 text-muted-foreground cursor-default"
                      : "hover:bg-accent"
                  )}
                  onClick={() => {
                    if (!added) onPickOption(row);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{row.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {sectionLabel(row.sectionTitle)}
                      {row.price != null
                        ? ` · ${row.price.toLocaleString("ru-RU")} ₽`
                        : ""}
                    </span>
                  </span>
                  {added ? (
                    <span className="text-muted-foreground mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs">
                      <IconCheck className="size-3.5" />
                      уже есть
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <Button type="button" variant="outline" onClick={onCreateNew}>
          <IconPlus />
          {isSection ? "Создать новый раздел" : "Создать новую опцию"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function DragHandle({
  disabled,
  ...props
}: { disabled?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  if (disabled) return null;
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
      aria-label="Перетащить"
      onClick={(event) => event.stopPropagation()}
      {...props}
    >
      <IconGripVertical className="size-4" />
    </button>
  );
}

function SortableExtraRow({
  extra,
  canManage,
  onChange,
  onRemove
}: {
  extra: Extra;
  canManage: boolean;
  onChange: (next: Extra) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: extra.id,
    disabled: !canManage
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-wrap items-center gap-2",
        isDragging && "bg-background relative z-10 rounded-md opacity-90 shadow-sm"
      )}
    >
      <DragHandle disabled={!canManage} {...attributes} {...listeners} />
      <Input
        value={extra.name}
        disabled={!canManage}
        aria-label="Название опции"
        className="min-w-[12rem] flex-1"
        placeholder="Название опции"
        onChange={(e) => onChange({ ...extra, name: e.target.value })}
      />
      <Input
        inputMode="numeric"
        autoComplete="off"
        placeholder="Цена"
        disabled={!canManage}
        aria-label="Цена опции"
        className="w-28 tabular-nums"
        value={extra.price ?? ""}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          onChange(withPrice(extra, raw === "" ? undefined : Number(raw)));
        }}
      />
      {canManage ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Удалить «${extra.name}»`}
          onClick={onRemove}
        >
          <IconTrash />
        </Button>
      ) : null}
    </div>
  );
}

function SortableSectionCard({
  group,
  canManage,
  onTitleChange,
  onAddItem,
  onRemoveGroup,
  onItemsReorder,
  onItemChange,
  onItemRemove
}: {
  group: ExtraGroup;
  canManage: boolean;
  onTitleChange: (title: string) => void;
  onAddItem: () => void;
  onRemoveGroup: () => void;
  onItemsReorder: (items: Extra[]) => void;
  onItemChange: (extra: Extra) => void;
  onItemRemove: (extraId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    disabled: !canManage
  });

  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = group.items.findIndex((item) => item.id === active.id);
    const newIndex = group.items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onItemsReorder(arrayMove(group.items, oldIndex, newIndex));
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "space-y-3 rounded-lg border border-border px-4 py-3",
        isDragging && "bg-background relative z-10 opacity-90 shadow-md"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <DragHandle disabled={!canManage} {...attributes} {...listeners} />
        <Input
          value={group.title}
          disabled={!canManage}
          aria-label="Название раздела"
          className="min-w-[10rem] max-w-sm flex-1 font-medium"
          placeholder="Название раздела"
          onChange={(e) => onTitleChange(e.target.value)}
        />
        {canManage ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={onAddItem}>
              <IconPlus />
              Опция
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Удалить раздел «${group.title}»`}
              onClick={onRemoveGroup}
            >
              <IconTrash />
            </Button>
          </>
        ) : null}
      </div>

      {group.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">В разделе пока нет опций.</p>
      ) : (
        <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={onItemDragEnd}>
          <SortableContext items={group.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {group.items.map((extra) => (
                <SortableExtraRow
                  key={extra.id}
                  extra={extra}
                  canManage={canManage}
                  onChange={onItemChange}
                  onRemove={() => onItemRemove(extra.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

export function PartnerProjectPricingPanel({
  projectId,
  canManage
}: {
  projectId: string;
  canManage: boolean;
}) {
  const [draft, setDraft] = useState<PricingState>({
    pricingMode: "on_request",
    markupPercent: null,
    publicPrice: null,
    extras: []
  });
  const [library, setLibrary] = useState<ExtraGroup[]>([]);
  const [picker, setPicker] = useState<PickerMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function loadLibrary() {
    try {
      const rows = await apiFetch<unknown>("/api/partner/pricing/library");
      setLibrary(coerceGroups(rows));
    } catch {
      // библиотека необязательна для редактирования цены
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const [rows] = await Promise.all([
          apiFetch<
            Array<{
              projectId: string;
              pricingMode: PricingMode;
              markupPercent: number | null;
              publicPrice: number | null;
              extras: unknown;
            }>
          >("/api/partner/pricing"),
          loadLibrary()
        ]);
        const row = rows.find((item) => item.projectId === projectId);
        if (row) {
          setDraft({
            pricingMode: row.pricingMode,
            markupPercent: row.markupPercent,
            publicPrice: row.publicPrice,
            extras: coerceGroups(row.extras)
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/api/partner/pricing", {
        method: "PUT",
        body: JSON.stringify({
          projectId,
          pricingMode: draft.pricingMode,
          markupPercent:
            draft.pricingMode === "markup" && draft.markupPercent != null
              ? Math.round(draft.markupPercent)
              : undefined,
          publicPrice:
            draft.pricingMode === "exact" && draft.publicPrice != null
              ? Math.round(draft.publicPrice)
              : undefined,
          extras: draft.extras
            .map((group) => ({
              id: group.id,
              title: group.title.trim(),
              items: group.items
                .filter((item) => item.name.trim())
                .map((item) =>
                  withPrice(item, item.price != null ? Math.round(item.price) : undefined)
                )
            }))
            .filter((group) => group.title || group.items.length > 0)
        })
      });
      await loadLibrary();
      toast.success("Цена и опции сохранены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить цену");
    } finally {
      setSaving(false);
    }
  }

  function updateGroup(groupId: string, patch: (group: ExtraGroup) => ExtraGroup) {
    setDraft((prev) => ({
      ...prev,
      extras: prev.extras.map((group) => (group.id === groupId ? patch(group) : group))
    }));
  }

  function addBlankUngroupedOption() {
    setDraft((prev) => {
      const groups = ensureUntitledGroup(prev.extras);
      const untitled = groups.find((g) => !g.title)!;
      return {
        ...prev,
        extras: groups.map((group) =>
          group.id === untitled.id
            ? {
                ...group,
                items: [...group.items, { id: newId("extra"), name: "", price: 0 }]
              }
            : group
        )
      };
    });
  }

  function addBlankSection() {
    setDraft((prev) => ({
      ...prev,
      extras: [
        ...prev.extras,
        {
          id: newId("group"),
          title: "Раздел",
          items: [{ id: newId("extra"), name: "", price: 0 }]
        }
      ]
    }));
  }

  function addBlankOptionInSection(groupId: string) {
    updateGroup(groupId, (g) => ({
      ...g,
      items: [...g.items, { id: newId("extra"), name: "", price: 0 }]
    }));
  }

  function onPickLibraryOption(pick: LibraryOption) {
    setDraft((prev) => {
      const existed = prev.extras.some(
        (group) =>
          sectionKey(group.title) === sectionKey(pick.sectionTitle) &&
          group.items.some((item) => optionKey(item.name) === optionKey(pick.name))
      );
      if (existed) return prev;
      return { ...prev, extras: applyLibraryOption(prev.extras, pick) };
    });
  }

  function onPickLibrarySection(title: string) {
    setDraft((prev) => {
      if (prev.extras.some((group) => sectionKey(group.title) === sectionKey(title))) {
        return prev;
      }
      return { ...prev, extras: applyLibrarySection(prev.extras, title) };
    });
  }

  function onCreateNewFromPicker() {
    if (!picker) return;
    if (picker.kind === "section") {
      addBlankSection();
    } else if (picker.preferSectionTitle) {
      const group = draft.extras.find(
        (row) => sectionKey(row.title) === sectionKey(picker.preferSectionTitle ?? "")
      );
      if (group) addBlankOptionInSection(group.id);
      else addBlankUngroupedOption();
    } else {
      addBlankUngroupedOption();
    }
    setPicker(null);
  }

  function onUngroupedDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ungrouped = draft.extras.find((g) => !g.title);
    if (!ungrouped) return;
    const oldIndex = ungrouped.items.findIndex((item) => item.id === active.id);
    const newIndex = ungrouped.items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateGroup(ungrouped.id, (group) => ({
      ...group,
      items: arrayMove(group.items, oldIndex, newIndex)
    }));
  }

  function onSectionsDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sections = draft.extras.filter((g) => g.title);
    const ungrouped = draft.extras.find((g) => !g.title);
    const oldIndex = sections.findIndex((g) => g.id === active.id);
    const newIndex = sections.findIndex((g) => g.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextSections = arrayMove(sections, oldIndex, newIndex);
    setDraft((prev) => ({
      ...prev,
      extras: ungrouped ? [ungrouped, ...nextSections] : nextSections
    }));
  }

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  const ungrouped = draft.extras.find((g) => !g.title);
  const sections = draft.extras.filter((g) => g.title);
  const hasAnyExtras = draft.extras.some((g) => g.items.length > 0 || g.title);

  return (
    <div className="space-y-8">
      <LibraryPickerDialog
        open={picker != null}
        mode={picker}
        library={library}
        currentExtras={draft.extras}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
        onPickOption={onPickLibraryOption}
        onPickSection={onPickLibrarySection}
        onCreateNew={onCreateNewFromPicker}
      />

      <section className="space-y-4">
        <h3 className="text-base font-semibold tracking-tight">Цена</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex w-fit flex-col gap-1.5">
            <FieldLabel htmlFor="pricing-mode">Режим цены</FieldLabel>
            <Select
              value={draft.pricingMode}
              disabled={!canManage}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, pricingMode: value as PricingMode }))
              }
            >
              <SelectTrigger id="pricing-mode" className="w-[13rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markup">Наценка % от завода</SelectItem>
                <SelectItem value="exact">Точная цена</SelectItem>
                <SelectItem value="on_request">По запросу</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {draft.pricingMode === "markup" ? (
            <div className="flex w-fit flex-col gap-1.5">
              <FieldLabel htmlFor="pricing-markup">Наценка, %</FieldLabel>
              <Input
                id="pricing-markup"
                inputMode="numeric"
                autoComplete="off"
                maxLength={3}
                disabled={!canManage}
                className="w-16 tabular-nums"
                value={draft.markupPercent ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 3);
                  setDraft((prev) => ({
                    ...prev,
                    markupPercent: raw === "" ? null : Number(raw)
                  }));
                }}
              />
            </div>
          ) : null}

          {draft.pricingMode === "exact" ? (
            <div className="flex w-fit flex-col gap-1.5">
              <FieldLabel htmlFor="pricing-public">Ваша цена, ₽</FieldLabel>
              <Input
                id="pricing-public"
                inputMode="numeric"
                autoComplete="off"
                disabled={!canManage}
                className="w-40 tabular-nums"
                value={draft.publicPrice ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setDraft((prev) => ({
                    ...prev,
                    publicPrice: raw === "" ? null : Number(raw)
                  }));
                }}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight">
            Дополнительные опции для покупателей
          </h3>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPicker({ kind: "section" })}
              >
                <IconPlus />
                Добавить раздел
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPicker({ kind: "option" })}
              >
                <IconPlus />
                Добавить опцию
              </Button>
            </div>
          ) : null}
        </div>

        {!hasAnyExtras ? (
          <p className="text-muted-foreground text-sm">
            Пока без опций. Можно добавить отдельную опцию или раздел (например «Фундамент»).
          </p>
        ) : (
          <div className="space-y-5">
            {ungrouped && ungrouped.items.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onUngroupedDragEnd}
              >
                <SortableContext
                  items={ungrouped.items.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {ungrouped.items.map((extra) => (
                      <SortableExtraRow
                        key={extra.id}
                        extra={extra}
                        canManage={canManage}
                        onChange={(next) =>
                          updateGroup(ungrouped.id, (group) => ({
                            ...group,
                            items: group.items.map((item) => (item.id === extra.id ? next : item))
                          }))
                        }
                        onRemove={() =>
                          updateGroup(ungrouped.id, (group) => ({
                            ...group,
                            items: group.items.filter((item) => item.id !== extra.id)
                          }))
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : null}

            {sections.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onSectionsDragEnd}
              >
                <SortableContext
                  items={sections.map((group) => group.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-5">
                    {sections.map((group) => (
                      <SortableSectionCard
                        key={group.id}
                        group={group}
                        canManage={canManage}
                        onTitleChange={(title) => updateGroup(group.id, (g) => ({ ...g, title }))}
                        onAddItem={() =>
                          setPicker({ kind: "option", preferSectionTitle: group.title })
                        }
                        onRemoveGroup={() =>
                          setDraft((prev) => ({
                            ...prev,
                            extras: prev.extras.filter((g) => g.id !== group.id)
                          }))
                        }
                        onItemsReorder={(items) => updateGroup(group.id, (g) => ({ ...g, items }))}
                        onItemChange={(next) =>
                          updateGroup(group.id, (g) => ({
                            ...g,
                            items: g.items.map((item) => (item.id === next.id ? next : item))
                          }))
                        }
                        onItemRemove={(extraId) =>
                          updateGroup(group.id, (g) => ({
                            ...g,
                            items: g.items.filter((item) => item.id !== extraId)
                          }))
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : null}
          </div>
        )}
      </section>

      {canManage ? (
        <Button type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? <Spinner /> : null}
          {saving ? "Сохраняем…" : "Сохранить"}
        </Button>
      ) : (
        <p className="text-muted-foreground text-sm">
          Изменять цены может только владелец кабинета.
        </p>
      )}
    </div>
  );
}
