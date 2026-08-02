"use client";

import { useCallback, useEffect, useState } from "react";
import { IconHelpCircle, IconSend } from "@tabler/icons-react";
import { toast } from "sonner";

import { PartnerShell } from "@/components/partner-shell";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

type Inquiry = {
  id: string;
  subject: string;
  message: string;
  status?: string | null;
  createdAt: string;
};

export default function PartnerInquiriesPage() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });

  const load = useCallback(async () => {
    try {
      setError("");
      setItems(await apiFetch<Inquiry[]>("/api/partner/inquiries"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить запросы");
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
      await apiFetch("/api/partner/inquiries", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ subject: "", message: "" });
      toast.success("Запрос отправлен на завод");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить запрос");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PartnerShell currentPath="/partner/inquiries">
      <PageAlert message={error} variant="destructive" />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Запросы на завод</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((row) => (
                  <Skeleton key={row} className="h-20 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconHelpCircle />
                  </EmptyMedia>
                  <EmptyTitle>Запросов пока нет</EmptyTitle>
                  <EmptyDescription>
                    Спросите завод о комплектации, сроках или документации — ответ придёт вашему
                    менеджеру.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="divide-border divide-y">
                {items.map((item) => (
                  <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{item.subject}</p>
                      <Badge variant="secondary">{item.status ?? "new"}</Badge>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-line">{item.message}</p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {new Date(item.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Новый запрос</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="subject">Тема</FieldLabel>
                  <Input
                    id="subject"
                    required
                    value={form.subject}
                    onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="Комплектация / сроки / материалы"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="message">Сообщение</FieldLabel>
                  <Textarea
                    id="message"
                    required
                    rows={8}
                    value={form.message}
                    onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  />
                </Field>
                <Field>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Spinner /> : <IconSend />}
                    {saving ? "Отправляем…" : "Отправить на завод"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </PartnerShell>
  );
}
