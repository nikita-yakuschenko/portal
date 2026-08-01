"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Upload } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
      headerActions={
        <>
          <Badge variant="secondary">Черновик · тестовый режим</Badge>
          <Button type="button" variant="outline" onClick={openPreview} disabled={loading}>
            <ExternalLink />
            Предпросмотр
          </Button>
        </>
      }
    >
      <PageAlert message={error} variant="destructive" />
      <PageAlert message={notice} />

      <p className="text-muted-foreground max-w-3xl text-sm">
        Публичный сайт по структуре msk.avgst.ru: своё лого, свой бренд, каталог и цены из портала.
        Без верхней плашки города и без блоков «6% / Яндекс / 10+ лет».
      </p>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <form className="flex flex-col gap-4 md:gap-6" onSubmit={handleSave}>
          <Card>
            <CardHeader>
              <CardTitle>Адрес сайта</CardTitle>
              <CardDescription>
                Технический поддомен платформы или свой домен компании.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="md:grid md:grid-cols-2 md:gap-4">
                <Field>
                  <FieldLabel htmlFor="site-name">Название компании на сайте</FieldLabel>
                  <Input
                    id="site-name"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-subdomain">Поддомен</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      id="site-subdomain"
                      value={form.subdomain}
                      onChange={(e) => updateField("subdomain", e.target.value)}
                      required
                    />
                    <span className="text-muted-foreground shrink-0 text-sm">.avgst.ru</span>
                  </div>
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="site-domain">Свой домен (опционально)</FieldLabel>
                  <Input
                    id="site-domain"
                    placeholder="stroy-company.ru"
                    value={form.domain}
                    onChange={(e) => updateField("domain", e.target.value)}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Логотип</CardTitle>
              <CardDescription>
                Вместо заводского лого — ваш. PNG, JPG или SVG, до ~800 КБ.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <div className="bg-muted flex h-16 min-w-[120px] items-center justify-center rounded-lg border border-dashed px-4">
                {form.logoDataUrl ? (
                  <img
                    src={form.logoDataUrl}
                    alt="Логотип"
                    className="max-h-12 max-w-[160px] object-contain"
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">Нет логотипа</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
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
                    className="w-fit"
                    onClick={() => updateField("logoDataUrl", "")}
                  >
                    Убрать логотип
                  </Button>
                ) : (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Upload className="size-3.5" />
                    Загрузите файл, чтобы заменить заводской знак
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Контакты</CardTitle>
              <CardDescription>Ваши телефоны и почта — то, что видит покупатель.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="md:grid md:grid-cols-2 md:gap-4">
                <Field>
                  <FieldLabel htmlFor="site-phone">Телефон</FieldLabel>
                  <Input
                    id="site-phone"
                    value={form.contactPhone}
                    onChange={(e) => updateField("contactPhone", e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-email">Email</FieldLabel>
                  <Input
                    id="site-email"
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => updateField("contactEmail", e.target.value)}
                    required
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="site-address">Адрес / город</FieldLabel>
                  <Input
                    id="site-address"
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Соцсети</CardTitle>
              <CardDescription>Ссылки на ваши аккаунты — по желанию.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="md:grid md:grid-cols-2 md:gap-4">
                <Field>
                  <FieldLabel htmlFor="site-tg">Telegram</FieldLabel>
                  <Input
                    id="site-tg"
                    placeholder="https://t.me/..."
                    value={form.socialTelegram}
                    onChange={(e) => updateField("socialTelegram", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-vk">ВКонтакте</FieldLabel>
                  <Input
                    id="site-vk"
                    placeholder="https://vk.com/..."
                    value={form.socialVk}
                    onChange={(e) => updateField("socialVk", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-wa">WhatsApp</FieldLabel>
                  <Input
                    id="site-wa"
                    placeholder="https://wa.me/7..."
                    value={form.socialWhatsapp}
                    onChange={(e) => updateField("socialWhatsapp", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-max">MAX / другое</FieldLabel>
                  <Input
                    id="site-max"
                    placeholder="Ссылка"
                    value={form.socialMax}
                    onChange={(e) => updateField("socialMax", e.target.value)}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Тексты как на сайте</CardTitle>
              <CardDescription>
                Те же поля, что на первом экране и в каталоге превью (структура msk.avgst.ru).
              </CardDescription>
              <CardAction>
                <Button type="button" variant="outline" size="sm" onClick={applyTemplateTexts}>
                  Подставить шаблон
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="site-hero-headline">Заголовок первого экрана</FieldLabel>
                  <Textarea
                    id="site-hero-headline"
                    rows={3}
                    value={form.heroHeadline}
                    onChange={(e) => updateField("heroHeadline", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-hero-text">Текст под заголовком</FieldLabel>
                  <Textarea
                    id="site-hero-text"
                    rows={3}
                    value={form.heroText}
                    onChange={(e) => updateField("heroText", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-cta">Жёлтая кнопка на первом экране</FieldLabel>
                  <Input
                    id="site-cta"
                    value={form.ctaLabel}
                    onChange={(e) => updateField("ctaLabel", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-catalog-title">Заголовок блока каталога</FieldLabel>
                  <Input
                    id="site-catalog-title"
                    value={form.catalogTitle}
                    onChange={(e) => updateField("catalogTitle", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-catalog-text">Подзаголовок каталога</FieldLabel>
                  <Textarea
                    id="site-catalog-text"
                    rows={2}
                    value={form.catalogText}
                    onChange={(e) => updateField("catalogText", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-about-title">Страница «О нас» — заголовок</FieldLabel>
                  <Input
                    id="site-about-title"
                    value={form.aboutTitle}
                    onChange={(e) => updateField("aboutTitle", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-about-text">Страница «О нас» — текст</FieldLabel>
                  <Textarea
                    id="site-about-text"
                    rows={4}
                    value={form.aboutText}
                    onChange={(e) => updateField("aboutText", e.target.value)}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="site-seo-title">Title</FieldLabel>
                  <Input
                    id="site-seo-title"
                    value={form.seoTitle}
                    onChange={(e) => updateField("seoTitle", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-seo-description">Description</FieldLabel>
                  <Textarea
                    id="site-seo-description"
                    rows={3}
                    value={form.seoDescription}
                    onChange={(e) => updateField("seoDescription", e.target.value)}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Аналитика и заявки</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="md:grid md:grid-cols-2 md:gap-4">
                <Field>
                  <FieldLabel htmlFor="site-metrika">Яндекс.Метрика</FieldLabel>
                  <Input
                    id="site-metrika"
                    placeholder="Номер счётчика"
                    value={form.yandexMetrika}
                    onChange={(e) => updateField("yandexMetrika", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="site-gtm">Google Tag Manager</FieldLabel>
                  <Input
                    id="site-gtm"
                    placeholder="GTM-XXXX"
                    value={form.gtmId}
                    onChange={(e) => updateField("gtmId", e.target.value)}
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="site-inquiry-email">Email для заявок с сайта</FieldLabel>
                  <Input
                    id="site-inquiry-email"
                    type="email"
                    value={form.inquiryEmail}
                    onChange={(e) => updateField("inquiryEmail", e.target.value)}
                  />
                  <FieldDescription>
                    Дублируем заявки на эту почту помимо CRM.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Сохранить черновик</Button>
            <Button type="button" variant="outline" onClick={openPreview}>
              <ExternalLink />
              Открыть предпросмотр
            </Button>
            <Button type="button" variant="secondary" disabled>
              Опубликовать
            </Button>
            <p className="text-muted-foreground text-xs">
              Публикация и привязка домена — в релизе 01.09.
            </p>
          </div>
        </form>
      )}
    </DashboardShell>
  );
}
