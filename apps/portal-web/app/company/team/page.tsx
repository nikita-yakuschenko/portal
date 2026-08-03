"use client";

import { useCallback, useEffect, useState } from "react";
import { IconUserPlus, IconUsers } from "@tabler/icons-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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

type TeamUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
};

const roleLabel: Record<string, string> = {
  company_admin: "Администратор",
  company_manager: "Менеджер"
};

export default function CompanyTeamPage() {
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "company_manager" as "company_admin" | "company_manager"
  });

  const load = useCallback(async () => {
    try {
      setError("");
      const [session, rows] = await Promise.all([
        apiFetch<{ user: { id: string; role: string } }>("/api/auth/session"),
        apiFetch<TeamUser[]>("/api/company/team")
      ]);
      setSelfId(session.user.id);
      setCanManage(session.user.role === "company_admin");
      setTeam(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить команду");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/company/team", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({
        fullName: "",
        email: "",
        password: "",
        role: "company_manager"
      });
      toast.success("Сотрудник добавлен");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: TeamUser) {
    try {
      await apiFetch(`/api/company/team/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !user.isActive })
      });
      toast.success(user.isActive ? "Доступ отключён" : "Доступ включён");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить");
    }
  }

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/team"
      navigation={companyNavigation}
    >
      <PageAlert message={error} variant="destructive" />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Команда завода</CardTitle>
            <CardDescription>Сотрудники кабинета управления дилерской сетью.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((row) => (
                  <Skeleton key={row} className="h-12 w-full" />
                ))}
              </div>
            ) : team.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconUsers />
                  </EmptyMedia>
                  <EmptyTitle>Пока никого нет</EmptyTitle>
                  <EmptyDescription>Добавьте администратора или менеджера завода.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Статус</TableHead>
                      {canManage ? <TableHead className="w-[1%]" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.fullName}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{roleLabel[user.role] ?? user.role}</TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? "Активен" : "Отключён"}
                          </Badge>
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={user.id === selfId}
                              onClick={() => void toggleActive(user)}
                            >
                              {user.isActive ? "Отключить" : "Включить"}
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUserPlus className="size-5" />
              Добавить сотрудника
            </CardTitle>
            <CardDescription>
              {canManage
                ? "Доступно только администратору завода."
                : "Добавлять сотрудников может только администратор."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <form className="space-y-4" onSubmit={(e) => void handleCreate(e)}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="hq-name">ФИО</FieldLabel>
                    <Input
                      id="hq-name"
                      required
                      value={form.fullName}
                      disabled={saving}
                      onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="hq-email">Email</FieldLabel>
                    <Input
                      id="hq-email"
                      type="email"
                      required
                      value={form.email}
                      disabled={saving}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="hq-password">Пароль</FieldLabel>
                    <Input
                      id="hq-password"
                      type="text"
                      required
                      minLength={8}
                      value={form.password}
                      disabled={saving}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Роль</FieldLabel>
                    <Select
                      value={form.role}
                      disabled={saving}
                      onValueChange={(value) =>
                        setForm((p) => ({
                          ...p,
                          role: value as "company_admin" | "company_manager"
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company_manager">Менеджер</SelectItem>
                        <SelectItem value="company_admin">Администратор</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Spinner className="size-4" />
                      Сохранение…
                    </>
                  ) : (
                    "Добавить"
                  )}
                </Button>
              </form>
            ) : (
              <p className="text-muted-foreground text-sm">
                Войдите под учётной записью администратора, чтобы управлять командой.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
