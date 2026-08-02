"use client";

import type { ReactNode } from "react";
import { IconChevronDown, IconX } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

/** Фиксированная ширина правого слота (шеврон / сброс) — размер плашки не прыгает */
export const FILTER_TRAILING_CLASS = "w-9";

/** Общая оболочка фильтра */
export function FilterControlShell({
  children,
  className,
  active = false
}: {
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-9 min-w-0 items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white",
        active && "bg-secondary/40",
        className
      )}
    >
      {children}
    </div>
  );
}

type FilterTrailingMode = "chevron" | "clear" | "empty";

/**
 * Правый слот фиксированной ширины:
 * chevron — как у Select в покое
 * clear — сброс (та же ширина, что у шеврона)
 * empty — пустое место (чтобы ширина не менялась)
 */
export function FilterTrailingSlot({
  mode,
  onClear,
  label,
  className
}: {
  mode: FilterTrailingMode;
  onClear?: () => void;
  label?: string;
  className?: string;
}) {
  if (mode === "clear") {
    return (
      <button
        type="button"
        aria-label={label || "Сбросить"}
        className={cn(
          FILTER_TRAILING_CLASS,
          "inline-flex shrink-0 items-center justify-center border-l border-slate-200 bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-600",
          className
        )}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClear?.();
        }}
      >
        <IconX className="size-3.5 stroke-[2.25]" />
      </button>
    );
  }

  if (mode === "chevron") {
    return (
      <span
        className={cn(
          FILTER_TRAILING_CLASS,
          "text-muted-foreground pointer-events-none inline-flex shrink-0 items-center justify-center",
          className
        )}
        aria-hidden
      >
        <IconChevronDown className="size-4 opacity-50" />
      </span>
    );
  }

  return (
    <span className={cn(FILTER_TRAILING_CLASS, "shrink-0", className)} aria-hidden />
  );
}
