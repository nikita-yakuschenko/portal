import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { formatRub } from "@/lib/partner-pricing";

export type PriceCompositionCell = {
  label: string;
  value: string;
  emphasize?: boolean;
  /** Неактуально для текущего режима — на месте, но приглушено */
  inactive?: boolean;
};

export type PriceCompositionStripProps = {
  cells: PriceCompositionCell[];
  /** Контролы справа в той же сетке строк (подпись → значение) */
  actions?: ReactNode;
  className?: string;
};

/**
 * Состав «цены от»: домокомплект + заводская комплектация + наценка.
 * Колонки равные (1fr). Одна строка — при узком окне сайдбар сам сворачивается.
 */
export function PriceCompositionStrip({
  cells,
  actions,
  className
}: PriceCompositionStripProps) {
  return (
    <ul
      className={cn(
        "grid w-full items-stretch gap-x-0",
        actions
          ? "grid-cols-[repeat(4,minmax(0,1fr))_auto]"
          : "grid-cols-4",
        className
      )}
    >
      {cells.map((row, index) => (
        <li
          key={row.label}
          className={cn(
            "flex min-w-0 flex-col justify-center px-2 first:pl-0 min-[1360px]:px-3 min-[1600px]:px-4",
            index > 0 && "border-border border-l",
            row.inactive && "opacity-40"
          )}
        >
          <p className="text-muted-foreground truncate text-[10px] font-medium tracking-wide uppercase min-[1360px]:text-xs">
            {row.label}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate text-sm font-semibold tabular-nums leading-none min-[1360px]:mt-1 min-[1360px]:text-base min-[1600px]:text-lg",
              row.emphasize && !row.inactive && "text-primary"
            )}
          >
            {row.value}
          </p>
        </li>
      ))}

      {actions ? (
        <li className="border-border flex shrink-0 flex-col justify-center border-l pl-2 min-[1360px]:pl-3 min-[1600px]:pl-4">
          <p className="text-muted-foreground whitespace-nowrap text-right text-[10px] font-medium tracking-wide uppercase min-[1360px]:text-xs">
            <span className="min-[1360px]:hidden">Режим цены</span>
            <span className="hidden min-[1360px]:inline">Способ формирования цены</span>
          </p>
          <div className="mt-0.5 flex items-center justify-end gap-1 min-[1360px]:mt-1 min-[1360px]:gap-1.5 min-[1600px]:gap-2">
            {actions}
          </div>
        </li>
      ) : null}
    </ul>
  );
}

export function formatPriceCell(amount: number | null | undefined, empty = "—"): string {
  if (amount == null) return empty;
  return formatRub(amount);
}
