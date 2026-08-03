"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconFileDescription,
  IconKey,
  IconPlayerPause,
  IconPlayerPlay,
  IconUsers
} from "@tabler/icons-react";
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
  legalName: string | null;
  inn: string | null;
  email: string;
  phone: string;
  region: string;
  status: string;
  createdAt: string;
};

const partnerStatusLabels: Record<string, string> = {
  active: "Активен",
  pending: "Ожидает",
  suspended: "Приостановлен"
};

type DialogMode = "legal" | "create" | "password" | null;

export default function CompanyPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [legalName, setLegalName] = useState("");
  const [inn, setInn] = useState("");
  const [createForm, setCreateForm] = useState({
    companyName: "",
    fullName: "",
    email: "",
    phone: "",
    region: "",
    password: "",
    legalName: "",
    inn: ""
  });
  const [tempPassword, setTempPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const rows = await apiFetch<Partner[]>("/api/company/partners");
      setPartners(
        rows.map((row) => ({
          ...row,
          legalName: row.legalName ?? null,
          inn: row.inn ?? null
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить партнёров");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openLegal(partner: Partner) {
    setSelected(partner);
    setLegalName(partner.legalName ?? "");
    setInn(partner.inn ?? "");
    setDialog("legal");
  }

  function closeDialog() {
    if (saving) return;
    setDialog(null);
    setSelected(null);
    setTempPassword("");
  }

  async function handleSaveLegal() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await apiFetch<Partner>(`/api/company/partners/${selected.id}/legal`, {
        method: "PATCH",
        body: JSON.stringify({
          legalName: legalName.trim() || null,
          inn: inn.trim() || null
        })
      });
      setPartners((prev) =>
        prev.map((row) =>
          row.id === selected.id
            ? { ...row, legalName: updated.legalName ?? null, inn: updated.inn ?? null }
            : row
        )
      );
      toast.success("Юр. реквизиты обновлены");
      closeDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(partner: Partner, status: "active" | "suspended") {
    setBusyId(partner.id);
    try {
      const updated = await apiFetch<Partner>(`/api/company/partners/${partner.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setPartners((prev) =>
        prev.map((row) => (row.id === partner.id ? { ...row, status: updated.status } : row))
      );
      toast.success(status === "active" ? "Партнёр активирован" : "Партнёр приостановлен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить статус");
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetPassword(partner: Partner) {
    setBusyId(partner.id);
    try {
      const result = await apiFetch<{ temporaryPassword: string; email: string }>(
        `/api/company/partners/${partner.id}/reset-password`,
        { method: "POST", body: "{}" }
      );
      setSelected(partner);
      setTempPassword(result.temporaryPassword);
      setDialog("password");
      toast.success(`Пароль сброшен для ${result.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сбросить пароль");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate() {
    if (!createForm.email.trim() || !createForm.companyName.trim()) {
      toast.error("Укажите компанию и email");
      return;
    }
    setSaving(true);
    try {
      const result = await apiFetch<{
        created: boolean;
        temporaryPassword?: string;
        email: string;
      }>("/api/company/partners", {
        method: "POST",
        body: JSON.stringify({
          email: createForm.email.trim(),
          companyName: createForm.companyName.trim(),
          fullName: createForm.fullName.trim() || undefined,
          phone: createForm.phone.trim() || undefined,
          region: createForm.region.trim() || undefined,
          password: createForm.password.trim() || undefined,
          legalName: createForm.legalName.trim() || null,
          inn: createForm.inn.trim() || null
        })
      });
      const password = result.temporaryPassword;
      if (password) {
        toast.success("Партнёр создан", {
          description: `Пароль: ${password}`,
          duration: Infinity,
          closeButton: true,
          action: {
            label: "Скопировать",
            onClick: () => void navigator.clipboard.writeText(password)
          }
        });
      } else {
        toast.success("Партнёр создан");
      }
      setCreateForm({
        companyName: "",
        fullName: "",
        email: "",
        phone: "",
        region: "",
        password: "",
        legalName: "",
        inn: ""
      });
      setDialog(null);
      setLoading(true);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать партнёра");
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
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Список партнёров</CardTitle>
          <Button type="button" onClick={() => setDialog("create")}>
            Создать партнёра
          </Button>
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
                  Создайте партнёра вручную или одобрите заявку в разделе «Заявки».
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
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Реквизиты"
                            aria-label="Реквизиты"
                            onClick={() => openLegal(partner)}
                          >
                            <IconFileDescription />
                          </Button>
                          {partner.status === "suspended" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={busyId === partner.id}
                              title="Активировать"
                              aria-label="Активировать"
                              onClick={() => void handleStatus(partner, "active")}
                            >
                              <IconPlayerPlay />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={busyId === partner.id}
                              title="Приостановить"
                              aria-label="Приостановить"
                              onClick={() => void handleStatus(partner, "suspended")}
                            >
                              <IconPlayerPause />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={busyId === partner.id}
                            title="Сбросить пароль"
                            aria-label="Сбросить пароль"
                            onClick={() => void handleResetPassword(partner)}
                          >
                            <IconKey />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog === "legal"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Юр. реквизиты</DialogTitle>
            <DialogDescription>
              {selected
                ? `Партнёр «${selected.companyName}». Меняйте юр. название только по запросу и при документах.`
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={closeDialog}>
              Отмена
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSaveLegal()}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "create"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать партнёра</DialogTitle>
            <DialogDescription>
              Без заявки. Если пароль не указать — сгенерируем и покажем один раз.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="create-company">Компания</Label>
              <Input
                id="create-company"
                value={createForm.companyName}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, companyName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">Контакт</Label>
              <Input
                id="create-name"
                value={createForm.fullName}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email входа</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Телефон</Label>
              <Input
                id="create-phone"
                value={createForm.phone}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-region">Регион</Label>
              <Input
                id="create-region"
                value={createForm.region}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, region: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="create-password">Пароль (необязательно)</Label>
              <Input
                id="create-password"
                type="text"
                value={createForm.password}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Минимум 8 символов или пусто"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-legal">Юр. название</Label>
              <Input
                id="create-legal"
                value={createForm.legalName}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, legalName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-inn">ИНН</Label>
              <Input
                id="create-inn"
                value={createForm.inn}
                disabled={saving}
                onChange={(e) => setCreateForm((p) => ({ ...p, inn: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={closeDialog}>
              Отмена
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleCreate()}>
              {saving ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "password"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый пароль</DialogTitle>
            <DialogDescription>
              {selected
                ? `Владелец «${selected.companyName}». Пароль показывается один раз.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm break-all">
            {tempPassword}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(tempPassword)}
            >
              Скопировать
            </Button>
            <Button type="button" onClick={closeDialog}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
