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
  applySiteTemplateTexts,
  draftDefaultsFromPartner,
  emptyPartnerSiteDraft,
  loadPartnerSiteDraft,
  normalizePartnerSiteDraft,
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

export default function PartnerSitePage() {
  const [form, setForm] = useState<PartnerSiteDraft>(emptyPartnerSiteDraft);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiFetch<MeResponse>("/api/partner/me");
        const stored = loadPartnerSiteDraft();
        // Сохранённый черновик + миграция старых текстов под шаблон сайта
        if (stored) {
          const aligned = normalizePartnerSiteDraft(stored) ?? stored;
          setForm(aligned);
          savePartnerSiteDraft(aligned);
        } else if (me.partner) {
          const next = draftDefaultsFromPartner(me.partner);
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

  function applyTemplateTexts() {
    setForm((prev) => {
      const next = applySiteTemplateTexts(prev);
      savePartnerSiteDraft(next);
      return next;
    });
    setNotice("Тексты первого экрана и каталога подставлены как на сайте.");
  }

  function updateField<K extends keyof PartnerSiteDraft>(key: K, value: PartnerSiteDraft[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 800_000) {
      setNotice("Логотип слишком большой. Загрузите файл до ~800 КБ (PNG/SVG/JPG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((prev) => ({ ...prev, logoDataUrl: result }));
    };
    reader.readAsDataURL(file);
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    savePartnerSiteDraft(form);
    setNotice("Черновик сохранён. Публикация и домен — в релизе 01.09.");
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
        <p className="max-w-2xl text-sm text-slate-500">
          Публичный сайт по структуре msk.avgst.ru: своё лого, свой бренд, каталог и цены из портала.
          Без верхней плашки города и без блоков «6% / Яндекс / 10+ лет».
        </p>
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
              Технический поддомен платформы или свой домен компании.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="site-name">Название компании на сайте</Label>
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
                  placeholder="stroy-company.ru"
                  value={form.domain}
                  onChange={(e) => updateField("domain", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Логотип</h2>
            <p className="mt-1 text-sm text-slate-500">
              Вместо заводского лого — ваш. PNG, JPG или SVG, до ~800 КБ.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex h-16 min-w-[120px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4">
                {form.logoDataUrl ? (
                  <img
                    src={form.logoDataUrl}
                    alt="Логотип"
                    className="max-h-12 max-w-[160px] object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">Нет логотипа</span>
                )}
              </div>
              <div className="space-y-2">
                <Input
                  id="site-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoChange}
                  className="max-w-xs cursor-pointer"
                />
                {form.logoDataUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateField("logoDataUrl", "")}
                  >
                    Убрать логотип
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Контакты</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ваши телефоны и почта — то, что видит покупатель.
            </p>
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
                <Label htmlFor="site-address">Адрес / город</Label>
                <Input
                  id="site-address"
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Соцсети</h2>
            <p className="mt-1 text-sm text-slate-500">Ссылки на ваши аккаунты — по желанию.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="site-tg">Telegram</Label>
                <Input
                  id="site-tg"
                  placeholder="https://t.me/..."
                  value={form.socialTelegram}
                  onChange={(e) => updateField("socialTelegram", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-vk">ВКонтакте</Label>
                <Input
                  id="site-vk"
                  placeholder="https://vk.com/..."
                  value={form.socialVk}
                  onChange={(e) => updateField("socialVk", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-wa">WhatsApp</Label>
                <Input
                  id="site-wa"
                  placeholder="https://wa.me/7..."
                  value={form.socialWhatsapp}
                  onChange={(e) => updateField("socialWhatsapp", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-max">MAX / другое</Label>
                <Input
                  id="site-max"
                  placeholder="Ссылка"
                  value={form.socialMax}
                  onChange={(e) => updateField("socialMax", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Тексты как на сайте</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Те же поля, что на первом экране и в каталоге превью (структура msk.avgst.ru).
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={applyTemplateTexts}>
                Подставить шаблон сайта
              </Button>
            </div>
            <div className="mt-4 grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="site-hero-headline">Заголовок первого экрана</Label>
                <Textarea
                  id="site-hero-headline"
                  rows={3}
                  value={form.heroHeadline}
                  onChange={(e) => updateField("heroHeadline", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-hero-text">Текст под заголовком</Label>
                <Textarea
                  id="site-hero-text"
                  rows={3}
                  value={form.heroText}
                  onChange={(e) => updateField("heroText", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-cta">Жёлтая кнопка на первом экране</Label>
                <Input
                  id="site-cta"
                  value={form.ctaLabel}
                  onChange={(e) => updateField("ctaLabel", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-catalog-title">Заголовок блока каталога</Label>
                <Input
                  id="site-catalog-title"
                  value={form.catalogTitle}
                  onChange={(e) => updateField("catalogTitle", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-catalog-text">Подзаголовок каталога</Label>
                <Textarea
                  id="site-catalog-text"
                  rows={2}
                  value={form.catalogText}
                  onChange={(e) => updateField("catalogText", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-about-title">Страница «О нас» — заголовок</Label>
                <Input
                  id="site-about-title"
                  value={form.aboutTitle}
                  onChange={(e) => updateField("aboutTitle", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-about-text">Страница «О нас» — текст</Label>
                <Textarea
                  id="site-about-text"
                  rows={4}
                  value={form.aboutText}
                  onChange={(e) => updateField("aboutText", e.target.value)}
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
            <h2 className="text-lg font-semibold text-slate-950">Аналитика и заявки</h2>
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
              <div className="space-y-1.5 md:col-span-2">
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
              Публикация и привязка домена — в релизе 01.09.
            </p>
          </div>
        </form>
      )}
    </DashboardShell>
  );
}
