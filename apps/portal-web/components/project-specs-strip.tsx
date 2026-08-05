import type { ComponentType, ReactNode } from "react";
import {
  IconBath,
  IconBed,
  IconDimensions,
  IconRulerMeasure,
  IconStairs
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type SpecIcon = ComponentType<{ className?: string; stroke?: number }>;

export type SpecKey = "area" | "dimensions" | "floors" | "bedrooms" | "bathrooms";

export type ProjectSpecsStripProps = {
  area?: number | null;
  dimensionsLabel?: string | null | undefined;
  floors?: number | null;
  bedrooms?: number | null;
  bathrooms?: string | null;
  className?: string;
  /** Только HQ edit: пустые ячейки как «—» */
  showEmpty?: boolean;
  /** Только HQ edit: обернуть значение */
  renderValue?: (key: SpecKey, valueNode: ReactNode) => ReactNode;
};

/** Компактные факты под названием — разметка и порядок партнёра */
export function ProjectSpecsStrip({
  area,
  dimensionsLabel,
  floors,
  bedrooms,
  bathrooms,
  className,
  showEmpty = false,
  renderValue
}: ProjectSpecsStripProps) {
  const rows: Array<{ key: SpecKey; icon: SpecIcon; label: string; value: string }> = [];

  // Порядок партнёра: площадь → габариты → этажи → спальни → санузлы
  if (area) {
    rows.push({ key: "area", icon: IconRulerMeasure, label: "Площадь", value: `${area} м²` });
  } else if (showEmpty) {
    rows.push({ key: "area", icon: IconRulerMeasure, label: "Площадь", value: "—" });
  }

  if (dimensionsLabel?.trim()) {
    rows.push({
      key: "dimensions",
      icon: IconDimensions,
      label: "Габариты",
      value: dimensionsLabel.trim()
    });
  } else if (showEmpty) {
    rows.push({ key: "dimensions", icon: IconDimensions, label: "Габариты", value: "—" });
  }

  if (floors) {
    rows.push({ key: "floors", icon: IconStairs, label: "Этажи", value: String(floors) });
  } else if (showEmpty) {
    rows.push({ key: "floors", icon: IconStairs, label: "Этажи", value: "—" });
  }

  if (bedrooms) {
    rows.push({ key: "bedrooms", icon: IconBed, label: "Спальни", value: String(bedrooms) });
  } else if (showEmpty) {
    rows.push({ key: "bedrooms", icon: IconBed, label: "Спальни", value: "—" });
  }

  if (bathrooms?.trim()) {
    rows.push({
      key: "bathrooms",
      icon: IconBath,
      label: "Санузлы",
      value: bathrooms.trim()
    });
  } else if (showEmpty) {
    rows.push({ key: "bathrooms", icon: IconBath, label: "Санузлы", value: "—" });
  }

  if (rows.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap gap-x-0 gap-y-3", className)}>
      {rows.map((row, index) => {
        const Icon = row.icon;
        const valueNode = (
          <p className="mt-1 text-base font-semibold tabular-nums leading-none sm:text-lg">
            {row.value}
          </p>
        );
        return (
          <li
            key={row.key}
            className={cn(
              "min-w-0 px-3 first:pl-0 sm:px-4 sm:first:pl-0",
              index > 0 && "border-border border-l"
            )}
          >
            <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase sm:text-xs">
              <Icon className="text-primary size-3.5 shrink-0 sm:size-4" stroke={1.75} />
              <span>{row.label}</span>
            </div>
            {renderValue ? renderValue(row.key, valueNode) : valueNode}
          </li>
        );
      })}
    </ul>
  );
}
