"use client";

import { useEffect, useState } from "react";
import {
  IconExternalLink,
  IconFileText,
  IconFolders,
  IconPalette,
  IconPhoto,
  type Icon
} from "@tabler/icons-react";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { MATERIAL_CATEGORY_LABEL, type DealerMaterial } from "@/lib/general-section";

const CATEGORY_ICON: Record<string, Icon> = {
  media: IconPhoto,
  presentation: IconFileText,
  docs: IconFileText,
  brand: IconPalette,
  other: IconFolders
};

export default function GeneralMaterialsPage() {
  const [items, setItems] = useState<DealerMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setItems(await apiFetch<DealerMaterial[]>("/api/partner/general/materials"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить материалы");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PartnerShell currentPath="/partner/general" title="Материалы для дилеров">
      <PageAlert message={error} variant="destructive" />

      <p className="text-muted-foreground max-w-prose text-sm">
        Фото и видео проектов, презентации и фирменные материалы — берите для своего сайта,
        соцсетей и переговоров. Подборки хранятся во внешнем облаке и открываются в новой вкладке.
      </p>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Подборок пока нет.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = CATEGORY_ICON[item.category] ?? IconFolders;
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-card flex items-start gap-4 rounded-xl border p-4 transition-[border-color,background-color] duration-150 hover:border-ring/60 hover:bg-accent/30 focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]"
              >
                <span className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-muted-foreground block text-xs">
                    {MATERIAL_CATEGORY_LABEL[item.category] ?? MATERIAL_CATEGORY_LABEL.other}
                  </span>
                  <span className="block font-medium">{item.title}</span>
                  {item.description ? (
                    <span className="text-muted-foreground mt-0.5 block text-sm">
                      {item.description}
                    </span>
                  ) : null}
                </span>
                <IconExternalLink
                  className="text-muted-foreground size-4 shrink-0 transition-transform duration-150 group-hover:-translate-y-0.5"
                  aria-hidden
                />
              </a>
            );
          })}
        </div>
      )}
    </PartnerShell>
  );
}
