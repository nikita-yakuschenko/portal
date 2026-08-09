"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
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
import { apiFetch } from "@/lib/api";

type CrmStatus = "skipped" | "pending" | "sent" | "failed";

type SiteRequest = {
  id: string;
  formName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  message: string | null;
  utm: Record<string, string>;
  pageUrl: string | null;
  crmStatus: CrmStatus;
  crmError: string | null;
  createdAt: string;
};

const CRM_LABEL: Record<Exclude<CrmStatus, "skipped">, string> = {
  pending: "Ждёт передачи",
  sent: "Передана",
  failed: "Ошибка"
};

const CRM_VARIANT: Record<Exclude<CrmStatus, "skipped">, "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  sent: "default",
  failed: "destructive"
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/** utm_source=ya, utm_campaign=spring → «ya · spring» */
function formatUtm(utm: Record<string, string>): string {
  const parts = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
    .map((key) => utm[key])
    .filter((value): value is string => Boolean(value));
  return parts.join(" · ");
}

export default function PartnerRequestsPage() {
  const [items, setItems] = useState<SiteRequest[]>([]);
  const [crmConnected, setCrmConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <PartnerShell currentPath="/partner/requests" title="Заявки">
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
                    {crmConnected ? <TableHead className="pr-6">CRM</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const utm = formatUtm(item.utm);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground pl-6 whitespace-nowrap tabular-nums">
                          {formatDate(item.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium">{item.customerName}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          <a
                            href={`tel:${item.customerPhone.replace(/[^\d+]/g, "")}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {item.customerPhone}
                          </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.formName}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[16rem] truncate">
                          {utm || "—"}
                        </TableCell>
                        {crmConnected ? (
                          <TableCell className="pr-6">
                            {item.crmStatus === "skipped" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <Badge
                                variant={CRM_VARIANT[item.crmStatus]}
                                title={item.crmError ?? undefined}
                              >
                                {CRM_LABEL[item.crmStatus]}
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
    </PartnerShell>
  );
}
