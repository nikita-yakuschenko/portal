"use client";

import { useEffect, useState } from "react";
import { IconWorldWww } from "@tabler/icons-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

type SiteRow = {
  id: string;
  partnerId: string;
  companyName: string;
  subdomain: string;
  domain: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
  publicUrl: string;
};

export default function CompanySitesPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setSites(await apiFetch<SiteRow[]>("/api/company/sites"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить сайты");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/sites"
      navigation={companyNavigation}
    >
      <PageAlert message={error} variant="destructive" />

      <Card>
        <CardHeader>
          <CardTitle>Сайты партнёров</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-12 w-full" />
              ))}
            </div>
          ) : sites.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconWorldWww />
                </EmptyMedia>
                <EmptyTitle>Сайтов пока нет</EmptyTitle>
                <EmptyDescription>
                  Сайт создаётся автоматически при подключении партнёра.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Партнёр</TableHead>
                    <TableHead>Поддомен</TableHead>
                    <TableHead>Свой домен</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Ссылка</TableHead>
                    <TableHead>Обновлён</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium">{site.companyName}</TableCell>
                      <TableCell className="font-mono text-sm">{site.subdomain}.avgst.ru</TableCell>
                      <TableCell>{site.domain?.trim() || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={site.status === "published" ? "default" : "secondary"}>
                          {site.status === "published" ? "Опубликован" : "Черновик"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {site.status === "published" ? (
                          <a
                            href={site.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm underline-offset-4 hover:underline"
                          >
                            Открыть
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(site.updatedAt).toLocaleDateString("ru-RU")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
