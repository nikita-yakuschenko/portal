"use client";

import { useEffect, useState } from "react";
import { IconUsers } from "@tabler/icons-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  legalName?: string | null;
  inn?: string | null;
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
  const [editing, setEditing] = useState<Partner | null>(null);
  const [legalName, setLegalName] = useState("");
  const [inn, setInn] = useState("");
  const [saving, setSaving] = useState(false);

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

  function openLegalDialog(partner: Partner) {
    setEditing(partner);
    setLegalName(partner.legalName ?? "");
    setInn(partner.inn ?? "");
  }

  async function handleSaveLegal() {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await apiFetch<Partner>(
        `/api/company/partners/${editing.id}/legal`,
        {
          method: "PATCH",
          body: JSON.stringify({
            legalName: legalName.trim() || null,
            inn: inn.trim() || null
          })
        }
      );
      setPartners((prev) =>
        prev.map((row) =>
          row.id === editing.id
            ? { ...row, legalName: updated.legalName, inn: updated.inn }
            : row
        )
      );
      setEditing(null);
      toast.success("Юр. реквизиты обновлены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

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
                  <IconUsers />
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
                    <TableHead>Юр. реквизиты</TableHead>
                    <TableHead>Регион</TableHead>
                    <TableHead>Контакты</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Подключён</TableHead>
                    <TableHead className="w-[1%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.companyName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span>{partner.legalName?.trim() || "—"}</span>
                          <span className="text-muted-foreground text-xs">
                            ИНН {partner.inn?.trim() || "—"}
                          </span>
                        </div>
                      </TableCell>
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
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openLegalDialog(partner)}
                        >
                          Реквизиты
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Юр. реквизиты</DialogTitle>
            <DialogDescription>
              {editing
                ? `Партнёр «${editing.companyName}». Меняйте юр. название только по запросу и при документах о смене юрлица.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="legal-name">Юр. название</Label>
              <Input
                id="legal-name"
                value={legalName}
                disabled={saving}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="ООО «…»"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-inn">ИНН</Label>
              <Input
                id="legal-inn"
                value={inn}
                disabled={saving}
                inputMode="numeric"
                onChange={(e) => setInn(e.target.value)}
                placeholder="10 или 12 цифр"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Отмена
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSaveLegal()}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
