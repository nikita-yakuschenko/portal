"use client";

import { FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Макс. ширина поля внутри общей колонки контролов (18rem).
 * Укорачивает поле вправо — левый край у всех строк один.
 */
const CONTROL_MAX = {
  xs: "md:max-w-28",
  sm: "md:max-w-40",
  md: "md:max-w-56",
  lg: "md:max-w-none",
  xl: "md:max-w-none",
  full: "md:max-w-none"
} as const;

export type SettingRowProps = {
  label: string;
  /** id контрола — метка кликабельна и ведёт в поле */
  htmlFor?: string;
  description?: React.ReactNode;
  error?: string | undefined;
  width?: keyof typeof CONTROL_MAX;
  /** Слева от подписи: иконка площадки, статус и т.п. */
  leading?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Строка настройки: подпись слева, контрол справа в фиксированной колонке.
 * Разные width не ломают вертикаль — укорачивают поле, не сдвигают.
 */
export function SettingRow({
  label,
  htmlFor,
  description,
  error,
  width = "lg",
  leading,
  children
}: SettingRowProps) {
  return (
    <div
      data-invalid={Boolean(error)}
      className="group/row grid gap-2 py-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-8"
    >
      <div className="flex min-w-0 items-start gap-3 md:pt-1.5">
        {leading}
        <div className="min-w-0">
          <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
          {description ? <FieldDescription className="mt-1">{description}</FieldDescription> : null}
        </div>
      </div>
      <div className={cn("flex min-w-0 flex-col gap-1.5", CONTROL_MAX[width])}>
        {children}
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}

/**
 * Контейнер строк: разделители вместо рамки вокруг каждого поля.
 * Края гасим — вертикальные отступы карточки уже держат ритм.
 */
export function SettingRows({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("divide-y [&>*:first-child]:pt-0 [&>*:last-child]:pb-0", className)}
      {...props}
    />
  );
}
