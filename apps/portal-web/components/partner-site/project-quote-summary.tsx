"use client";

import {
  IconBath,
  IconBed,
  IconRulerMeasure,
  IconStairs
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { formatRub } from "@/lib/partner-pricing";
import { cn } from "@/lib/utils";

export type ProjectQuoteSpec = {
  area?: number | null | undefined;
  floors?: number | null | undefined;
  bedrooms?: number | null | undefined;
  bathrooms?: string | null | undefined;
};

type ProjectQuoteSummaryProps = {
  title: string;
  mark?: string;
  specs: ProjectQuoteSpec;
  basePrice: number | null;
  priceOnRequest?: boolean;
  onRequestQuote: () => void;
  className?: string;
};

/** Резюме проекта без опций — тот же каркас, что у конфигуратора, с CTA на расчёт */
export function ProjectQuoteSummary({
  title,
  mark = "",
  specs,
  basePrice,
  priceOnRequest = false,
  onRequestQuote,
  className
}: ProjectQuoteSummaryProps) {
  const rows: Array<{ icon: typeof IconRulerMeasure; label: string; value: string }> = [];
  if (specs.area) {
    rows.push({ icon: IconRulerMeasure, label: "Площадь", value: `${specs.area} м²` });
  }
  if (specs.floors) {
    rows.push({ icon: IconStairs, label: "Этажи", value: String(specs.floors) });
  }
  if (specs.bedrooms) {
    rows.push({ icon: IconBed, label: "Спальни", value: String(specs.bedrooms) });
  }
  if (specs.bathrooms) {
    rows.push({ icon: IconBath, label: "Санузлы", value: specs.bathrooms });
  }

  const onRequest = priceOnRequest || basePrice == null;
  const priceLabel = onRequest
    ? "Цена по запросу"
    : `от ${formatRub(basePrice)}`;

  return (
    <section className={cn(className)}>
      <h2 className="text-xl font-extrabold tracking-tight uppercase">Расчёт</h2>

      <div className="mt-5 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <p className="text-sm text-slate-500">
            Базовый состав проекта — можно запросить точный расчёт у менеджера.
          </p>

          <h3 className="mt-4 text-2xl font-extrabold uppercase leading-[0.95] tracking-tight text-slate-900 sm:text-3xl">
            {title}
            {mark ? (
              <>
                {" "}
                <span className="text-avgst-yellow">{mark}</span>
              </>
            ) : null}
          </h3>

          {rows.length > 0 ? (
            <ul className="mt-5 flex divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
              {rows.map((row) => {
                const Icon = row.icon;
                return (
                  <li key={row.label} className="min-w-0 flex-1 px-2.5 py-3 sm:px-4">
                    <div className="flex items-center gap-1 text-[0.65rem] font-medium tracking-wide text-slate-500 uppercase sm:gap-1.5 sm:text-xs">
                      <Icon className="size-3.5 shrink-0 text-avgst-green" stroke={1.75} />
                      <span className="truncate">{row.label}</span>
                    </div>
                    <p className="mt-1 text-base font-extrabold tabular-nums text-slate-900 sm:text-lg">
                      {row.value}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
              Характеристики уточняются — оставьте заявку, менеджер пришлёт расчёт.
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-end gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-white">
            <p className="text-lg font-extrabold tabular-nums tracking-tight sm:text-xl">
              {priceLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-4 py-3.5 sm:px-6">
          <Button
            type="button"
            className="bg-avgst-yellow font-bold text-slate-950 hover:bg-avgst-yellow/90"
            onClick={onRequestQuote}
          >
            Получить расчёт
          </Button>
        </div>
      </div>
    </section>
  );
}
