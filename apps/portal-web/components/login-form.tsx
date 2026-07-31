"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type LoginUser = {
  role: "company_admin" | "company_manager" | "partner_owner" | "partner_member";
};

function cabinetPathForRole(role: LoginUser["role"]) {
  if (role === "company_admin" || role === "company_manager") {
    return "/company";
  }
  return "/partner";
}

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail] = useState("admin@avgst.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [resultMessage, setResultMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResultMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setResultMessage(payload?.message ?? "Не удалось выполнить вход.");
        return;
      }

      const payload = (await response.json()) as { user: LoginUser };
      router.replace(cabinetPathForRole(payload.user.role));
    } catch {
      setResultMessage("Не удалось связаться с API. Проверьте, что запущен npm run dev:api.");
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
                <h1 className="text-2xl font-bold">Вход</h1>
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor="password">Пароль</FieldLabel>
                <Input
                  id="password"
                  className="max-w-full"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Вход..." : "Войти в кабинет"}
                </Button>
              </Field>
              {resultMessage ? (
                <p className="text-left text-sm text-muted-foreground">{resultMessage}</p>
              ) : null}
            </FieldGroup>
            <p className="mt-6 border-t border-border pt-5 text-left text-sm text-muted-foreground">
              Нет доступа?{" "}
              <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
                Регистрация
              </Link>
            </p>
          </form>
          <div className="relative hidden min-h-[420px] overflow-hidden rounded-r-xl bg-muted md:block">
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
