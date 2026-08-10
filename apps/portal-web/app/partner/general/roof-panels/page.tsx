"use client";

import { useEffect, useState } from "react";
import { IconCheck } from "@tabler/icons-react";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { FactoryRequestCard } from "@/components/partner-general/factory-request-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatPrice, type FactoryProduct } from "@/lib/general-section";

/** Состав панели записан в описании построчно — разбираем на список */
function splitComposition(description: string): { intro: string; items: string[] } {
  const [head = "", ...rest] = description.split(":");
  if (rest.length === 0) return { intro: description, items: [] };
  const items = rest
    .join(":")
    .split(/[,;]\s*/)
    .map((item) => item.trim().replace(/\.$/, ""))
    .filter(Boolean);
  return { intro: `${head.trim()}:`, items };
}

export default function GeneralRoofPanelsPage() {
  const [panel, setPanel] = useState<FactoryProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const items = await apiFetch<FactoryProduct[]>(
          "/api/partner/general/products?kind=roof_panel"
        );
        setPanel(items[0] ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const composition = panel ? splitComposition(panel.description) : null;

  return (
    <PartnerShell currentPath="/partner/general" title="Кровельные панели">
      <PageAlert message={error} variant="destructive" />

      {loading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : !panel ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Данные о кровельных панелях пока не заведены.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <CardContent className="grid gap-0 px-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex flex-col gap-4 p-6">
              <h2 className="text-lg font-medium">{panel.name}</h2>
              {composition?.intro ? (
                <p className="text-muted-foreground text-sm">{composition.intro}</p>
              ) : null}
              {composition && composition.items.length > 0 ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {composition.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <IconCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* Цена — то, ради чего дилер сюда зашёл: отдельной плоскостью */}
            <aside className="bg-muted/30 flex flex-col justify-center gap-1 border-t p-6 lg:border-t-0 lg:border-l">
              <p className="text-muted-foreground text-sm">Цена для дилера</p>
              <p className="text-3xl font-medium tabular-nums">{formatPrice(panel.price)}</p>
              <p className="text-muted-foreground text-sm">{panel.priceUnit || "за единицу"}</p>
            </aside>
          </CardContent>
        </Card>
      )}

      <FactoryRequestCard
        subject="Кровельные панели"
        title="Нужен расчёт или шеф-монтаж"
        description="Оставьте контакты — посчитаем панели по вашей кровле и расскажем условия шеф-монтажа."
      />
    </PartnerShell>
  );
}
