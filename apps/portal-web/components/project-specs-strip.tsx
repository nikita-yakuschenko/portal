import type { ComponentType } from "react";
import {
  IconBath,
  IconBed,
  IconDimensions,
  IconRulerMeasure,
  IconStairs
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type SpecIcon = ComponentType<{ className?: string; stroke?: number }>;

export type ProjectSpecsStripProps = {
  area?: number | null;
  dimensionsLabel?: string | null | undefined;
  floors?: number | null;
  bedrooms?: number | null;
  bathrooms?: string | null;
  className?: string;
};

/** Компактные факты под названием — на десктопе крупнее, чтобы заполнять шапку */
export function ProjectSpecsStrip({
  area,
  dimensionsLabel,
  floors,
  bedrooms,
  bathrooms,
  className
}: ProjectSpecsStripProps) {
  const rows: Array<{ icon: SpecIcon; label: string; value: string }> = [];

  if (area) {
    rows.push({ icon: IconRulerMeasure, label: "Площадь", value: `${area} м²` });
  }
  if (dimensionsLabel?.trim()) {
    rows.push({
      icon: IconDimensions,
      label: "Габариты",
      value: dimensionsLabel.trim()
    });
  }
  if (floors) {
    rows.push({ icon: IconStairs, label: "Этажи", value: String(floors) });
  }
  if (bedrooms) {
    rows.push({ icon: IconBed, label: "Спальни", value: String(bedrooms) });
  }
  if (bathrooms?.trim()) {
    rows.push({ icon: IconBath, label: "Санузлы", value: bathrooms.trim() });
  }

  if (rows.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-x-0 gap-y-3", className)}>
      {rows.map((row, index) => {
        const Icon = row.icon;
        return (
          <li
            key={row.label}
            className={cn(
              "min-w-0 px-3 first:pl-0 sm:px-4 sm:first:pl-0",
              index > 0 && "border-border border-l"
            )}
          >
            <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase sm:text-xs">
              <Icon className="text-primary size-3.5 shrink-0 sm:size-4" stroke={1.75} />
              <span>{row.label}</span>
            </div>
            <p className="mt-1 text-base font-semibold tabular-nums leading-none sm:text-lg">
              {row.value}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
