"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  factoryOptionKey,
  formatRub,
  resolveDealerFactoryBase
} from "@/lib/partner-pricing";
import { cn } from "@/lib/utils";

export type FactoryOfferLine = { id: string; name: string; price: number };

export type FactoryOfferView = {
  importedAt?: string;
  sources?: string[];
  assembly: FactoryOfferLine[];
  extras: FactoryOfferLine[];
};

/** Тематические группы заводских допов (матч по нормализованному имени) */
const EXTRA_TABS: Array<{
  id: string;
  title: string;
  /** Подстроки factoryOptionKey — первая подходящая группа выигрывает */
  matchers: string[];
}> = [
  {
    id: "exterior",
    title: "Экстерьер",
    matchers: ["настил кровли", "терраса"]
  },
  {
    id: "interior",
    title: "Интерьер",
    matchers: [
      "настил пола",
      "пвх плинтус",
      "отделка потолка",
      "отделка стен",
      "внутренняя покраска",
      "укладка плитки",
      "межкомнатн"
    ]
  },
  {
    id: "comms",
    title: "Коммуникации",
    matchers: ["отопление", "вентиляция", "водопровод", "канализация", "фаянс"]
  },
  {
    id: "electric",
    title: "Электрика",
    matchers: ["электрика"]
  }
];

function groupExtrasByTab(extras: FactoryOfferLine[]) {
  const buckets = new Map<string, FactoryOfferLine[]>();
  for (const tab of EXTRA_TABS) buckets.set(tab.id, []);
  buckets.set("other", []);

  for (const item of extras) {
    const key = factoryOptionKey(item.name);
    const tab =
      EXTRA_TABS.find((row) => row.matchers.some((m) => key.includes(m))) ?? null;
    buckets.get(tab?.id ?? "other")!.push(item);
  }

  const tabs = EXTRA_TABS.map((tab) => ({
    id: tab.id,
    title: tab.title,
    items: buckets.get(tab.id) ?? []
  })).filter((tab) => tab.items.length > 0);

  const other = buckets.get("other") ?? [];
  if (other.length > 0) {
    tabs.push({ id: "other", title: "Прочее", items: other });
  }
  return tabs;
}

