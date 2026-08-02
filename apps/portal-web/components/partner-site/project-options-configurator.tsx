"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatRub } from "@/lib/partner-pricing";
import { cn } from "@/lib/utils";

export type ConfiguratorOption = {
  id: string;
  name: string;
  price?: number;
  note?: string;
};

export type ConfiguratorGroup = {
  id: string;
  title: string;
  items: ConfiguratorOption[];
};

export type ConfiguratorSelection = {
  selected: ConfiguratorOption[];
  summaryText: string;
  totalAmount: number | null;
  totalOnRequest: boolean;
};

type ProjectOptionsConfiguratorProps = {
  groups: ConfiguratorGroup[];
  basePrice: number | null;
  priceOnRequest?: boolean;
  onRequestQuote?: (selection: ConfiguratorSelection) => void;
  className?: string;
};

type Stage = {
  id: string;
  title: string;
  mode: "single" | "multi";
  items: ConfiguratorOption[];
};

function toStages(groups: ConfiguratorGroup[]): Stage[] {
  const named: Stage[] = groups
    .filter((g) => g.title && g.items.length > 0)
    .map((g) => ({
      id: g.id,
      title: g.title,
      mode: "single" as const,
      items: g.items
    }));
  const loose = groups.find((g) => !g.title && g.items.length > 0);
  if (loose) {
    named.push({
      id: loose.id,
      title: "Дополнительно",
      mode: "multi" as const,
      items: loose.items
    });
  }
  return named;
}

function buildSelection(
  stages: Stage[],
  sectionChoice: Record<string, string>,
  checkedIds: Set<string>,
  basePrice: number | null,
  priceOnRequest: boolean
): ConfiguratorSelection {
  const selected: ConfiguratorOption[] = [];

  for (const stage of stages) {
    if (stage.mode === "multi") {
      for (const item of stage.items) {
        if (checkedIds.has(item.id)) selected.push(item);
      }
      continue;
    }
    const chosenId = sectionChoice[stage.id];
    if (!chosenId) continue;
    const item = stage.items.find((row) => row.id === chosenId);
    if (item) selected.push(item);
  }

  const anyOnRequest =
    priceOnRequest || basePrice == null || selected.some((item) => item.price == null);
  const extrasSum = selected.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const totalAmount = anyOnRequest ? null : (basePrice ?? 0) + extrasSum;
  const lines = selected.map((item) =>
    item.price != null ? `${item.name} (+${formatRub(item.price)})` : `${item.name} (по запросу)`
  );

  return {
    selected,
    summaryText:
      lines.length > 0 ? `Выбранные опции:\n${lines.map((line) => `• ${line}`).join("\n")}` : "",
    totalAmount,
    totalOnRequest: anyOnRequest
  };
}

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 })
};

