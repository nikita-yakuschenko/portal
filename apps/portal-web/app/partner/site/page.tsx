"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DashboardShell } from "../../../components/dashboard-shell";
import { apiFetch } from "@/lib/api";
import { partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";
import {
  savePartnerSiteDraft,
  type PartnerSiteDraft
} from "@/lib/partner-site-draft";

type MeResponse = {
  partner: {
    companyName: string;
    region: string;
    email: string;
    phone: string;
  } | null;
};

const emptyForm: PartnerSiteDraft = {
  name: "",
  subdomain: "",
  domain: "",
  contactPhone: "",
  contactEmail: "",
  address: "",
  seoTitle: "",
  seoDescription: "",
  yandexMetrika: "",
  gtmId: "",
  ctaLabel: "Запросить цену",
  inquiryEmail: ""
};

export default function PartnerSitePage() {
  const [form, setForm] = useState<PartnerSiteDraft>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiFetch<MeResponse>("/api/partner/me");
        const partner = me.partner;
        if (partner) {
          const slug = partner.companyName
            .toLowerCase()
            .replace(/[^a-zа-яё0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 32);
          const next: PartnerSiteDraft = {
            name: partner.companyName,
            subdomain: slug || "partner",
            domain: "",
            contactPhone: partner.phone,
            contactEmail: partner.email,
            address: partner.region,
            seoTitle: `${partner.companyName} — модульные и панельно-каркасные дома`,
            seoDescription: `Официальный сайт дилера ${partner.companyName}. Каталог проектов AVGST.`,
            yandexMetrika: "",
            gtmId: "",
            ctaLabel: "Запросить цену",
            inquiryEmail: partner.email
          };
          setForm(next);
          savePartnerSiteDraft(next);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить данные сайта");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateField<K extends keyof PartnerSiteDraft>(key: K, value: PartnerSiteDraft[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    savePartnerSiteDraft(form);
    setNotice(
      "Настройки сайта сохранены в черновик. Публикация и синхронизация с runtime — в релизе 01.09."
    );
  }

  function openPreview() {
    savePartnerSiteDraft(form);
    window.open("/partner/site/preview", "_blank", "noopener,noreferrer");
  }

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath="/partner/site"
      navigation={partnerNavigation}
      title="Сайт"
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-slate-700">{notice}</p> : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            Админка публичного сайта: бренд и контакты дилера. Каталог и фото — с завода; цены и
            допы задаются в разделе «Цены».
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Черновик · тестовый режим</Badge>
          <Button type="button" variant="outline" onClick={openPreview} disabled={loading}>
            Открыть предпросмотр
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Загрузка...</p>
      ) : (
        <form className="space-y-6" onSubmit={handleSave}>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Адрес сайта</h2>
            <p className="mt-1 text-sm text-slate-500">
              Поддомен на платформе AVGST или собственный домен.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="site-name">Название сайта</Label>
                <Input
                  id="site-name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-subdomain">Поддомен</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="site-subdomain"
                    value={form.subdomain}
                    onChange={(e) => updateField("subdomain", e.target.value)}
                    required
                  />
                  <span className="shrink-0 text-sm text-slate-500">.avgst.ru</span>
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="site-domain">Свой домен (опционально)</Label>
                <Input
                  id="site-domain"
                  placeholder="doma-partner.ru"
                  value={form.domain}
                  onChange={(e) => updateField("domain", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Контакты и бренд</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="site-phone">Телефон</Label>
                <Input
                  id="site-phone"
                  value={form.contactPhone}
                  onChange={(e) => updateField("contactPhone", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-email">Email</Label>
                <Input
                  id="site-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => updateField("contactEmail", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="site-address">Адрес / регион</Label>
                <Input
                  id="site-address"
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">SEO</h2>
            <div className="mt-4 grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="site-seo-title">Title</Label>
                <Input
                  id="site-seo-title"
                  value={form.seoTitle}
                  onChange={(e) => updateField("seoTitle", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-seo-description">Description</Label>
                <Textarea
                  id="site-seo-description"
                  rows={3}
                  value={form.seoDescription}
                  onChange={(e) => updateField("seoDescription", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Аналитика и CTA</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="site-metrika">Яндекс.Метрика</Label>
                <Input
                  id="site-metrika"
                  placeholder="Номер счётчика"
                  value={form.yandexMetrika}
                  onChange={(e) => updateField("yandexMetrika", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-gtm">Google Tag Manager</Label>
                <Input
                  id="site-gtm"
                  placeholder="GTM-XXXX"
                  value={form.gtmId}
                  onChange={(e) => updateField("gtmId", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-cta">Текст основной кнопки</Label>
                <Input
                  id="site-cta"
                  value={form.ctaLabel}
                  onChange={(e) => updateField("ctaLabel", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-inquiry-email">Email для заявок с сайта</Label>
                <Input
                  id="site-inquiry-email"
                  type="email"
                  value={form.inquiryEmail}
                  onChange={(e) => updateField("inquiryEmail", e.target.value)}
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Сохранить черновик</Button>
            <Button type="button" variant="outline" onClick={openPreview}>
              Открыть предпросмотр
            </Button>
            <Button type="button" variant="secondary" disabled>
              Опубликовать
            </Button>
            <p className="text-xs text-slate-500">
              Публикация сайта и привязка домена — в полноценном релизе 01.09.
            </p>
          </div>
        </form>
      )}
    </DashboardShell>
  );
}
