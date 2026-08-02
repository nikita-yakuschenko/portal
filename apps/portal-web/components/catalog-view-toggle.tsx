"use client";

import { IconLayoutGrid, IconTable } from "@tabler/icons-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export type CatalogViewMode = "cards" | "table";

const OPTIONS: Array<{
  value: CatalogViewMode;
  label: string;
  icon: typeof IconLayoutGrid;
}> = [
  { value: "cards", label: "Карточки", icon: IconLayoutGrid },
  { value: "table", label: "Таблица", icon: IconTable }
];

export function CatalogViewToggle({
  value,
  onChange,
  className
}: {
  value: CatalogViewMode;
  onChange: (value: CatalogViewMode) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Режим отображения"
      className={cn(
        "bg-muted/80 relative inline-flex shrink-0 rounded-lg p-1 ring-1 ring-black/5 dark:ring-white/10",
        className
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active ? (
              <motion.span
                layoutId="catalog-view-pill"
                className="bg-background absolute inset-0 -z-10 rounded-md shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            ) : null}
            <Icon className="size-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
