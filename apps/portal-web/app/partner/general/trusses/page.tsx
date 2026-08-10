"use client";

import { useEffect, useState } from "react";
import { IconPhoto } from "@tabler/icons-react";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { FactoryRequestCard } from "@/components/partner-general/factory-request-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { parseProductImageUrls, type FactoryProduct } from "@/lib/general-section";

export default function GeneralTrussesPage() {
  const [items, setItems] = useState<FactoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setItems(await apiFetch<FactoryProduct[]>("/api/partner/general/products?kind=truss"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить типы ферм");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PartnerShell currentPath="/partner/general" title="Фермы на МЗП">
      <PageAlert message={error} variant="destructive" />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Типы ферм пока не заведены.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const cover = parseProductImageUrls(item.imageUrl)[0] ?? null;
            return (
              <article
                key={item.id}
                className="bg-card flex flex-col overflow-hidden rounded-xl border"
              >
                <div className="bg-muted relative aspect-video overflow-hidden border-b">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground flex size-full items-center justify-center">
                      <IconPhoto className="size-6" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 p-4">
                  {item.sizes ? (
                    <Badge variant="secondary" className="w-fit font-normal tabular-nums">
                      {item.sizes}
                    </Badge>
                  ) : null}
                  <h2 className="font-medium">{item.name}</h2>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <FactoryRequestCard
        subject="Фермы на МЗП"
        title="Нужен расчёт или шеф-монтаж"
        description="Оставьте контакты — инженер завода посчитает фермы по вашему проекту и расскажет условия шеф-монтажа."
      />
    </PartnerShell>
  );
}
