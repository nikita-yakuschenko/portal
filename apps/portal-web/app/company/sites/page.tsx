"use client";

import { useCallback, useEffect, useState } from "react";
import { IconWorldWww } from "@tabler/icons-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
  publishLocked: boolean;
  republishRequestStatus: "pending" | null;
  republishRequestedAt: string | null;
  republishRequestComment: string | null;
};

export default function CompanySitesPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      setSites(await apiFetch<SiteRow[]>("/api/company/sites"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить сайты");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(
    partnerId: string,
    path: string,
    successMessage: string
  ) {
    setBusyId(partnerId);
    try {
      await apiFetch(`/api/company/sites/${partnerId}/${path}`, { method: "POST" });
      toast.success(successMessage);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Операция не выполнена");
    } finally {
      setBusyId(null);
    }
  }

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
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map((site) => {
                    const busy = busyId === site.partnerId;
                    return (
                      <TableRow key={site.id}>
                        <TableCell className="font-medium">{site.companyName}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {site.subdomain}.avgst.ru
                        </TableCell>
                        <TableCell>{site.domain?.trim() || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={site.status === "published" ? "default" : "secondary"}>
                              {site.status === "published" ? "Опубликован" : "Черновик"}
                            </Badge>
                            {site.publishLocked ? (
                              <Badge variant="destructive">Заблокирован</Badge>
                            ) : null}
                            {site.republishRequestStatus === "pending" ? (
                              <Badge variant="outline">Запрос на возобновление</Badge>
                            ) : null}
                          </div>
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
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {busy ? <Spinner className="size-4" /> : null}
                            {site.status === "published" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(
                                    site.partnerId,
                                    "unpublish",
                                    "Сайт снят с публикации, публикация заблокирована"
                                  )
                                }
                              >
                                Снять с публикации
                              </Button>
                            ) : null}
                            {site.publishLocked ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(
                                    site.partnerId,
                                    "unlock-publish",
                                    "Публикация разблокирована"
                                  )
                                }
                              >
                                Разблокировать
                              </Button>
                            ) : null}
                            {site.republishRequestStatus === "pending" ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction(
                                      site.partnerId,
                                      "approve-republish",
                                      "Возобновление одобрено, сайт опубликован"
                                    )
                                  }
                                >
                                  Одобрить
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() =>
                                    void runAction(
                                      site.partnerId,
                                      "reject-republish",
                                      "Запрос отклонён"
                                    )
                                  }
                                >
                                  Отклонить
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