/** Пошаговый конфигуратор — в той же иерархии блоков, что планировки и галереи */
export function ProjectOptionsConfigurator({
  groups,
  basePrice,
  priceOnRequest = false,
  onRequestQuote,
  className
}: ProjectOptionsConfiguratorProps) {
  const stages = useMemo(() => toStages(groups), [groups]);
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [sectionChoice, setSectionChoice] = useState<Record<string, string>>({});
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());

  const selection = useMemo(
    () => buildSelection(stages, sectionChoice, checkedIds, basePrice, priceOnRequest),
    [stages, sectionChoice, checkedIds, basePrice, priceOnRequest]
  );

  // Высота списка — по максимуму опций среди этапов проекта (без прыжков)
  const maxOptionRows = useMemo(
    () => stages.reduce((max, s) => Math.max(max, s.items.length), 0),
    [stages]
  );
  // py-3 + строка текста + border ≈ 52px; gap space-y-2.5 = 10px
  const optionsListMinHeightPx =
    maxOptionRows > 0
      ? maxOptionRows * 52 + Math.max(0, maxOptionRows - 1) * 10
      : 0;

  if (stages.length === 0) return null;

  const isSummary = stepIndex >= stages.length;
  const stage = !isSummary ? stages[stepIndex] : null;
  const segmentCount = stages.length + 1; // этапы + итог
  const currentLabel = isSummary ? "Итог" : stage!.title;

  function goTo(next: number) {
    setDirection(next > stepIndex ? 1 : -1);
    setStepIndex(next);
  }

  function selectSingle(stageId: string, optionId: string) {
    setSectionChoice((prev) => ({ ...prev, [stageId]: optionId }));
    window.setTimeout(() => {
      setDirection(1);
      setStepIndex((prev) => Math.min(prev + 1, stages.length));
    }, 280);
  }

  return (
    <section className={cn(className)}>
      <h2 className="text-xl font-extrabold tracking-tight uppercase">Конфигуратор</h2>

      <div className="mt-5 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
        <div className="relative px-4 py-5 sm:px-6 sm:py-6">
          {/* Название текущего этапа над сегментами прогресса */}
          <p className="text-sm font-semibold text-slate-900">{currentLabel}</p>
          <div
            className="mt-2.5 flex gap-1.5"
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={segmentCount}
            aria-label={`Шаг ${stepIndex + 1} из ${segmentCount}`}
          >
            {Array.from({ length: segmentCount }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-avgst-green" : "bg-slate-200"
                )}
              />
            ))}
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={isSummary ? "summary" : stage?.id}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5"
            >
              {!isSummary && stage ? (
                <>
                  <p className="text-sm text-slate-500">
                    {stage.mode === "single"
                      ? "Выберите один вариант — перейдём дальше"
                      : "Отметьте нужные опции и нажмите «Далее»"}
                  </p>

                  <ul
                    className="mt-4 space-y-2.5"
                    style={{ minHeight: optionsListMinHeightPx }}
                  >
                    {stage.items.map((item) => {
                      if (stage.mode === "multi") {
                        const checked = checkedIds.has(item.id);
                        return (
                          <li key={item.id}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition sm:gap-4",
                                checked
                                  ? "border-avgst-yellow bg-avgst-yellow/5"
                                  : "border-slate-200 hover:border-slate-300"
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => {
                                  setCheckedIds((prev) => {
                                    const next = new Set(prev);
                                    if (value === true) next.add(item.id);
                                    else next.delete(item.id);
                                    return next;
                                  });
                                }}
                                className="border-slate-300 data-[state=checked]:border-avgst-yellow data-[state=checked]:bg-avgst-yellow data-[state=checked]:text-slate-950"
                              />
                              <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-900 sm:text-base">
                                  {item.name}
                                </span>
                                <span className="text-sm tabular-nums text-slate-600">
                                  {item.price != null
                                    ? `+ ${formatRub(item.price)}`
                                    : "по запросу"}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      }

                      const selected = sectionChoice[stage.id] === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => selectSingle(stage.id, item.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition sm:gap-4",
                              selected
                                ? "border-avgst-yellow bg-avgst-yellow/5 ring-2 ring-avgst-yellow/30"
                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <span
                              className={cn(
                                "size-4 shrink-0 rounded-full border-2",
                                selected
                                  ? "border-avgst-yellow bg-avgst-yellow"
                                  : "border-slate-300"
                              )}
                            />
                            <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-900 sm:text-base">
                                {item.name}
                              </span>
                              <span className="text-sm tabular-nums text-slate-600">
                                {item.price != null
                                  ? `+ ${formatRub(item.price)}`
                                  : "по запросу"}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    Проверьте состав — можно вернуться и изменить выбор.
                  </p>

                  <div
                    className="mt-4 space-y-3"
                    style={{ minHeight: optionsListMinHeightPx }}
                  >
                    {selection.selected.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                        Опции не выбраны. Итоговая цена — базовая стоимость проекта.
                      </p>
                    ) : (
                      <ul className="overflow-hidden rounded-xl border border-slate-200">
                        {selection.selected.map((item, index) => (
                          <li
                            key={item.id}
                            className={cn(
                              "flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm",
                              index > 0 && "border-t border-slate-100"
                            )}
                          >
                            <span className="font-medium text-slate-900">{item.name}</span>
                            <span className="font-semibold tabular-nums text-slate-700">
                              {item.price != null
                                ? `+ ${formatRub(item.price)}`
                                : "по запросу"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Сумма всегда на месте — без прыжка layout при выборе */}
        <div className="border-t border-slate-100 px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-end gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-white">
            <p className="text-lg font-extrabold tabular-nums tracking-tight sm:text-xl">
              {selection.totalOnRequest || selection.totalAmount == null
                ? "Цена по запросу"
                : formatRub(selection.totalAmount)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3.5 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="border-slate-300"
            disabled={stepIndex === 0}
            onClick={() => goTo(stepIndex - 1)}
          >
            <IconChevronLeft className="size-4" />
            Назад
          </Button>

          <div className="flex flex-wrap gap-2">
            {!isSummary && stage?.mode === "single" ? (
              <Button
                type="button"
                variant="ghost"
                className="text-slate-500"
                onClick={() => goTo(stepIndex + 1)}
              >
                Пропустить
              </Button>
            ) : null}

            {!isSummary ? (
              <Button
                type="button"
                className="bg-avgst-green text-white hover:bg-avgst-green/90"
                onClick={() => goTo(stepIndex + 1)}
              >
                Далее
                <IconChevronRight className="size-4" />
              </Button>
            ) : onRequestQuote ? (
              <Button
                type="button"
                className="bg-avgst-yellow font-bold text-slate-950 hover:bg-avgst-yellow/90"
                onClick={() => onRequestQuote(selection)}
              >
                Получить расчёт
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