function Lines({
  items,
  dense
}: {
  items: FactoryOfferLine[];
  dense?: boolean;
}) {
  return (
    <ul className={cn("divide-border divide-y", dense && "text-sm")}>
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-4 py-2">
          <span className="min-w-0">{item.name}</span>
          <span className="shrink-0 font-medium tabular-nums">{formatRub(item.price)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Read-only предложение завода дилеру (не допы витрины покупателя) */
export function FactoryOfferPanel({
  basePrice,
  offer,
  emptyHint = "Прайс ещё не загружали из Excel.",
  variant = "default"
}: {
  basePrice?: number | null;
  offer: FactoryOfferView | null | undefined;
  emptyHint?: string;
  /** partner — компактный блок во вкладке цены дилера */
  variant?: "default" | "partner";
}) {
  const assembly = offer?.assembly ?? [];
  const extras = offer?.extras ?? [];
  const hasLines = assembly.length > 0 || extras.length > 0;

  if (variant === "partner") {
    return (
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Базовая стоимость
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {basePrice != null ? formatRub(basePrice) : "Цена не указана"}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Домокомплект с учётом выбранных опций. Наценка ниже считается от этой суммы.
        </p>
      </div>
    );
  }

  // HQ / общий вид
  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground text-xs">Стоимость дома</p>
        <p className="text-lg font-semibold tabular-nums">
          {basePrice != null ? formatRub(basePrice) : "Не указана"}
        </p>
      </div>

      {!hasLines ? (
        <p className="text-muted-foreground text-sm">{emptyHint}</p>
      ) : (
        <>
          {assembly.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold">Сборка</h4>
              <div className="mt-1">
                <Lines items={assembly} />
              </div>
            </div>
          ) : null}
          {extras.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold">Допы завода</h4>
              <div className="mt-1">
                <Lines items={extras} />
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function SelectableLines({
  items,
  selectedKeys,
  canManage,
  onToggle
}: {
  items: FactoryOfferLine[];
  selectedKeys: Set<string>;
  canManage: boolean;
  onToggle: (key: string, enabled: boolean) => void;
}) {
  return (
    <ul className="divide-border divide-y">
      {items.map((item) => {
        const key = factoryOptionKey(item.name);
        const checked = selectedKeys.has(key);
        return (
          <li key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <Switch
                checked={checked}
                disabled={!canManage}
                onCheckedChange={(next) => onToggle(key, next)}
                aria-label={item.name}
              />
              <span className={cn("min-w-0", !checked && "text-muted-foreground")}>{item.name}</span>
            </div>
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                !checked && "text-muted-foreground"
              )}
            >
              {formatRub(item.price)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Вкладка «Комплектация»: дом + тумблеры заводских позиций → база для наценки */
export function FactoryPackagesEditor({
  housePrice,
  offer,
  selectedKeys,
  canManage,
  saving,
  onChange
}: {
  housePrice?: number | null;
  offer: FactoryOfferView | null | undefined;
  selectedKeys: string[];
  canManage: boolean;
  saving?: boolean;
  onChange: (nextKeys: string[]) => void;
}) {
  const assembly = offer?.assembly ?? [];
  const extras = offer?.extras ?? [];
  const selected = new Set(selectedKeys.map(factoryOptionKey));
  const assemblyKeys = new Set(assembly.map((item) => factoryOptionKey(item.name)));
  const extraTabs = groupExtrasByTab(extras);
  const packageTabs = [
    ...(assembly.length > 0
      ? [{ id: "assembly", title: "Сборка", items: assembly, exclusive: true as const }]
      : []),
    ...extraTabs.map((tab) => ({ ...tab, exclusive: false as const }))
  ];
  const dealerBase = resolveDealerFactoryBase(housePrice, offer, selectedKeys);
  const hasAnything = housePrice != null || assembly.length > 0 || extras.length > 0;

  if (!hasAnything) {
    return (
      <p className="text-muted-foreground text-sm">
        Прайс комплектации ещё не загружен. Обновите цены из Excel в кабинете завода.
      </p>
    );
  }

  function toggleExtra(key: string, enabled: boolean) {
    const next = new Set(selected);
    if (enabled) next.add(key);
    else next.delete(key);
    onChange([...next]);
  }

  // Сборка: максимум один вариант (НН / Москва и т.п.)
  function toggleAssembly(key: string, enabled: boolean) {
    const next = new Set(selected);
    for (const assemblyKey of assemblyKeys) next.delete(assemblyKey);
    if (enabled) next.add(key);
    onChange([...next]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">Домокомплект</p>
        <p className="text-base font-semibold tabular-nums">
          {housePrice != null ? formatRub(housePrice) : "Цена по запросу"}
        </p>
      </div>

      {packageTabs.length > 0 ? (
        <Tabs defaultValue={packageTabs[0]!.id} className="gap-2 md:gap-2">
          <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
            {packageTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {packageTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0 px-3">
              <SelectableLines
                items={tab.items}
                selectedKeys={selected}
                canManage={canManage && !saving}
                onToggle={tab.exclusive ? toggleAssembly : toggleExtra}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}

      <div className="border-t pt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium">Базовая стоимость</p>
          <p className="text-base font-semibold tabular-nums">
            {dealerBase != null ? formatRub(dealerBase) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function EditablePriceLines({
  items,
  onChangePrice
}: {
  items: FactoryOfferLine[];
  onChangePrice: (id: string, price: number) => void;
}) {
  return (
    <ul className="divide-border divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm">
          <span className="min-w-0">{item.name}</span>
          <Input
            type="number"
            min={0}
            step={1}
            className="h-8 w-32 shrink-0 text-right tabular-nums"
            value={item.price}
            onChange={(e) => {
              const next = e.target.value === "" ? 0 : Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onChangePrice(item.id, Math.max(0, Math.round(next)));
            }}
          />
        </li>
      ))}
    </ul>
  );
}

/** HQ: комплектация с редактированием цен по тематическим табам */
export function FactoryPackagesPriceEditor({
  housePrice,
  offer,
  saving,
  onSave
}: {
  housePrice?: number | null;
  offer: FactoryOfferView | null | undefined;
  saving?: boolean;
  onSave: (next: {
    basePrice: number | null;
    assembly: FactoryOfferLine[];
    extras: FactoryOfferLine[];
  }) => void;
}) {
  const [basePrice, setBasePrice] = useState<number | null>(housePrice ?? null);
  const [assembly, setAssembly] = useState<FactoryOfferLine[]>(offer?.assembly ?? []);
  const [extras, setExtras] = useState<FactoryOfferLine[]>(offer?.extras ?? []);

  useEffect(() => {
    setBasePrice(housePrice ?? null);
    setAssembly(offer?.assembly ?? []);
    setExtras(offer?.extras ?? []);
  }, [housePrice, offer]);

  const extraTabs = groupExtrasByTab(extras);
  const packageTabs = [
    ...(assembly.length > 0
      ? [{ id: "assembly", title: "Сборка", items: assembly }]
      : []),
    ...extraTabs
  ];
  const hasAnything = basePrice != null || assembly.length > 0 || extras.length > 0;

  if (!hasAnything) {
    return (
      <p className="text-muted-foreground text-sm">
        Прайс ещё не загружен. Обновите цены из Excel на странице каталога.
      </p>
    );
  }

  function patchAssemblyPrice(id: string, price: number) {
    setAssembly((prev) => prev.map((row) => (row.id === id ? { ...row, price } : row)));
  }

  function patchExtraPrice(id: string, price: number) {
    setExtras((prev) => prev.map((row) => (row.id === id ? { ...row, price } : row)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">Домокомплект</p>
        <Input
          type="number"
          min={0}
          step={1}
          className="h-8 w-40 text-right tabular-nums"
          value={basePrice ?? ""}
          placeholder="Цена"
          onChange={(e) => {
            if (e.target.value === "") {
              setBasePrice(null);
              return;
            }
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            setBasePrice(Math.max(0, Math.round(next)));
          }}
        />
      </div>

      {packageTabs.length > 0 ? (
        <Tabs defaultValue={packageTabs[0]!.id} className="gap-2 md:gap-2">
          <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
            {packageTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {packageTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0 px-1">
              <EditablePriceLines
                items={tab.items}
                onChangePrice={tab.id === "assembly" ? patchAssemblyPrice : patchExtraPrice}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}

      <div>
        <Button
          type="button"
          disabled={saving}
          onClick={() =>
            onSave({
              basePrice,
              assembly,
              extras
            })
          }
        >
          {saving ? <Spinner /> : null}
          Сохранить прайс
        </Button>
      </div>
    </div>
  );
}
