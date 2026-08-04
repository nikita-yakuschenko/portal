"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconExternalLink, IconUpload } from "@tabler/icons-react";
import { toast } from "sonner";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { PopularProjectsPicker } from "@/components/partner-site/popular-projects-picker";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import {
  applySiteTemplateTexts,
  emptyPartnerSiteDraft,
  loadPartnerSiteDraft,
  normalizePartnerSiteDraft,
  savePartnerSiteDraft,
  type PartnerSiteDraft
} from "@/lib/partner-site-draft";
import {
  filterStorefrontProjects,
  type StorefrontProject
} from "@/lib/partner-site-preview";
import { PARTNER_SITE_SOCIALS } from "@/lib/partner-site-socials";

const TABS = ["general", "contacts", "content", "seo"] as const;
type SiteTab = (typeof TABS)[number];

function parseTab(value: string | null): SiteTab {
  if (value && (TABS as readonly string[]).includes(value)) {
    return value as SiteTab;
  }
  return "general";
}

function PartnerSiteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [form, setForm] = useState<PartnerSiteDraft>(emptyPartnerSiteDraft);
  const [siteStatus, setSiteStatus] = useState<"draft" | "published">("draft");
  const [publishLocked, setPublishLocked] = useState(false);
  const [publishLockNotice, setPublishLockNotice] = useState<string | null>(null);
  const [noticeReadAt, setNoticeReadAt] = useState<string | null>(null);
  const [republishRequestStatus, setRepublishRequestStatus] = useState<"pending" | null>(null);
  const [projects, setProjects] = useState<StorefrontProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  type SiteApi = {
    status: "draft" | "published";
    config: PartnerSiteDraft;
    publishLocked?: boolean;
    publishLockNotice?: string | null;
    publishLockNoticeReadAt?: string | null;
    republishRequestStatus?: "pending" | null;
  };

  function applySiteMeta(site: SiteApi) {
    setSiteStatus(site.status);
    setPublishLocked(Boolean(site.publishLocked));
    setPublishLockNotice(site.publishLockNotice ?? null);
    setNoticeReadAt(site.publishLockNoticeReadAt ?? null);
    setRepublishRequestStatus(site.republishRequestStatus === "pending" ? "pending" : null);
  }

  useEffect(() => {
    void (async () => {
      try {
        const [site, storefront] = await Promise.all([
          apiFetch<SiteApi>("/api/partner/site"),
          apiFetch<StorefrontProject[]>("/api/partner/storefront/projects").catch(
            () => [] as StorefrontProject[]
          )
        ]);
        setProjects(filterStorefrontProjects(storefront));
        applySiteMeta(site);

        let config = normalizePartnerSiteDraft(site.config) ?? site.config;
        // Одноразовая миграция: если на сервере пустое имя — подтянуть localStorage
        if (!config.name.trim()) {
          const stored = loadPartnerSiteDraft();
          if (stored?.name.trim()) {
            config = stored;
            await apiFetch("/api/partner/site", {
              method: "PUT",
              body: JSON.stringify({ config })
            });
          }
        }
        setForm(config);
        savePartnerSiteDraft(config);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить данные сайта");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleTabChange(value: string) {
    const next = parseTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "general") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const query = params.toString();
    router.replace(query ? `/partner/site?${query}` : "/partner/site");
  }

  function applyTemplateTexts() {
    setForm((prev) => {
      const next = applySiteTemplateTexts(prev);
      savePartnerSiteDraft(next);
      return next;
    });
    toast.success("Тексты первого экрана и каталога подставлены как на сайте");
  }

  function updateField<K extends keyof PartnerSiteDraft>(key: K, value: PartnerSiteDraft[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function readImageFile(
    event: React.ChangeEvent<HTMLInputElement>,
    opts: { maxBytes: number; field: "logoDataUrl" | "logoMobileDataUrl"; label: string }
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > opts.maxBytes) {
      toast.error(`${opts.label} слишком большой`, {
        description: `Загрузите файл до ~${Math.round(opts.maxBytes / 1000)} КБ (PNG/SVG/JPG).`
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((prev) => ({ ...prev, [opts.field]: result }));
    };
    reader.readAsDataURL(file);
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    readImageFile(event, {
      maxBytes: 800_000,
      field: "logoDataUrl",
      label: "Логотип"
    });
  }

  function handleMobileLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    readImageFile(event, {
      maxBytes: 300_000,
      field: "logoMobileDataUrl",
      label: "Мобильный логотип"
    });
  }

  function handleFaviconChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 300_000) {
      toast.error("Favicon слишком большой", {
        description: "Загрузите файл до ~300 КБ (ICO/PNG/SVG/WEBP)."
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((prev) => ({ ...prev, faviconDataUrl: result }));
    };
    reader.readAsDataURL(file);
  }

  async function persistSite(publish = false) {
    if (!form.name.trim() || !form.subdomain.trim()) {
      toast.error("Заполните название и поддомен", {
        description: "Раздел «Основное»"
      });
      handleTabChange("general");
      return false;
    }
    if (!form.contactPhone.trim() || !form.contactEmail.trim()) {
      toast.error("Заполните телефон и email", {
        description: "Раздел «Контакты»"
      });
      handleTabChange("contacts");
      return false;
    }

    setSaving(true);
    try {
      const saved = await apiFetch<SiteApi>("/api/partner/site", {
        method: "PUT",
        body: JSON.stringify({ config: form, publish })
      });
      applySiteMeta(saved);
      setForm(saved.config);
      savePartnerSiteDraft(saved.config);
      toast.success(publish ? "Сайт опубликован" : "Черновик сохранён", {
        description: publish
          ? "Сайт доступен на привязанном домене после DNS/Dokploy."
          : "Можно открыть предпросмотр или опубликовать."
      });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить сайт");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    await persistSite(false);
  }

  async function handlePublish() {
    await persistSite(true);
  }

  async function handleUnpublish() {
    setSaving(true);
    try {
      const saved = await apiFetch<SiteApi>("/api/partner/site/unpublish", { method: "POST" });
      applySiteMeta(saved);
      toast.success("Сайт снят с публикации");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось снять с публикации");
    } finally {
      setSaving(false);
    }
  }

  async function handleRepublishRequest() {
    setSaving(true);
    try {
      const saved = await apiFetch<SiteApi>("/api/partner/site/republish-request", {
        method: "POST",
        body: JSON.stringify({})
      });
      applySiteMeta(saved);
      toast.success("Запрос на возобновление отправлен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить запрос");
    } finally {
      setSaving(false);
    }
  }

  async function handleNoticeRead() {
    try {
      const saved = await apiFetch<SiteApi>("/api/partner/site/notice-read", { method: "POST" });
      applySiteMeta(saved);
    } catch {
      /* ignore */
    }
  }

  async function openPreview() {
    const ok = await persistSite(false);
    if (ok) {
      window.open("/partner/site/preview", "_blank", "noopener,noreferrer");
    }
  }

  return (
    <PartnerShell
      currentPath="/partner/site"
      title="Сайт"
      headerActions={
        <>
          <Badge variant={siteStatus === "published" ? "default" : "secondary"}>
            {siteStatus === "published" ? "Опубликован" : "Черновик"}
          </Badge>
          {publishLocked ? <Badge variant="destructive">Публикация заблокирована</Badge> : null}
          <Button type="button" variant="outline" onClick={() => void openPreview()} disabled={loading || saving}>
            <IconExternalLink />
            Предпросмотр
          </Button>
        </>
      }
    >
      <PageAlert message={error} variant="destructive" />
      {publishLocked && publishLockNotice ? (
        <PageAlert
          message={publishLockNotice}
          variant={noticeReadAt ? "default" : "destructive"}
        />
      ) : null}
      {publishLocked && publishLockNotice && !noticeReadAt ? (
        <div className="mb-4">
          <Button type="button" variant="outline" size="sm" onClick={() => void handleNoticeRead()}>
            Понятно
          </Button>
        </div>
      ) : null}

      <p className="text-muted-foreground max-w-3xl text-sm">
        Публичный сайт по структуре msk.avgst.ru: своё лого, свой бренд, каталог и цены из портала.
        Без верхней плашки города и без блоков «6% / Яндекс / 10+ лет».
      </p>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-lg" />
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <form className="flex flex-col gap-4 md:gap-6" onSubmit={handleSave}>
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="general">Основное</TabsTrigger>
              <TabsTrigger value="contacts">Контакты</TabsTrigger>
              <TabsTrigger value="content">Тексты</TabsTrigger>
              <TabsTrigger value="seo">SEO и заявки</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-0 space-y-4">
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
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="site-subdomain">Поддомен</FieldLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          id="site-subdomain"
                          value={form.subdomain}
                          onChange={(e) => updateField("subdomain", e.target.value)}
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
                    Обычный — для десктопа. Мобильный — компактная иконка в шапке, чтобы телефон не
                    обрезался.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap items-center gap-4">
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
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <FieldLabel htmlFor="site-logo">Десктоп / подвал</FieldLabel>
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
                          Убрать
                        </Button>
                      ) : (
                        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                          <IconUpload className="size-3.5" />
                          PNG, JPG или SVG, до ~800 КБ
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 border-t pt-6">
                    <div className="bg-muted flex size-16 items-center justify-center rounded-lg border border-dashed">
                      {form.logoMobileDataUrl ? (
                        <img
                          src={form.logoMobileDataUrl}
                          alt="Мобильный логотип"
                          className="size-10 object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground text-[10px]">Нет</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <FieldLabel htmlFor="site-logo-mobile">Мобильная шапка</FieldLabel>
                      <Input
                        id="site-logo-mobile"
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        onChange={handleMobileLogoChange}
                        className="max-w-xs cursor-pointer"
                      />
                      {form.logoMobileDataUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          onClick={() => updateField("logoMobileDataUrl", "")}
                        >
                          Убрать
                        </Button>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          Квадратная иконка ~64–128 px, до ~300 КБ. Если пусто — берётся обычный
                          логотип.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Контакты</CardTitle>
                  <CardDescription>
                    Ваши телефоны и почта — то, что видит покупатель.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="md:grid md:grid-cols-2 md:gap-4">
                    <Field>
                      <FieldLabel htmlFor="site-phone">Телефон</FieldLabel>
                      <Input
                        id="site-phone"
                        value={form.contactPhone}
                        onChange={(e) => updateField("contactPhone", e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="site-email">Email</FieldLabel>
                      <Input
                        id="site-email"
                        type="email"
                        value={form.contactEmail}
                        onChange={(e) => updateField("contactEmail", e.target.value)}
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
                    {PARTNER_SITE_SOCIALS.map((social) => (
                      <Field key={social.id}>
                        <FieldLabel htmlFor={`site-${social.id}`}>{social.label}</FieldLabel>
                        <Input
                          id={`site-${social.id}`}
                          placeholder={social.placeholder}
                          value={String(form[social.field] ?? "")}
                          onChange={(e) => updateField(social.field, e.target.value)}
                        />
                      </Field>
                    ))}
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>После заявки</CardTitle>
                  <CardDescription>
                    Выберите сети для ротации: каждая новая заявка получит следующую по кругу.
                    Так разные пользователи увидят разные соцсети. Нужны ссылки в блоке «Соцсети».
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5">
                      <Checkbox
                        checked={form.postLeadOfferSocials.length === 0}
                        onCheckedChange={(value) => {
                          if (value === true) updateField("postLeadOfferSocials", []);
                        }}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">Не предлагать</span>
                        <span className="text-muted-foreground text-xs">
                          После e-mail шаг с подпиской не покажется
                        </span>
                      </span>
                    </label>
                    {PARTNER_SITE_SOCIALS.map((social) => {
                      const hasUrl = String(form[social.field] ?? "").trim().length > 0;
                      const selected = form.postLeadOfferSocials.includes(social.id);
                      return (
                        <label
                          key={social.id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5"
                        >
                          <Checkbox
                            checked={selected}
                            disabled={!hasUrl}
                            onCheckedChange={(value) => {
                              const current = form.postLeadOfferSocials;
                              if (value === true) {
                                updateField(
                                  "postLeadOfferSocials",
                                  current.includes(social.id)
                                    ? current
                                    : [...current, social.id]
                                );
                              } else {
                                updateField(
                                  "postLeadOfferSocials",
                                  current.filter((id) => id !== social.id)
                                );
                              }
                            }}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{social.label}</span>
                            <span className="text-muted-foreground text-xs">
                              {hasUrl
                                ? "Участвует в ротации после заявки"
                                : "Сначала укажите ссылку в блоке «Соцсети»"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Популярные проекты</CardTitle>
                  <CardDescription>
                    До 6 проектов на главной. Порядок здесь не связан с порядком в каталоге —
                    перетаскивайте строки, чтобы расставить как нужно.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PopularProjectsPicker
                    projects={projects}
                    selectedIds={form.popularProjectIds}
                    onChange={(ids) => updateField("popularProjectIds", ids)}
                  />
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
                      <FieldLabel htmlFor="site-about-text">Текст в подвале сайта</FieldLabel>
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
            </TabsContent>

            <TabsContent value="seo" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>SEO и превью ссылок</CardTitle>
                  <CardDescription>
                    Title, описание и favicon для вкладки браузера и превью в Telegram /
                    мессенджерах. После правок нажмите «Опубликовать».
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="site-seo-title">Title (название в превью)</FieldLabel>
                      <Input
                        id="site-seo-title"
                        placeholder={form.name.trim() || "Например: PRO DOM"}
                        value={form.seoTitle}
                        onChange={(e) => updateField("seoTitle", e.target.value)}
                      />
                      <p className="text-muted-foreground text-xs">
                        Если пусто — название сайта из раздела «Основное».
                      </p>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="site-seo-description">
                        Description (пометка / слоган)
                      </FieldLabel>
                      <Textarea
                        id="site-seo-description"
                        rows={3}
                        placeholder="Например: PRO DOM помогает выбрать проект, рассчитать смету и построить дом."
                        value={form.seoDescription}
                        onChange={(e) => updateField("seoDescription", e.target.value)}
                      />
                      <p className="text-muted-foreground text-xs">
                        Короткий текст под названием в превью ссылки.
                      </p>
                    </Field>
                  </FieldGroup>

                  <div className="flex flex-wrap items-center gap-4 border-t pt-6">
                    <div className="bg-muted flex size-14 items-center justify-center overflow-hidden rounded-lg border border-dashed">
                      {form.faviconDataUrl ? (
                        <img
                          src={form.faviconDataUrl}
                          alt="Favicon"
                          className="size-8 object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground text-[10px]">Нет</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <FieldLabel htmlFor="site-favicon">Favicon</FieldLabel>
                      <Input
                        id="site-favicon"
                        type="file"
                        accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/webp"
                        onChange={handleFaviconChange}
                        className="max-w-xs cursor-pointer"
                      />
                      {form.faviconDataUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          onClick={() => updateField("faviconDataUrl", "")}
                        >
                          Убрать favicon
                        </Button>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          Для превью в Telegram лучше PNG/WEBP (SVG там часто не показывается).
                          ICO, PNG, SVG или WEBP, до ~300 КБ.
                        </p>
                      )}
                    </div>
                  </div>
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
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить черновик"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void openPreview()} disabled={saving}>
              <IconExternalLink />
              Открыть предпросмотр
            </Button>
            {siteStatus === "published" ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void handleUnpublish()}
              >
                Снять с публикации
              </Button>
            ) : null}
            {publishLocked ? (
              <Button
                type="button"
                variant="secondary"
                disabled={saving || republishRequestStatus === "pending"}
                onClick={() => void handleRepublishRequest()}
              >
                {republishRequestStatus === "pending"
                  ? "Запрос отправлен"
                  : "Запросить возобновление"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={saving || siteStatus === "published"}
                onClick={() => void handlePublish()}
              >
                Опубликовать
              </Button>
            )}
          </div>
        </form>
      )}
    </PartnerShell>
  );
}

export default function PartnerSitePage() {
  return (
    <Suspense
      fallback={
        <PartnerShell currentPath="/partner/site" title="Сайт">
          <Skeleton className="h-10 w-full max-w-lg" />
          <Skeleton className="h-64 w-full" />
        </PartnerShell>
      }
    >
      <PartnerSiteContent />
    </Suspense>
  );
}
