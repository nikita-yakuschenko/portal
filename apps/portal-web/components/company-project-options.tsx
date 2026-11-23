"use client";

import { useState } from "react";
import type { CatalogProjectDetails } from "@b2b/domain";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type Groups = CatalogProjectDetails["optionGroups"];

export function CompanyProjectOptions({ projectId, groups, onSaved }: {
  projectId: string;
  groups: Groups;
  onSaved: (groups: Groups) => void;
}) {
  const [draft, setDraft] = useState<Groups | null>(null);
  const [saving, setSaving] = useState(false);
  const visible = draft ?? groups;

  function changeGroup(index: number, change: (group: Groups[number]) => Groups[number]) {
    setDraft((current) => (current ?? groups).map((group, i) => i === index ? change(group) : group));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await apiFetch<Groups>(`/api/company/catalog/projects/${projectId}/option-groups`, {
        method: "PUT",
        body: JSON.stringify(draft)
      });
      onSaved(saved);
      setDraft(null);
      toast.success("Опции проекта сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить опции проекта");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={save}>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">У проекта пока нет собственных опций.</p>
      ) : null}
      {visible.map((group, index) => (
        <fieldset key={group.id} disabled={saving} className="min-w-0 rounded-lg border p-4">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor={`option-group-${group.id}`}>Название раздела</FieldLabel>
              <Input id={`option-group-${group.id}`} required maxLength={200} value={group.title}
                onChange={(event) => changeGroup(index, (current) => ({ ...current, title: event.target.value }))} />
            </Field>
            {group.items.map((item, itemIndex) => {
              const inputId = `option-${group.id}-${item.id}`;
              function update(patch: Partial<typeof item>) {
                changeGroup(index, (current) => ({
                  ...current,
                  items: current.items.map((entry, i) => i === itemIndex ? { ...entry, ...patch } : entry)
                }));
              }
              return (
                <div key={item.id} className="grid min-w-0 gap-3 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
                  <Field>
                    <FieldLabel htmlFor={inputId}>Название опции</FieldLabel>
                    <Input id={inputId} value={item.name} required maxLength={240}
                      onChange={(event) => update({ name: event.target.value })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${inputId}-price`}>Цена, ₽</FieldLabel>
                    <Input id={`${inputId}-price`} type="number" min={0} max={1_000_000_000} step={1}
                      value={item.price ?? ""} onChange={(event) => update({ price: event.target.value ? event.target.valueAsNumber : undefined })} />
                  </Field>
                  <Button type="button" variant="ghost" onClick={() => changeGroup(index, (current) => ({
                    ...current, items: current.items.filter((_, i) => i !== itemIndex)
                  }))}>Удалить опцию</Button>
                  {item.note ? <p className="text-sm text-muted-foreground sm:col-span-3">{item.note}</p> : null}
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={group.items.length >= 100}
                onClick={() => changeGroup(index, (current) => ({
                  ...current, items: [...current.items, { id: crypto.randomUUID(), name: "" }]
                }))}>Добавить опцию</Button>
              <Button type="button" variant="ghost"
                onClick={() => setDraft((current) => (current ?? groups).filter((_, i) => i !== index))}>Удалить раздел</Button>
            </div>
          </FieldGroup>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={saving || visible.length >= 50}
          onClick={() => setDraft((current) => [...(current ?? groups), { id: crypto.randomUUID(), title: "", items: [] }])}>
          Добавить раздел
        </Button>
        {draft ? (
          <>
            <Button type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setDraft(null)}>Отменить изменения</Button>
          </>
        ) : null}
      </div>
    </form>
  );
}
