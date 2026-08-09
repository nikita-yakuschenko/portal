"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { DealCardDialog } from "@/components/partner-deals/deal-card-dialog";
import { DealsBoard } from "@/components/partner-deals/deals-board";
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
  DEAL_STATUS_DOT,
  DEAL_STATUS_LABEL,
  formatAmount,
  formatDealDate,
  type Deal,
  type DealStatus
} from "@/lib/deals";

const VIEWS = ["board", "table"] as const;
type DealsView = (typeof VIEWS)[number];

function parseView(value: string | null): DealsView {
  return value === "table" ? "table" : "board";
}

function PartnerDealsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));

  const [items, setItems] = useState<Deal[]>([]);
  const [crmConnected, setCrmConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [deals, connections] = await Promise.all([
          apiFetch<Deal[]>("/api/partner/deals"),
          apiFetch<Array<{ isEnabled: boolean }>>("/api/partner/crm-connections").catch(() => [])
        ]);
        setItems(deals);
        setCrmConnected(connections.some((item) => item.isEnabled));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить сделки");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function changeView(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (parseView(next) === "board") params.delete("view");
    else params.set("view", "table");
    const query = params.toString();
    router.replace(query ? `/partner/deals?${query}` : "/partner/deals", { scroll: false });
  }

  const applyUpdate = useCallback((next: Deal) => {
    setItems((prev) => prev.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
  }, []);

  /** Двигаем карточку сразу, откатываем — если сервер не принял */
  const moveDeal = useCallback(async (deal: Deal, status: DealStatus) => {
    const previous = deal.status;
    setItems((prev) => prev.map((item) => (item.id === deal.id ? { ...item, status } : item)));
    try {
      await apiFetch(`/api/partner/deals/${deal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
    } catch (err) {
      setItems((prev) =>
        prev.map((item) => (item.id === deal.id ? { ...item, status: previous } : item))
      );
      toast.error(err instanceof Error ? err.message : "Не удалось перенести сделку");
    }
  }, []);

  return (
    <PartnerShell
      currentPath="/partner/deals"
      title="Сделки"
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
          CRM не подключена — сделки ведутся здесь.{" "}
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
            Сделок пока нет. Каждая заявка с форм вашего сайта заводит сделку здесь.
          </CardContent>
        </Card>
      ) : view === "board" ? (
        <DealsBoard
          deals={items}
          onOpen={(deal) => setOpenId(deal.id)}
          onMove={(deal, status) => void moveDeal(deal, status)}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Когда</TableHead>
                    <TableHead>Сделка</TableHead>
                    <TableHead>Контакт</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Ответственный</TableHead>
                    <TableHead>Статус</TableHead>
                    {crmConnected ? <TableHead className="pr-6">CRM</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground pl-6 whitespace-nowrap tabular-nums">
                        {formatDealDate(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium underline-offset-4 hover:underline"
                          onClick={() => setOpenId(item.id)}
                        >
                          {item.title}
                        </button>
                      </TableCell>
                      <TableCell>{item.contact?.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {item.contact?.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {item.amount === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatAmount(item.amount)
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.assigneeName ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              DEAL_STATUS_DOT[item.status]
                            )}
                            aria-hidden
                          />
                          {DEAL_STATUS_LABEL[item.status]}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <DealCardDialog
        dealId={openId}
        open={Boolean(openId)}
        onOpenChange={(next: boolean) => {
          if (!next) setOpenId(null);
        }}
        onChanged={applyUpdate}
      />
    </PartnerShell>
  );
}

export default function PartnerDealsPage() {
  return (
    <Suspense
      fallback={
        <PartnerShell currentPath="/partner/deals" title="Сделки">
          <Skeleton className="h-64 w-full" />
        </PartnerShell>
      }
    >
      <PartnerDealsContent />
    </Suspense>
  );
}
