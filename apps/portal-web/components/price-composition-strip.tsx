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

/** Ширина колонки под «99 999 999» в tabular-nums */
const PRICE_COL = "w-[9.5rem] min-w-[9.5rem]";

/**
 * Состав «цены от»: домокомплект + заводская комплектация + наценка.
 * Опции дилера сюда не входят — клиент выбирает их отдельно.
 * Колонки фиксированной ширины — без прыжков при смене цифр/режима.
 */
export function PriceCompositionStrip({
  cells,
  actions,
  className
}: PriceCompositionStripProps) {
  return (
    <ul className={cn("flex w-full flex-wrap items-start gap-x-0 gap-y-3", className)}>
      {cells.map((row, index) => (
        <li
          key={row.label}
          className={cn(
            PRICE_COL,
            "px-3 first:pl-0 sm:px-4 sm:first:pl-0",
            index > 0 && "border-border border-l",
            row.inactive && "opacity-40"
          )}
        >
          <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase sm:text-xs">
            {row.label}
          </p>
          <p
            className={cn(
              "mt-1 flex h-8 items-center text-base font-semibold tabular-nums leading-none sm:text-lg",
              row.emphasize && !row.inactive && "text-primary"
            )}
          >
            {row.value}
          </p>
        </li>
      ))}

      {actions ? (
        <li className="border-border ml-auto min-w-0 border-l px-3 sm:px-4 sm:pr-0">
          <p className="text-muted-foreground text-right text-[11px] font-medium tracking-wide uppercase sm:text-xs">
            Способ формирования цены
          </p>
          <div className="mt-1 flex h-8 items-center justify-end gap-2">{actions}</div>
        </li>
      ) : null}
    </ul>
  );
}

export function formatPriceCell(amount: number | null | undefined, empty = "—"): string {
  if (amount == null) return empty;
  return formatRub(amount);
}
