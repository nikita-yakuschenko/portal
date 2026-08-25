"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

export function ForgotPasswordForm({ className, ...props }: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResultMessage("");

    try {
      await apiFetch("/api/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setSent(true);
      setResultMessage("Письмо отправлено. Проверьте почту.");
    } catch (err) {
      setResultMessage(
        err instanceof Error ? err.message : "Не удалось отправить запрос. Попробуйте позже."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("w-full", className)} {...props}>
      <Card className="gap-0 border p-0 shadow-sm">
        <CardContent className="grid min-w-0 grid-cols-1 p-0 md:grid-cols-2">
          <form className="min-w-0 p-5 md:p-7" onSubmit={handleSubmit}>
            <FieldGroup className="gap-3.5">
              <div className="mb-1">
                <h1 className="text-2xl font-bold">Сброс пароля</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Укажите email входа — пришлём ссылку для нового пароля.
                </p>
              </div>
              <Field className="min-w-0">
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  className="max-w-full"
                  type="email"
                  placeholder="partner@company.ru"
                  autoComplete="email"
                  required
                  disabled={loading || sent}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={loading || sent}>
                  {loading ? "Отправка..." : sent ? "Запрос отправлен" : "Отправить ссылку"}
                </Button>
              </Field>
              {resultMessage ? (
                <p className="text-left text-sm text-muted-foreground">{resultMessage}</p>
              ) : null}
            </FieldGroup>
            <p className="mt-6 border-t border-border pt-5 text-left text-sm text-muted-foreground">
              <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                Вернуться ко входу
              </Link>
            </p>
          </form>
          <div className="relative hidden min-h-105 overflow-hidden rounded-r-xl bg-muted md:block">
            <img
              src="/landing/factory.jpg"
              alt="Производство Авангард Строй"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
