"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { RequestDetailsSheet } from "@/components/partner-requests/request-details-sheet";
import { RequestsBoard } from "@/components/partner-requests/requests-board";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CRM_STATUS_LABEL,
  CRM_STATUS_VARIANT,
  REQUEST_STATUS_DOT,
  REQUEST_STATUS_LABEL,
  formatRequestDate,
  formatUtm,
  telHref,
  type SiteRequest,
  type SiteRequestStatus
} from "@/lib/site-requests";

const VIEWS = ["board", "table"] as const;
type RequestsView = (typeof VIEWS)[number];

function parseView(value: string | null): RequestsView {
  return value === "table" ? "table" : "board";
}

function PartnerRequestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));

  const [items, setItems] = useState<SiteRequest[]>([]);
  const [crmConnected, setCrmConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [requests, connections] = await Promise.all([
          apiFetch<SiteRequest[]>("/api/partner/requests"),
          apiFetch<Array<{ isEnabled: boolean }>>("/api/partner/crm-connections").catch(() => [])
        ]);
        setItems(requests);
        setCrmConnected(connections.some((item) => item.isEnabled));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить заявки");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openRequest = useMemo(
    () => items.find((item) => item.id === openId) ?? null,
    [items, openId]
  );

  function changeView(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (parseView(next) === "board") params.delete("view");
    else params.set("view", "table");
    const query = params.toString();
    router.replace(query ? `/partner/requests?${query}` : "/partner/requests", { scroll: false });
  }

  const applyUpdate = useCallback((next: SiteRequest) => {
    setItems((prev) => prev.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
  }, []);

  /** Двигаем карточку сразу, откатываем — если сервер не принял */
  const moveRequest = useCallback(
    async (request: SiteRequest, status: SiteRequestStatus) => {
      const previous = request.status;
      setItems((prev) =>
        prev.map((item) => (item.id === request.id ? { ...item, status } : item))
      );
      try {
        await apiFetch(`/api/partner/requests/${request.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
      } catch (err) {
        setItems((prev) =>
          prev.map((item) => (item.id === request.id ? { ...item, status: previous } : item))
        );
        toast.error(err instanceof Error ? err.message : "Не удалось перенести заявку");
      }
    },
    []
  );

  return (
    <PartnerShell
      currentPath="/partner/requests"
      title="Заявки"
      headerActions={
        !loading && items.length > 0 ? (
          <Tabs value={view} onValueChange={changeView}>
            <TabsList>
              <TabsTrigger value="board">Доска</TabsTrigger>
              <TabsTrigger value="table">Таблица</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null
      }
    >
      <PageAlert message={error} variant="destructive" />

      {/* Про CRM говорим один раз, а не бейджем в каждой строке */}
      {!loading && !crmConnected && items.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          CRM не подключена — заявки остаются здесь.{" "}
          <Link
            href="/partner/settings?tab=integrations"
            className="text-foreground underline underline-offset-4"
          >
            Подключить
          </Link>
        </p>
      ) : null}

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Заявок пока нет. Сюда попадёт всё, что отправят через формы на вашем сайте.
          </CardContent>
        </Card>
      ) : view === "board" ? (
        <RequestsBoard
          requests={items}
          onOpen={(request) => setOpenId(request.id)}
          onMove={(request, status) => void moveRequest(request, status)}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Когда</TableHead>
                    <TableHead>Имя</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Форма</TableHead>
                    <TableHead>Метки</TableHead>
                    <TableHead>Статус</TableHead>
                    {crmConnected ? <TableHead className="pr-6">CRM</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const utm = formatUtm(item.utm);
                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => setOpenId(item.id)}
                      >
                        <TableCell className="text-muted-foreground pl-6 whitespace-nowrap tabular-nums">
                          {formatRequestDate(item.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium">{item.customerName}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          <a
                            href={telHref(item.customerPhone)}
                            className="underline-offset-4 hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {item.customerPhone}
                          </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.formName}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[16rem] truncate">
                          {utm || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                REQUEST_STATUS_DOT[item.status]
                              )}
                              aria-hidden
                            />
                            {REQUEST_STATUS_LABEL[item.status]}
                          </span>
                        </TableCell>
                        {crmConnected ? (
                          <TableCell className="pr-6">
                            {item.crmStatus === "skipped" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <Badge
                                variant={CRM_STATUS_VARIANT[item.crmStatus]}
                                title={item.crmError ?? undefined}
                              >
                                {CRM_STATUS_LABEL[item.crmStatus]}
                              </Badge>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <RequestDetailsSheet
        request={openRequest}
        open={Boolean(openRequest)}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        onUpdated={applyUpdate}
      />
    </PartnerShell>
  );
}

export default function PartnerRequestsPage() {
  return (
    <Suspense
      fallback={
        <PartnerShell currentPath="/partner/requests" title="Заявки">
          <Skeleton className="h-64 w-full" />
        </PartnerShell>
      }
    >
      <PartnerRequestsContent />
    </Suspense>
  );
}
