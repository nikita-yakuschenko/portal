"use client";

import { useState } from "react";
import Link from "next/link";
import { IconCheck } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";

/**
 * Заявка дилера заводу. Уходит в мессенджер обычным запросом — там её видит
 * менеджер завода, и там же остаётся переписка. Отдельного «ящика заявок»,
 * который никто не читает, заводить не стали.
 */
export function FactoryRequestCard({
  subject,
  title,
  description
}: {
  subject: string;
  title: string;
  description: string;
}) {
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<{ city?: string; phone?: string }>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: { city?: string; phone?: string } = {};
    if (!city.trim()) found.city = "Укажите город — от него зависит логистика.";
    if (phone.replace(/\D/g, "").length < 10) found.phone = "Проверьте номер телефона.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSending(true);
    try {
      const lines = [
        `Город: ${city.trim()}`,
        `Телефон: ${phone.trim()}`,
        comment.trim() ? `Комментарий: ${comment.trim()}` : null
      ].filter(Boolean);

      await apiFetch("/api/partner/inquiries", {
        method: "POST",
        body: JSON.stringify({ subject: `${subject}: запрос расчёта`, message: lines.join("\n") })
      });
      setSent(true);
      toast.success("Запрос отправлен", { description: "Ответ придёт в мессенджер." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить запрос");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
            <IconCheck className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-medium">Запрос отправлен</p>
            <p className="text-muted-foreground text-sm">
              Менеджер завода ответит в мессенджере — там же останется вся переписка.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/partner/messenger">Открыть мессенджер</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <Field data-invalid={Boolean(errors.city)}>
            <FieldLabel htmlFor="factory-city">Город</FieldLabel>
            <Input
              id="factory-city"
              value={city}
              aria-invalid={Boolean(errors.city)}
              placeholder="Нижний Новгород"
              onChange={(event) => setCity(event.target.value)}
            />
            <FieldError>{errors.city}</FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.phone)}>
            <FieldLabel htmlFor="factory-phone">Телефон</FieldLabel>
            <Input
              id="factory-phone"
              type="tel"
              value={phone}
              aria-invalid={Boolean(errors.phone)}
              placeholder="+7 900 000-00-00"
              onChange={(event) => setPhone(event.target.value)}
            />
            <FieldError>{errors.phone}</FieldError>
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="factory-comment">Что нужно посчитать</FieldLabel>
            <Textarea
              id="factory-comment"
              rows={3}
              value={comment}
              placeholder="Размеры, объём, сроки — всё, что поможет посчитать точнее"
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={sending}>
              {sending ? "Отправляем…" : "Отправить запрос"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
