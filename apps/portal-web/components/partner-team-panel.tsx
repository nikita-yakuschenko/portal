"use client";

import { useCallback, useEffect, useState } from "react";
import { IconUserPlus, IconUsers } from "@tabler/icons-react";
import { toast } from "sonner";

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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

type TeamUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
};

const roleLabel: Record<string, string> = {
  partner_owner: "Владелец",
  partner_member: "Сотрудник"
};

export function PartnerTeamPanel({ canManage }: { canManage: boolean }) {
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: ""
  });

  const load = useCallback(async () => {
    try {
      const rows = await apiFetch<TeamUser[]>("/api/partner/team");
      setTeam(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить сотрудников");
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
      await apiFetch("/api/partner/team", {
        method: "POST",
        body: JSON.stringify({ ...form, role: "partner_member" })
      });
      setForm({ fullName: "", email: "", password: "" });
      toast.success("Сотрудник добавлен");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить сотрудника");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 md:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Сотрудники</CardTitle>
          <CardDescription>Доступ к кабинету для команды партнёра.</CardDescription>
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
                <EmptyTitle>Сотрудников пока нет</EmptyTitle>
                <EmptyDescription>
                  Добавьте сотрудников.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Доступ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.fullName}</span>
                          <span className="text-muted-foreground text-xs">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{roleLabel[user.role] ?? user.role}</TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "secondary" : "outline"}>
                          {user.isActive ? "Активен" : "Отключён"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Добавить сотрудника</CardTitle>
            <CardDescription>
              Новый человек получит роль «Сотрудник». Владельца кабинета так назначить нельзя.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void handleCreate(event)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="team-fullName">ФИО</FieldLabel>
                  <Input
                    id="team-fullName"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="team-email">Email</FieldLabel>
                  <Input
                    id="team-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="team-password">Пароль</FieldLabel>
                  <Input
                    id="team-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  <FieldDescription>Не меньше 8 символов.</FieldDescription>
                </Field>
                <Field>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Spinner /> : <IconUserPlus />}
                    {saving ? "Сохраняем…" : "Добавить"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
