"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconEye, IconEyeOff } from "@tabler/icons-react";

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

function ResetPasswordFormInner({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resultMessage, setResultMessage] = useState(
    token ? "" : "В ссылке нет токена. Запросите сброс пароля ещё раз."
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setResultMessage("В ссылке нет токена. Запросите сброс пароля ещё раз.");
      return;
    }
    if (password.length < 8) {
      setResultMessage("Пароль должен быть не короче 8 символов.");
      return;
    }
    if (password !== confirm) {
      setResultMessage("Пароли не совпадают.");
      return;
    }

    setLoading(true);
    setResultMessage("");

    try {
      await apiFetch("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });
      router.replace("/login");
    } catch (err) {
      setResultMessage(
        err instanceof Error ? err.message : "Не удалось сменить пароль. Попробуйте ещё раз."
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
                <h1 className="text-2xl font-bold">Новый пароль</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Придумайте пароль не короче 8 символов.
                </p>
              </div>
              <Field className="min-w-0">
                <FieldLabel htmlFor="password">Пароль</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    className="max-w-full pr-10"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    disabled={loading || !token}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md"
                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? (
                      <IconEyeOff className="size-4" />
                    ) : (
                      <IconEye className="size-4" />
                    )}
                  </button>
                </div>
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor="confirm">Повтор пароля</FieldLabel>
                <Input
                  id="confirm"
                  className="max-w-full"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={loading || !token}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={loading || !token}>
                  {loading ? "Сохранение..." : "Сохранить пароль"}
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

export function ResetPasswordForm(props: React.ComponentProps<"div">) {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground p-8 text-sm">Загрузка формы…</div>
      }
    >
      <ResetPasswordFormInner {...props} />
    </Suspense>
  );
}
