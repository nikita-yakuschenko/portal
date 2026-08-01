"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, Users } from "lucide-react";

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
import { partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";

type TeamUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
};

type MeResponse = {
  user: { role: string };
};

const roleLabel: Record<string, string> = {
  partner_owner: "Владелец",
  partner_member: "Сотрудник"
};

export default function PartnerTeamPage() {
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "partner_member" as "partner_owner" | "partner_member"
  });

  const load = useCallback(async () => {
    try {
      setError("");
      const [rows, me] = await Promise.all([
        apiFetch<TeamUser[]>("/api/partner/team"),
        apiFetch<MeResponse>("/api/partner/me")
      ]);
      setTeam(rows);
      setCanManage(me.user.role === "partner_owner");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить сотрудников");
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
    setNotice("");
    try {
      await apiFetch("/api/partner/team", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ fullName: "", email: "", password: "", role: "partner_member" });
      setNotice("Сотрудник добавлен.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить сотрудника");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath="/partner/team"
      navigation={partnerNavigation}
    >
      <PageAlert message={error} variant="destructive" />
      <PageAlert message={notice} />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Команда</CardTitle>
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
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>Сотрудников пока нет</EmptyTitle>
                  <EmptyDescription>
                    Добавьте сотрудников, чтобы они работали с каталогом и лидами.
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
                          <Badge variant={user.isActive ? "default" : "secondary"}>
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
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="fullName">ФИО</FieldLabel>
                    <Input
                      id="fullName"
                      required
                      value={form.fullName}
                      onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Пароль</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="role">Роль</FieldLabel>
                    <Select
                      value={form.role}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          role: value as "partner_owner" | "partner_member"
                        }))
                      }
                    >
                      <SelectTrigger id="role" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="partner_member">Сотрудник</SelectItem>
                        <SelectItem value="partner_owner">Владелец</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <Button type="submit" disabled={saving}>
                      {saving ? <Spinner /> : <UserPlus />}
                      {saving ? "Сохраняем…" : "Добавить"}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}
