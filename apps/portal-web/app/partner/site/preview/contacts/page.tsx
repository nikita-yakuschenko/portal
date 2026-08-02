"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/partner-site/phone-input";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { isValidRuMobile, toRuMobileE164 } from "@/lib/ru-phone";

function ContactsContent() {
  const searchParams = useSearchParams();
  const { draft, projects, socials } = usePartnerSitePreview();
  const projectId = searchParams.get("project");
  const project = useMemo(
    () => (projectId ? projects.find((item) => item.id === projectId) : null),
    [projects, projectId]
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);

  if (!draft) return null;

  const messagePlaceholder = project
    ? `Интересует проект «${project.name}». Нужен расчёт стоимости и сроки.`
    : "Интересующий проект или вопрос";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPhoneTouched(true);

    if (!name.trim()) {
      toast.error("Укажите имя");
      return;
    }
    if (!isValidRuMobile(phone)) {
      toast.error("Укажите корректный мобильный номер");
      return;
    }

    toast.success("Заявка принята", {
      description: `В превью форма не отправляется (${toRuMobileE164(phone)}).`
    });
    setName("");
    setPhone("");
    setMessage("");
    setPhoneTouched(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Контакты</h1>
      <p className="mt-3 max-w-xl text-base text-slate-600">
        Напишите или позвоните — ответим по проектам, срокам и стоимости строительства.
      </p>
      {project ? (
        <p className="mt-2 text-sm font-medium text-avgst-green">
          Заявка по проекту «{project.name}»
        </p>
      ) : null}

      <div className="mt-10 grid gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <p className="text-sm text-slate-500">Телефон</p>
            {draft.contactPhone ? (
              <a
                href={`tel:${draft.contactPhone}`}
                className="mt-1 block text-lg font-medium hover:underline"
              >
                {draft.contactPhone}
              </a>
            ) : (
              <p className="mt-1 text-lg font-medium">—</p>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-500">Email</p>
            {draft.contactEmail ? (
              <a
                href={`mailto:${draft.contactEmail}`}
                className="mt-1 block text-lg font-medium hover:underline"
              >
                {draft.contactEmail}
              </a>
            ) : (
              <p className="mt-1 text-lg font-medium">—</p>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-500">Адрес / город</p>
            <p className="mt-1 text-lg font-medium">{draft.address || "—"}</p>
          </div>
          {socials.length > 0 ? (
            <div>
              <p className="text-sm text-slate-500">Соцсети</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm font-medium">
                {socials.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6" onSubmit={handleSubmit}>
          <p className="text-lg font-semibold tracking-tight">Заявка</p>
          <p className="text-sm text-slate-500">
            В превью форма не отправляется. На опубликованном сайте заявки уйдут на{" "}
            {draft.inquiryEmail || draft.contactEmail || "ваш email"}.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Имя</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к вам обращаться"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">Телефон</Label>
            <PhoneInput
              id="contact-phone"
              value={phone}
              onChange={setPhone}
              showError={phoneTouched}
              onBlur={() => setPhoneTouched(true)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-msg">Сообщение</Label>
            <Textarea
              id="contact-msg"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={messagePlaceholder}
            />
          </div>
          <Button
            type="submit"
            className="w-fit rounded-md bg-avgst-yellow px-5 font-bold text-slate-950 hover:bg-avgst-yellow/90"
          >
            Отправить заявку
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function PartnerSiteContactsPage() {
  return (
    <Suspense fallback={<div className="min-h-40 px-6 py-12" aria-busy="true" />}>
      <ContactsContent />
    </Suspense>
  );
}
