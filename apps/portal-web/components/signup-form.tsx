"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const INTEREST_OPTIONS = [
  { id: "modular" as const, label: "Модульные домокомплекты" },
  { id: "panel_frame" as const, label: "Панельно-каркасные домокомплекты" },
  { id: "farms" as const, label: "Строительные фермы" }
];

type InterestId = (typeof INTEREST_OPTIONS)[number]["id"];

type FormState = {
  inn: string;
  companyName: string;
  contactName: string;
  email: string;
  region: string;
  interests: InterestId[];
  message: string;
};

const initialState: FormState = {
  inn: "",
  companyName: "",
  contactName: "",
  email: "",
  region: "",
  interests: [],
  message: ""
};

export function SignupForm({ className, ...props }: React.ComponentProps<"div">) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [animKey, setAnimKey] = useState(0);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleInterest(id: InterestId, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      interests: checked ? [...prev.interests, id] : prev.interests.filter((item) => item !== id)
    }));
  }

  function goToStep(next: 1 | 2) {
    setStep(next);
    setAnimKey((key) => key + 1);
  }

  function goNext(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{10}(\d{2})?$/.test(form.inn)) {
      setStatus("error");
      setMessage("ИНН должен содержать 10 или 12 цифр.");
      return;
    }
    setStatus("idle");
    setMessage("");
    goToStep(2);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.interests.length === 0) {
      setStatus("error");
      setMessage("Выберите хотя бы одно направление.");
      return;
    }

    setStatus("loading");
    setMessage("Отправляем заявку...");

    try {
      const response = await fetch(`${apiBaseUrl}/api/public/partner-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inn: form.inn,
          companyName: form.companyName,
          contactName: form.contactName,
          email: form.email,
          region: form.region,
          interests: form.interests,
          message: form.message || undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string; formErrors?: string[] }
          | null;
        setStatus("error");
        setMessage(
          payload?.message ??
            payload?.formErrors?.[0] ??
            "Не удалось отправить заявку. Проверьте данные и попробуйте снова."
        );
        return;
      }

      setStatus("success");
      setMessage("Заявка принята. После проверки откроем доступ в кабинет.");
      setForm(initialState);
      goToStep(1);
    } catch {
      setStatus("error");
      setMessage("Не удалось связаться с API. Проверьте, что запущен npm run dev:api.");
    }
  }

  return (
    <div className={cn("w-full min-w-0", className)} {...props}>
      <Card className="gap-0 border p-0 shadow-sm">
        <CardContent className="grid min-w-0 grid-cols-1 p-0 md:grid-cols-2">
          <div className="min-w-0 p-5 md:p-7">
            <div className="mb-4">
              <h1 className="text-2xl font-bold">Регистрация</h1>
              <p className="mt-1 text-sm text-muted-foreground">Шаг {step} из 2</p>
            </div>

            <div key={animKey} className="signup-step-enter min-w-0">
              {step === 1 ? (
                <form onSubmit={goNext}>
                  <FieldGroup className="gap-3.5">
                    <Field className="min-w-0">
                      <FieldLabel htmlFor="inn">ИНН</FieldLabel>
                      <Input
                        id="inn"
                        className="max-w-full"
                        inputMode="numeric"
                        pattern="\d{10}|\d{12}"
                        maxLength={12}
                        placeholder="10 или 12 цифр"
                        required
                        value={form.inn}
                        onChange={(event) =>
                          updateField("inn", event.target.value.replace(/\D/g, "").slice(0, 12))
                        }
                      />
                    </Field>
                    <Field className="min-w-0">
                      <FieldLabel htmlFor="companyName">Название компании</FieldLabel>
                      <Input
                        id="companyName"
                        className="max-w-full"
                        required
                        value={form.companyName}
                        onChange={(event) => updateField("companyName", event.target.value)}
                      />
                    </Field>
                    <Field className="min-w-0">
                      <FieldLabel htmlFor="contactName">Контактное лицо</FieldLabel>
                      <Input
                        id="contactName"
                        className="max-w-full"
                        required
                        value={form.contactName}
                        onChange={(event) => updateField("contactName", event.target.value)}
                      />
                    </Field>
                    <Field className="min-w-0">
                      <FieldLabel htmlFor="email">Почта</FieldLabel>
                      <Input
                        id="email"
                        className="max-w-full"
                        type="email"
                        placeholder="partner@company.ru"
                        required
                        value={form.email}
                        onChange={(event) => updateField("email", event.target.value)}
                      />
                    </Field>
                    <Field>
                      <Button type="submit" className="w-full">
                        Далее
                      </Button>
                    </Field>
                  </FieldGroup>
                </form>
              ) : (
                <form onSubmit={handleSubmit}>
                  <FieldGroup className="gap-3.5">
                    <Field className="min-w-0">
                      <FieldLabel htmlFor="region">Регион</FieldLabel>
                      <Input
                        id="region"
                        className="max-w-full"
                        required
                        value={form.region}
                        onChange={(event) => updateField("region", event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Что интересует</FieldLabel>
                      <div className="grid gap-2.5 pt-1">
                        {INTEREST_OPTIONS.map((option) => {
                          const checked = form.interests.includes(option.id);
                          return (
                            <label
                              key={option.id}
                              htmlFor={option.id}
                              className="flex cursor-pointer items-start gap-2.5 text-sm"
                            >
                              <Checkbox
                                id={option.id}
                                className="mt-0.5"
                                checked={checked}
                                onCheckedChange={(value) =>
                                  toggleInterest(option.id, value === true)
                                }
                              />
                              <span className="leading-snug">{option.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </Field>
                    <Field className="min-w-0">
                      <FieldLabel htmlFor="message">Комментарий</FieldLabel>
                      <textarea
                        id="message"
                        rows={2}
                        className="flex min-h-[56px] w-full max-w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        value={form.message}
                        onChange={(event) => updateField("message", event.target.value)}
                      />
                    </Field>
                    <Field className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" onClick={() => goToStep(1)}>
                        Назад
                      </Button>
                      <Button type="submit" disabled={status === "loading"}>
                        {status === "loading" ? "Отправка..." : "Отправить"}
                      </Button>
                    </Field>
                  </FieldGroup>
                </form>
              )}
            </div>

            {message ? (
              <p
                className={cn(
                  "mt-4 text-sm text-left",
                  status === "error" && "text-destructive",
                  status === "success" && "text-primary"
                )}
              >
                {message}
              </p>
            ) : null}

            <p className="mt-6 border-t border-border pt-5 text-left text-sm text-muted-foreground">
              Уже есть доступ?{" "}
              <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                Войти в кабинет
              </Link>
            </p>
          </div>

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
