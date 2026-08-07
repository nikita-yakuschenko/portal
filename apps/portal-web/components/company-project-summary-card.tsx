"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";

import { CompanyProjectCatalogVisibility } from "@/components/company-project-catalog-visibility";
import { InlineEditPopover } from "@/components/inline-edit-popover";
import {
  ProjectSpecsStrip,
  type SpecKey
} from "@/components/project-specs-strip";
import { ProjectSummaryCard } from "@/components/project-summary-card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import {
  TECHNOLOGY_LABELS,
  technologyBadgeCode,
  technologyBadgeVariant
} from "@/lib/catalog-display";

type SyncOverrides = Partial<
  Record<
    | "name"
    | "description"
    | "technology"
    | "area"
    | "floors"
    | "bedrooms"
    | "bathrooms"
    | "basePrice"
    | "active",
    boolean
  >
>;

export type CompanySummaryProject = {
  id: string;
  name: string;
  technology: "modular" | "panel_frame";
  area: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: string | null;
  basePrice: number | null;
  details?: {
    dimensions?: { label?: string } | null;
  } | null;
  projectUrl: string;
  active: boolean;
  syncOverrides?: SyncOverrides;
};

function SyncDot({ on }: { on?: boolean | undefined }) {
  if (!on) return null;
  return (
    <span
      className="bg-amber-500/90 size-1.5 shrink-0 rounded-full"
      title="Защищено от синхронизации Tilda"
    />
  );
}

/**
 * Плашка = разметка партнёра (тот же Card / ProjectSpecsStrip).
 * Отличия: HQ-публикация; нет «вашей цены»; editMode — клик-правка без сдвига layout.
 */
export function CompanyProjectSummaryCard({
  project,
  onUpdated,
  editMode
}: {
  project: CompanySummaryProject;
  onUpdated: (next: CompanySummaryProject) => void;
  editMode: boolean;
}) {
  const overrides = project.syncOverrides ?? {};

  async function patch(body: Record<string, unknown>) {
    try {
      const updated = await apiFetch<CompanySummaryProject>(
        `/api/company/catalog/projects/${project.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body)
        }
      );
      onUpdated(updated);
      toast.success("Сохранено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
      throw err;
    }
  }

  const priceLabel =
    project.basePrice != null
      ? `от ${project.basePrice.toLocaleString("ru-RU")}`
      : "Цена по запросу";

  const nameNode = (
    <h2 className="inline-flex items-center gap-1.5 text-xl font-semibold tracking-tight">
      {project.name}
      <SyncDot on={overrides.name} />
    </h2>
  );

  const technologyNode = (
    <span className="inline-flex items-center gap-1">
      <Badge variant={technologyBadgeVariant(project.technology)}>
        {technologyBadgeCode(project.technology)}
      </Badge>
      <SyncDot on={overrides.technology} />
    </span>
  );

  const priceNode = <p className="text-lg font-semibold tabular-nums">{priceLabel}</p>;

  function renderSpecValue(key: SpecKey, valueNode: ReactNode) {
    if (key === "dimensions") return valueNode;

    const field: Record<
      Exclude<SpecKey, "dimensions">,
      { value: string; inputType: "text" | "number"; body: (v: string) => Record<string, unknown> }
    > = {
      area: {
        value: project.area != null ? String(project.area) : "",
        inputType: "number",
        body: (v) => ({ area: v ? Number(v) : null })
      },
      floors: {
        value: project.floors != null ? String(project.floors) : "",
        inputType: "number",
        body: (v) => ({ floors: v ? Number(v) : null })
      },
      bedrooms: {
        value: project.bedrooms != null ? String(project.bedrooms) : "",
        inputType: "number",
        body: (v) => ({ bedrooms: v ? Number(v) : null })
      },
      bathrooms: {
        value: project.bathrooms ?? "",
        inputType: "text",
        body: (v) => ({ bathrooms: v || null })
      }
    };

    const cfg = field[key];
    return (
      <InlineEditPopover
        enabled={editMode}
        ariaLabel={key}
        value={cfg.value}
        inputType={cfg.inputType}
        compact
        onCommit={(next) => patch(cfg.body(next))}
        display={valueNode}
      />
    );
  }

  return (
    <ProjectSummaryCard
      title={
        <InlineEditPopover
          enabled={editMode}
          ariaLabel="Название"
          value={project.name}
          onCommit={(next) => patch({ name: next })}
          display={nameNode}
        />
      }
      badge={
        <InlineEditPopover
          enabled={editMode}
          ariaLabel="Технология"
          value={project.technology}
          options={[
            { value: "modular", label: TECHNOLOGY_LABELS.modular },
            { value: "panel_frame", label: TECHNOLOGY_LABELS.panel_frame }
          ]}
          onCommit={(next) => patch({ technology: next })}
          display={technologyNode}
        />
      }
      visibility={
        <CompanyProjectCatalogVisibility
          projectId={project.id}
          active={project.active}
          onUpdated={(updated) => {
            onUpdated({
              ...project,
              active: Boolean(updated.active),
              syncOverrides: {
                ...project.syncOverrides,
                ...(updated.syncOverrides as SyncOverrides | undefined)
              }
            });
          }}
        />
      }
      specs={
        <ProjectSpecsStrip
          className="mt-auto"
          area={project.area}
          dimensionsLabel={project.details?.dimensions?.label}
          floors={project.floors}
          bedrooms={project.bedrooms}
          bathrooms={project.bathrooms}
          showEmpty
          renderValue={renderSpecValue}
        />
      }
      prices={
        <>
          <p className="text-muted-foreground inline-flex items-center justify-end gap-1.5 text-xs">
            Базовая стоимость
            <SyncDot on={overrides.basePrice} />
          </p>
          <InlineEditPopover
            enabled={editMode}
            align="end"
            ariaLabel="Базовая стоимость"
            value={project.basePrice != null ? String(project.basePrice) : ""}
            inputType="number"
            placeholder="По запросу"
            onCommit={(next) => patch({ basePrice: next ? Number(next) : null })}
            display={priceNode}
          />
        </>
      }
    />
  );
}
