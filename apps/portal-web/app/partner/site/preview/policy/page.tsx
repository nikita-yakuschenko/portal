"use client";

import Link from "next/link";

import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import { previewPaths } from "@/lib/partner-site-preview";

export default function PartnerSitePolicyPage() {
  const { draft, partnerLegal } = usePartnerSitePreview();
  if (!draft) return null;

  const company =
    partnerLegal?.legalName ||
    partnerLegal?.companyName ||
    draft.name.trim() ||
    "Компания";
  const email = draft.contactEmail || draft.inquiryEmail;
  const phone = draft.contactPhone;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Политика конфиденциальности
      </h1>
      <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-600">
        <p>
          Настоящая политика описывает, как {company} обрабатывает персональные данные
          посетителей сайта при отправке заявок и обращений.
        </p>
        <p>
          Обрабатываются данные, которые вы указываете в формах: имя, телефон, адрес электронной
          почты и текст сообщения — в целях связи по вашему запросу и организации консультации.
        </p>
        <p>
          Данные не передаются третьим лицам, за исключением случаев, предусмотренных законом, и
          случаев, когда это нужно для исполнения вашего обращения (например, CRM-система
          партнёра).
        </p>
        {(email || phone) && (
          <p>
            По вопросам обработки персональных данных:{" "}
            {email ? (
              <a href={`mailto:${email}`} className="text-avgst-green hover:underline">
                {email}
              </a>
            ) : null}
            {email && phone ? " · " : null}
            {phone ? (
              <a href={`tel:${phone}`} className="text-avgst-green hover:underline">
                {phone}
              </a>
            ) : null}
            .
          </p>
        )}
      </div>
      <p className="mt-10">
        <Link href={previewPaths.home} className="text-sm font-medium text-avgst-green hover:underline">
          На главную
        </Link>
      </p>
    </div>
  );
}
