"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";

export default function PartnerSiteContactsPage() {
  const { draft, socials } = usePartnerSitePreview();
  if (!draft) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Контакты</h1>
      <p className="mt-3 max-w-xl text-base text-slate-600">
        Напишите или позвоните — ответим по проектам, срокам и стоимости строительства.
      </p>

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

        <form
          className="space-y-4 rounded-none border border-slate-200 bg-white p-6"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <p className="text-lg font-semibold tracking-tight">Заявка</p>
          <p className="text-sm text-slate-500">
            В превью форма не отправляется. На опубликованном сайте заявки уйдут на{" "}
            {draft.inquiryEmail || draft.contactEmail || "ваш email"}.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Имя</Label>
            <Input id="contact-name" placeholder="Как к вам обращаться" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">Телефон</Label>
            <Input id="contact-phone" placeholder="+7 ..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-msg">Сообщение</Label>
            <Textarea id="contact-msg" rows={4} placeholder="Интересующий проект или вопрос" />
          </div>
          <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">
            {draft.ctaLabel || "Отправить"}
          </Button>
        </form>
      </div>
    </div>
  );
}
