"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

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

type Partner = {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  region: string;
  status: string;
  createdAt: string;
};

// Значения partner_status на стороне API: pending | active | suspended
const partnerStatusLabels: Record<string, string> = {
  active: "Активен",
  pending: "Ожидает",
  suspended: "Приостановлен"
};

export default function CompanyPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setPartners(await apiFetch<Partner[]>("/api/company/partners"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить партнёров");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/partners"
      navigation={companyNavigation}
    >
      <PageAlert message={error} variant="destructive" />

      <Card>
        <CardHeader>
          <CardTitle>Список партнёров</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-12 w-full" />
              ))}
            </div>
          ) : partners.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>Партнёров пока нет</EmptyTitle>
                <EmptyDescription>
                  Партнёр появляется в списке после одобрения заявки в разделе «Заявки».
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Компания</TableHead>
                    <TableHead>Регион</TableHead>
                    <TableHead>Контакты</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Подключён</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.companyName}</TableCell>
                      <TableCell>{partner.region}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{partner.email}</span>
                          <span className="text-muted-foreground text-xs">
                            {partner.phone || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={partner.status === "active" ? "default" : "secondary"}>
                          {partnerStatusLabels[partner.status] ?? partner.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(partner.createdAt).toLocaleDateString("ru-RU")}
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
