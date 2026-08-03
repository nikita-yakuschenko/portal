"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/partner-site/phone-input";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { isValidRuMobile } from "@/lib/ru-phone";

/** Блок контактов витрины — перед подвалом */
export function HomeContactsSection({
  projectId,
  projectName
}: {
  projectId?: string;
  projectName?: string;
} = {}) {
  const { draft, submitLead } = usePartnerSitePreview();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!draft) return null;

  const contactPhone = draft.contactPhone.trim();
  const contactEmail = draft.contactEmail.trim();
  const address = draft.address.trim();
  const hasDetails = Boolean(contactPhone || contactEmail || address);

  async function handleSubmit(event: React.FormEvent) {
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

    setSubmitting(true);
    try {
      const payload: {
        customerName: string;
        customerPhone: string;
        message?: string;
        projectId?: string;
      } = {
        customerName: name.trim(),
        customerPhone: phone
      };
      const msg = message.trim();
      if (msg) payload.message = msg;
      else if (projectName?.trim()) {
        payload.message = `Вопрос по проекту «${projectName.trim()}»`;
      }
      if (projectId) payload.projectId = projectId;
      await submitLead(payload);
      toast.success("Заявка отправлена", {
        description: "Мы свяжемся с вами в ближайшее время."
      });
      setName("");
      setPhone("");
      setMessage("");
      setPhoneTouched(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить заявку");
    } finally {
      setSubmitting(false);
    }
  }

  const form = (
    <form
      className="space-y-4 rounded-2xl border border-slate-200 bg-[#F5F6F8] p-6 sm:p-8"
      onSubmit={handleSubmit}
    >
      <div>
        <p className="text-lg font-semibold tracking-tight">Есть вопрос?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Оставьте контакты — перезвоним и поможем с выбором проекта, сроками и стоимостью.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="home-contact-name">Имя</Label>
        <Input
          id="home-contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как к вам обращаться"
          autoComplete="name"
          required
          className="bg-white"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="home-contact-phone">Телефон</Label>
        <PhoneInput
          id="home-contact-phone"
          value={phone}
          onChange={setPhone}
          showError={phoneTouched}
          onBlur={() => setPhoneTouched(true)}
          className="bg-white"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="home-contact-msg">Сообщение</Label>
        <Textarea
          id="home-contact-msg"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Интересующий проект или вопрос"
          className="resize-none bg-white"
        />
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className="h-10 w-44 rounded-md bg-avgst-yellow text-sm font-semibold text-slate-950 hover:bg-avgst-yellow/90"
      >
        {submitting ? "Отправка…" : "Задать вопрос"}
      </Button>
    </form>
  );

  return (
    <section id="contacts" className="scroll-mt-28 border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        {hasDetails ? (
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-avgst-green uppercase">
                Связаться
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight uppercase md:text-3xl">
                Контакты
              </h2>
              <p className="mt-3 max-w-xl text-base text-slate-600">
                Напишите или позвоните — ответим по проектам, срокам и стоимости строительства.
              </p>

              <div className="mt-8 space-y-6">
                {contactPhone ? (
                  <div>
                    <p className="text-sm text-slate-500">Телефон</p>
                    <a
                      href={`tel:${contactPhone}`}
                      className="mt-1 block text-lg font-medium tabular-nums hover:underline"
                    >
                      {contactPhone}
                    </a>
                  </div>
                ) : null}
                {contactEmail ? (
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <a
                      href={`mailto:${contactEmail}`}
                      className="mt-1 block text-lg font-medium hover:underline"
                    >
                      {contactEmail}
                    </a>
                  </div>
                ) : null}
                {address ? (
                  <div>
                    <p className="text-sm text-slate-500">Адрес / город</p>
                    <p className="mt-1 text-lg font-medium">{address}</p>
                  </div>
                ) : null}
              </div>
            </div>

            {form}
          </div>
        ) : (
          <div className="mx-auto max-w-xl">
            <p className="text-xs font-bold tracking-[0.2em] text-avgst-green uppercase">
              Связаться
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight uppercase md:text-3xl">
              Контакты
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Напишите или позвоните — ответим по проектам, срокам и стоимости строительства.
            </p>
            <div className="mt-8">{form}</div>
          </div>
        )}
      </div>
    </section>
  );
}
