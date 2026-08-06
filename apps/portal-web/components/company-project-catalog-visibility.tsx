"use client";

import { useState } from "react";
import { IconCircleCheck, IconEyeCheck, IconEyeOff } from "@tabler/icons-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";

type ProjectActivePatch = {
  active: boolean;
  syncOverrides?: Partial<Record<"active", boolean>>;
};

/** Публикация в каталоге HQ — тот же принцип, что у партнёра: бейдж + ссылка, фиксированная min-ширина */
export function CompanyProjectCatalogVisibility({
  projectId,
  active,
  onUpdated
}: {
  projectId: string;
  active: boolean;
  onUpdated: (next: ProjectActivePatch & Record<string, unknown>) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle(nextActive: boolean) {
    setSaving(true);
    try {
      const updated = await apiFetch<ProjectActivePatch & Record<string, unknown>>(
        `/api/company/catalog/projects/${projectId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: nextActive })
        }
      );
      onUpdated(updated);
      toast.success(
        nextActive ? "Проект опубликован в каталоге" : "Проект скрыт из каталога"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить публикацию");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
      <Badge
        variant={active ? "default" : "warning"}
        className="min-w-[12.5rem] justify-center"
      >
        {active ? <IconCircleCheck /> : <IconEyeOff />}
        {active ? "Опубликован в каталоге" : "Скрыт из каталога"}
      </Badge>

      <Button
        type="button"
        variant="link"
        size="sm"
        disabled={saving}
          className="text-muted-foreground hover:text-foreground h-auto min-w-[10.5rem] justify-center gap-1.5 px-0"
        onClick={() => void toggle(!active)}
      >
        {saving ? (
          <Spinner className="size-3.5" />
        ) : active ? (
          <IconEyeOff className="size-3.5" />
        ) : (
          <IconEyeCheck className="size-3.5" />
        )}
        {active ? "Снять с публикации" : "Опубликовать"}
      </Button>
    </span>
  );
}
