"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconExternalLink } from "@tabler/icons-react";
import { toast } from "sonner";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { ImageUploadField } from "@/components/partner-site/image-upload-field";
import { PopularProjectsPicker } from "@/components/partner-site/popular-projects-picker";
import { SettingRow, SettingRows } from "@/components/partner-site/setting-row";
import { SiteStatusCard } from "@/components/partner-site/site-status-card";
import { PartnerSiteSocialGlyph } from "@/components/partner-site/social-icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import {
  applySiteTemplateTexts,
  emptyPartnerSiteDraft,
  loadPartnerSiteDraft,
  normalizePartnerSiteDraft,
  publicSiteHost,
  savePartnerSiteDraft,
  slugifySubdomain,
  type PartnerSiteDraft
} from "@/lib/partner-site-draft";
import { filterStorefrontProjects, type StorefrontProject } from "@/lib/partner-site-preview";
import { PARTNER_SITE_SOCIALS, type PartnerSiteSocialId } from "@/lib/partner-site-socials";
import { cn } from "@/lib/utils";
import {
  countErrors,
  firstErrorField,
  SITE_FIELD_INPUT_ID,
  SITE_FIELD_TAB,
  SITE_TAB_LABELS,
  SITE_TABS,
  validatePartnerSiteDraft,
  type SiteErrors,
  type SiteFieldKey,
  type SiteTab
} from "@/lib/partner-site-validation";

/** Короткий пример без https:// — длинный протокол визуально «съедает» поле */
const SOCIAL_PLACEHOLDER: Record<PartnerSiteSocialId, string> = {
  vk: "vk.com/company",
  instagram: "instagram.com/company",
  youtube: "youtube.com/@company",
  dzen: "dzen.ru/company",
  telegram: "t.me/company",
  max: "max.ru/company"
};

function parseTab(value: string | null): SiteTab {
  if (value && (SITE_TABS as readonly string[]).includes(value)) {
    return value as SiteTab;
  }
  return "general";
}

type SiteApi = {
  status: "draft" | "published";
  config: PartnerSiteDraft;
  hasUnpublishedChanges?: boolean;
  publishedAt?: string | null;
  publishLocked?: boolean;
  publishLockNotice?: string | null;
  publishLockNoticeReadAt?: string | null;
  republishRequestStatus?: "pending" | null;
};

type SiteMeta = {
  status: "draft" | "published";
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  publishLocked: boolean;
  publishLockNotice: string | null;
  noticeReadAt: string | null;
  republishRequestStatus: "pending" | null;
};

const INITIAL_META: SiteMeta = {
  status: "draft",
  hasUnpublishedChanges: false,
  publishedAt: null,
  publishLocked: false,
  publishLockNotice: null,
  noticeReadAt: null,
  republishRequestStatus: null
};

function readMeta(site: SiteApi): SiteMeta {
  return {
    status: site.status,
    hasUnpublishedChanges: Boolean(site.hasUnpublishedChanges),
    publishedAt: site.publishedAt ?? null,
    publishLocked: Boolean(site.publishLocked),
    publishLockNotice: site.publishLockNotice ?? null,
    noticeReadAt: site.publishLockNoticeReadAt ?? null,
    republishRequestStatus: site.republishRequestStatus === "pending" ? "pending" : null
  };
}

function PartnerSiteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [form, setForm] = useState<PartnerSiteDraft>(emptyPartnerSiteDraft);
  /** Последнее, что реально лежит на сервере — от него считаем несохранённые правки */
  const [savedForm, setSavedForm] = useState<PartnerSiteDraft>(emptyPartnerSiteDraft);
  const [meta, setMeta] = useState<SiteMeta>(INITIAL_META);
  const [projects, setProjects] = useState<StorefrontProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  /** Ошибку поля показываем после ухода из него или после попытки сохранить */
  const [touched, setTouched] = useState<Partial<Record<SiteFieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  /** Выбор сетей до выключения тумблера — чтобы вернуть его, а не собирать заново */
  const lastOfferedSocials = useRef<string[]>([]);

  const errors: SiteErrors = useMemo(() => validatePartnerSiteDraft(form), [form]);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm]);
  const host = publicSiteHost(form);
  const subdomainSlug = slugifySubdomain(form.subdomain);

  const showError = useCallback(
    (key: SiteFieldKey): string | undefined =>
      touched[key] || submitAttempted ? errors[key] : undefined,
    [errors, touched, submitAttempted]
  );

  const markTouched = useCallback((key: SiteFieldKey) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

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
        setMeta(readMeta(site));

        let config = normalizePartnerSiteDraft(site.config) ?? site.config;
        // Одноразовая миграция: если на сервере пустое имя — подтянуть localStorage
        if (!config.name.trim()) {
          const stored = loadPartnerSiteDraft();
          if (stored?.name.trim()) {
            config = stored;
            const saved = await apiFetch<SiteApi>("/api/partner/site", {
              method: "PUT",
              body: JSON.stringify({ config })
            });
            config = saved.config;
            setMeta(readMeta(saved));
          }
        }
        setForm(config);
        setSavedForm(config);
        lastOfferedSocials.current = config.postLeadOfferSocials;
        savePartnerSiteDraft(config);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить данные сайта");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Правки живут только в форме: уход со страницы их потеряет
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const goToTab = useCallback(
    (next: SiteTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "general") params.delete("tab");
      else params.set("tab", next);
      const query = params.toString();
      router.replace(query ? `/partner/site?${query}` : "/partner/site", { scroll: false });
    },
    [router, searchParams]
  );

  /** Ведёт к полю: открывает нужный раздел, подсвечивает и ставит курсор */
  const goToField = useCallback(
    (key: SiteFieldKey) => {
      markTouched(key);
      goToTab(SITE_FIELD_TAB[key]);
      window.setTimeout(() => {
        const el = document.getElementById(SITE_FIELD_INPUT_ID[key]);
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        (el as HTMLElement | null)?.focus({ preventScroll: true });
      }, 120);
    },
    [goToTab, markTouched]
  );

  function updateField<K extends keyof PartnerSiteDraft>(key: K, value: PartnerSiteDraft[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyTemplateTexts() {
    setForm((prev) => applySiteTemplateTexts(prev));
    toast.success("Тексты подставлены", {
      description: "Сохраните черновик, если они вам подходят."
    });
  }

  async function persistSite(options: { publish?: boolean; silent?: boolean } = {}) {
    setSubmitAttempted(true);
    const failed = firstErrorField(errors);
    if (failed) {
      const count = countErrors(errors);
      toast.error(count === 1 ? "Одно поле заполнено неверно" : `Полей с ошибками: ${count}`, {
        description: "Открыли первое — исправьте и сохраните ещё раз."
      });
      goToField(failed);
      return false;
    }

    setSaving(true);
    try {
      const saved = await apiFetch<SiteApi>("/api/partner/site", {
        method: "PUT",
        body: JSON.stringify({ config: form, publish: options.publish === true })
      });
      setMeta(readMeta(saved));
      setForm(saved.config);
      setSavedForm(saved.config);
      lastOfferedSocials.current = saved.config.postLeadOfferSocials;
      savePartnerSiteDraft(saved.config);
      setSubmitAttempted(false);

      if (options.silent) return true;

      if (options.publish) {
        toast.success("Сайт опубликован", {
          description: `Открывается по адресу ${publicSiteHost(saved.config)}.`
        });
      } else if (saved.status === "published") {
        toast.success("Черновик сохранён", {
          description: "На сайте пока прежняя версия.",
          action: {
            label: "Опубликовать",
            onClick: () => void persistSite({ publish: true })
          }
        });
      } else {
        toast.success("Черновик сохранён");
      }
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить сайт");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await persistSite();
  }

  async function handleUnpublish() {
    setSaving(true);
    try {
      const saved = await apiFetch<SiteApi>("/api/partner/site/unpublish", { method: "POST" });
      setMeta(readMeta(saved));
      toast.success("Сайт снят с публикации", {
        description: "Настройки сохранены — вернуть его можно кнопкой «Опубликовать»."
      });
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
      setMeta(readMeta(saved));
      toast.success("Запрос отправлен", {
        description: "Администратор сети увидит его в своём кабинете."
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось отправить запрос");
    } finally {
      setSaving(false);
    }
  }

  async function handleNoticeRead() {
    try {
      const saved = await apiFetch<SiteApi>("/api/partner/site/notice-read", { method: "POST" });
      setMeta(readMeta(saved));
    } catch {
      /* пометка о прочтении не критична */
    }
  }

  async function openPreview() {
    // Предпросмотр читает сохранённый черновик, поэтому сначала сохраняем
    if (dirty && !(await persistSite({ silent: true }))) return;
    const opened = window.open("/partner/site/preview", "_blank", "noopener,noreferrer");
    if (!opened) {
      toast.info("Браузер заблокировал новую вкладку", {
        description: "Откройте предпросмотр по адресу /partner/site/preview"
      });
    }
  }

  const offerEnabled = form.postLeadOfferSocials.length > 0;
  const filledSocials = PARTNER_SITE_SOCIALS.filter(
    (social) => String(form[social.field] ?? "").trim().length > 0
  );

  function toggleOffer(enabled: boolean) {
    if (enabled) {
      const restored = lastOfferedSocials.current.filter((id) =>
        filledSocials.some((social) => social.id === id)
      );
      const next = restored.length > 0 ? restored : filledSocials[0] ? [filledSocials[0].id] : [];
      if (next.length === 0) {
        toast.info("Сначала добавьте ссылку на соцсеть", {
          description: "Без ссылки покупателю будет некуда перейти."
        });
        goToField("socialTelegram");
        return;
      }
      updateField("postLeadOfferSocials", next);
    } else {
      lastOfferedSocials.current = form.postLeadOfferSocials;
      updateField("postLeadOfferSocials", []);
    }
  }

  function toggleOfferedSocial(id: string, checked: boolean) {
    const current = form.postLeadOfferSocials;
    const next = checked
      ? current.includes(id)
        ? current
        : [...current, id]
      : current.filter((item) => item !== id);
    updateField("postLeadOfferSocials", next);
    if (next.length > 0) lastOfferedSocials.current = next;
  }

  const errorCount = submitAttempted ? countErrors(errors) : 0;

  return (
    <PartnerShell currentPath="/partner/site" title="Сайт">
      <PageAlert message={error} variant="destructive" />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-10 w-full max-w-lg" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:gap-6">
          <SiteStatusCard
            host={host}
            status={meta.status}
            hasUnpublishedChanges={meta.hasUnpublishedChanges || dirty}
            publishedAt={meta.publishedAt}
            publishLocked={meta.publishLocked}
            publishLockNotice={meta.publishLockNotice}
            noticeRead={Boolean(meta.noticeReadAt)}
            republishPending={meta.republishRequestStatus === "pending"}
            busy={saving}
            onPublish={() => void persistSite({ publish: true })}
            onUnpublish={() => void handleUnpublish()}
            onRequestRepublish={() => void handleRepublishRequest()}
            onNoticeRead={() => void handleNoticeRead()}
          />

          <form className="flex flex-col gap-4 md:gap-6" onSubmit={handleSubmit}>
            {/* manual: иначе проход стрелками по разделам дёргает router.replace на каждом шаге */}
            <Tabs
              value={tab}
              activationMode="manual"
              onValueChange={(value) => goToTab(parseTab(value))}
            >
              <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
                {SITE_TABS.map((item) => (
                  <TabsTrigger key={item} value={item}>
                    {SITE_TAB_LABELS[item]}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="general" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Адрес и бренд</CardTitle>
                    <CardDescription>
                      Название, адрес сайта и картинки для шапки, телефона и вкладки браузера.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <SettingRows>
                      <SettingRow
                        label="Название компании"
                        htmlFor="site-name"
                        description="Стоит в шапке сайта и в подвале."
                        error={showError("name")}
                        width="md"
                      >
                        <Input
                          id="site-name"
                          value={form.name}
                          required
                          aria-invalid={Boolean(showError("name"))}
                          onBlur={() => markTouched("name")}
                          onChange={(e) => updateField("name", e.target.value)}
                        />
                      </SettingRow>

                      <SettingRow
                        label="Адрес на avgst.ru"
                        htmlFor="site-subdomain"
                        description={
                          <>
                            Откроется как{" "}
                            <span className="text-foreground font-medium">
                              {subdomainSlug}.avgst.ru
                            </span>
                            . Латиница, цифры и дефисы.
                          </>
                        }
                        error={showError("subdomain")}
                        width="md"
                      >
                        <div
                          className={cn(
                            "border-input flex h-9 items-center overflow-hidden rounded-md border shadow-xs",
                            "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                            "transition-[color,box-shadow] duration-150",
                            showError("subdomain") && "border-destructive ring-destructive/20"
                          )}
                        >
                          <input
                            id="site-subdomain"
                            value={form.subdomain}
                            required
                            aria-invalid={Boolean(showError("subdomain"))}
                            onBlur={() => markTouched("subdomain")}
                            onChange={(e) => updateField("subdomain", e.target.value)}
                            className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none md:text-sm"
                          />
                          <span className="text-muted-foreground bg-muted/50 h-full shrink-0 border-l px-2.5 text-sm leading-9">
                            .avgst.ru
                          </span>
                        </div>
                      </SettingRow>

                      <SettingRow
                        label="Свой домен"
                        htmlFor="site-domain"
                        description="Не обязательно. Направьте домен у регистратора — адрес на avgst.ru останется запасным."
                        error={showError("domain")}
                        width="md"
                      >
                        <Input
                          id="site-domain"
                          placeholder="stroy-company.ru"
                          value={form.domain}
                          aria-invalid={Boolean(showError("domain"))}
                          onBlur={() => markTouched("domain")}
                          onChange={(e) => updateField("domain", e.target.value)}
                        />
                      </SettingRow>
                    </SettingRows>

                    <div className="border-t pt-6">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                        <ImageUploadField
                          id="site-logo"
                          label="Логотип"
                          hint="Шапка и подвал. PNG, JPG или SVG до 800 КБ."
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          maxBytes={800_000}
                          value={form.logoDataUrl}
                          onChange={(value) => updateField("logoDataUrl", value)}
                        />
                        <ImageUploadField
                          id="site-logo-mobile"
                          label="Для телефона"
                          hint="Квадрат 64–128 px до 300 КБ. Пусто — обычный логотип."
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          maxBytes={300_000}
                          value={form.logoMobileDataUrl}
                          onChange={(value) => updateField("logoMobileDataUrl", value)}
                          shape="square"
                        />
                        <ImageUploadField
                          id="site-favicon"
                          label="Значок сайта"
                          hint="Вкладка и превью ссылки. Для Telegram лучше PNG."
                          accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/webp"
                          maxBytes={300_000}
                          value={form.faviconDataUrl}
                          onChange={(value) => updateField("faviconDataUrl", value)}
                          shape="square"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contacts" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Контакты и соцсети</CardTitle>
                    <CardDescription>
                      То, что покупатель видит в шапке, подвале и на странице контактов.
                    </CardDescription>
                    <CardAction>
                      <span className="text-muted-foreground text-sm tabular-nums">
                        Соцсети {filledSocials.length}/{PARTNER_SITE_SOCIALS.length}
                      </span>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <SettingRows>
                      <SettingRow
                        label="Телефон"
                        htmlFor="site-phone"
                        description="В шапке и подвале — звонок в один клик."
                        error={showError("contactPhone")}
                        width="sm"
                      >
                        <Input
                          id="site-phone"
                          type="tel"
                          placeholder="+7 900 000-00-00"
                          value={form.contactPhone}
                          required
                          aria-invalid={Boolean(showError("contactPhone"))}
                          onBlur={() => markTouched("contactPhone")}
                          onChange={(e) => updateField("contactPhone", e.target.value)}
                        />
                      </SettingRow>

                      <SettingRow
                        label="Почта"
                        htmlFor="site-email"
                        description="Публичный адрес компании на сайте."
                        error={showError("contactEmail")}
                        width="md"
                      >
                        <Input
                          id="site-email"
                          type="email"
                          value={form.contactEmail}
                          required
                          aria-invalid={Boolean(showError("contactEmail"))}
                          onBlur={() => markTouched("contactEmail")}
                          onChange={(e) => updateField("contactEmail", e.target.value)}
                        />
                      </SettingRow>

                      <SettingRow
                        label="Город или адрес офиса"
                        htmlFor="site-address"
                        description="Строка в подвале и на странице контактов."
                        width="md"
                      >
                        <Input
                          id="site-address"
                          value={form.address}
                          onChange={(e) => updateField("address", e.target.value)}
                        />
                      </SettingRow>
                    </SettingRows>

                    {/* Сетка, а не шесть одинаковых строк во всю ширину */}
                    <div className="border-t pt-6">
                      <p className="mb-3 text-sm font-medium">Соцсети в подвале</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {PARTNER_SITE_SOCIALS.map((social) => {
                          const filled = Boolean(String(form[social.field] ?? "").trim());
                          return (
                            <div key={social.id} className="min-w-0">
                              <label
                                htmlFor={SITE_FIELD_INPUT_ID[social.field]}
                                className="mb-1.5 flex items-center gap-2 text-sm font-medium"
                              >
                                <PartnerSiteSocialGlyph
                                  id={social.id}
                                  className={cn(
                                    "size-4 transition-colors duration-150",
                                    filled ? "text-foreground" : "text-muted-foreground/45"
                                  )}
                                />
                                {social.label}
                              </label>
                              <Input
                                id={SITE_FIELD_INPUT_ID[social.field]}
                                type="url"
                                inputMode="url"
                                placeholder={SOCIAL_PLACEHOLDER[social.id]}
                                value={String(form[social.field] ?? "")}
                                aria-invalid={Boolean(showError(social.field))}
                                onBlur={() => markTouched(social.field)}
                                onChange={(e) => updateField(social.field, e.target.value)}
                              />
                              <FieldError className="mt-1">{showError(social.field)}</FieldError>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="content" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Проекты на главной</CardTitle>
                    <CardDescription>
                      До шести в блоке «Популярное». Перетащите плитку на нужное место — порядок на
                      сайте будет таким же.
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
              </TabsContent>

              <TabsContent value="texts" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Тексты главной</CardTitle>
                    <CardDescription>
                      Первый экран, каталог и подвал. Результат — в предпросмотре.
                    </CardDescription>
                    <CardAction>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            Вернуть стандартные
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Заменить тексты стандартными?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Заголовок и текст первого экрана, надпись на кнопке, заголовок и
                              подзаголовок каталога вернутся к типовым. То, что вы написали сами,
                              пропадёт. Контакты, логотип и проекты не меняются.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Оставить свои</AlertDialogCancel>
                            <AlertDialogAction onClick={applyTemplateTexts}>
                              Заменить тексты
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-8 lg:grid-cols-2">
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium">Первый экран</h3>
                        <Field>
                          <FieldLabel htmlFor="site-hero-headline">Заголовок</FieldLabel>
                          <Textarea
                            id="site-hero-headline"
                            rows={2}
                            value={form.heroHeadline}
                            onChange={(e) => updateField("heroHeadline", e.target.value)}
                          />
                          <FieldDescription>
                            Одно предложение о том, что вы строите.
                          </FieldDescription>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="site-hero-text">Текст под заголовком</FieldLabel>
                          <Textarea
                            id="site-hero-text"
                            rows={4}
                            value={form.heroText}
                            onChange={(e) => updateField("heroText", e.target.value)}
                          />
                        </Field>
                        <Field className="max-w-xs">
                          <FieldLabel htmlFor="site-cta">Надпись на кнопке</FieldLabel>
                          <Input
                            id="site-cta"
                            value={form.ctaLabel}
                            onChange={(e) => updateField("ctaLabel", e.target.value)}
                          />
                          <FieldDescription>Ведёт в каталог проектов.</FieldDescription>
                        </Field>
                      </div>

                      <div className="space-y-6">
                        <div className="max-w-sm space-y-3">
                          <h3 className="text-sm font-medium">Каталог</h3>
                          <Field>
                            <FieldLabel htmlFor="site-catalog-title">Заголовок</FieldLabel>
                            <Input
                              id="site-catalog-title"
                              value={form.catalogTitle}
                              onChange={(e) => updateField("catalogTitle", e.target.value)}
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="site-catalog-text">Подзаголовок</FieldLabel>
                            <Input
                              id="site-catalog-text"
                              value={form.catalogText}
                              onChange={(e) => updateField("catalogText", e.target.value)}
                            />
                          </Field>
                        </div>
                        <div className="space-y-3 border-t pt-6">
                          <h3 className="text-sm font-medium">Подвал</h3>
                          <Field>
                            <FieldLabel htmlFor="site-about-text">Текст о компании</FieldLabel>
                            <Textarea
                              id="site-about-text"
                              rows={4}
                              value={form.aboutText}
                              onChange={(e) => updateField("aboutText", e.target.value)}
                            />
                            <FieldDescription>Короткий абзац под каталогом.</FieldDescription>
                          </Field>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="leads" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Заявки с сайта</CardTitle>
                    <CardDescription>
                      Заявки всегда попадают в раздел «Заявки» кабинета. Здесь — куда их
                      продублировать и что показать посетителю после отправки.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <SettingRows>
                      <SettingRow
                        label="Копия на почту"
                        htmlFor="site-inquiry-email"
                        description="Не обязательно. Если пусто — заявки видны только в кабинете."
                        error={showError("inquiryEmail")}
                        width="md"
                      >
                        <Input
                          id="site-inquiry-email"
                          type="email"
                          value={form.inquiryEmail}
                          aria-invalid={Boolean(showError("inquiryEmail"))}
                          onBlur={() => markTouched("inquiryEmail")}
                          onChange={(e) => updateField("inquiryEmail", e.target.value)}
                        />
                      </SettingRow>
                    </SettingRows>

                    <section className="border-t pt-6">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium">Подписка после заявки</h3>
                          <p className="text-muted-foreground mt-1 max-w-prose text-sm">
                            Оставив заявку, посетитель увидит предложение подписаться. Если выбрано
                            несколько сетей — они чередуются: каждый следующий увидит следующую.
                          </p>
                        </div>
                        <Switch
                          id="site-post-lead-switch"
                          checked={offerEnabled}
                          onCheckedChange={toggleOffer}
                          aria-label="Предлагать подписку после заявки"
                        />
                      </div>
                      {offerEnabled ? (
                      <fieldset>
                        <legend className="mb-3 text-sm font-medium">Какие сети предлагать</legend>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {PARTNER_SITE_SOCIALS.map((social) => {
                            const url = String(form[social.field] ?? "").trim();
                            const checked = form.postLeadOfferSocials.includes(social.id);
                            const inputId = `offer-${social.id}`;

                            if (!url) {
                              return (
                                <div
                                  key={social.id}
                                  className="border-border/60 flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5"
                                >
                                  <PartnerSiteSocialGlyph
                                    id={social.id}
                                    className="text-muted-foreground/40 size-5"
                                  />
                                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                                    {social.label}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    className="h-auto shrink-0 p-0 text-xs"
                                    onClick={() => goToField(social.field)}
                                  >
                                    Добавить ссылку
                                  </Button>
                                </div>
                              );
                            }

                            return (
                              <label
                                key={social.id}
                                htmlFor={inputId}
                                data-state={checked ? "checked" : "unchecked"}
                                className={cn(
                                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5",
                                  "transition-colors duration-150",
                                  "hover:bg-accent/50",
                                  checked && "border-primary bg-primary/5 dark:bg-primary/10"
                                )}
                              >
                                <PartnerSiteSocialGlyph id={social.id} className="size-5" />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                  {social.label}
                                </span>
                                <Checkbox
                                  id={inputId}
                                  checked={checked}
                                  onCheckedChange={(value) =>
                                    toggleOfferedSocial(social.id, value === true)
                                  }
                                />
                              </label>
                            );
                          })}
                        </div>
                          <FieldError className="mt-3">
                            {showError("postLeadOfferSocials")}
                          </FieldError>
                        </fieldset>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          Шаг выключен: после заявки посетитель сразу увидит благодарность.
                        </p>
                      )}
                    </section>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="seo" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Продвижение</CardTitle>
                    <CardDescription>
                      Как ссылка выглядит в поиске и мессенджерах, плюс счётчики рекламы.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_18rem] lg:justify-between">
                      <div className="flex max-w-md flex-col gap-4">
                        <Field>
                          <FieldLabel htmlFor="site-seo-title">Заголовок</FieldLabel>
                          <Input
                            id="site-seo-title"
                            placeholder={form.name.trim() || "PRO DOM"}
                            value={form.seoTitle}
                            onChange={(e) => updateField("seoTitle", e.target.value)}
                          />
                          <FieldDescription>
                            Если пусто — возьмём название компании.
                          </FieldDescription>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="site-seo-description">Описание</FieldLabel>
                          <Textarea
                            id="site-seo-description"
                            rows={3}
                            placeholder="Помогаем выбрать проект, рассчитать смету и построить дом."
                            value={form.seoDescription}
                            onChange={(e) => updateField("seoDescription", e.target.value)}
                          />
                          <FieldDescription>
                            Одно-два предложения под заголовком в превью.
                          </FieldDescription>
                        </Field>
                      </div>

                      <div className="flex flex-col gap-2">
                        <p className="text-muted-foreground text-xs font-medium">
                          Так увидят ссылку
                        </p>
                        <div className="bg-muted/40 overflow-hidden rounded-lg border">
                          <div className="bg-muted flex aspect-[1.91/1] items-center justify-center border-b">
                            {form.faviconDataUrl || form.logoDataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={form.faviconDataUrl || form.logoDataUrl}
                                alt=""
                                className="max-h-16 max-w-[60%] object-contain"
                              />
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                Значок сайта не загружен
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 p-3">
                            <p className="text-muted-foreground truncate text-xs">{host}</p>
                            <p className="truncate text-sm font-medium">
                              {form.seoTitle.trim() || form.name.trim() || "Название компании"}
                            </p>
                            <p className="text-muted-foreground line-clamp-2 text-xs">
                              {form.seoDescription.trim() ||
                                "Описание пока не заполнено — здесь будет текст из поля слева."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <p className="mb-1 text-sm font-medium">Счётчики аналитики</p>
                      <p className="text-muted-foreground mb-3 text-sm">
                        Не обязательны. Нужны, если считаете конверсии на своей стороне.
                      </p>
                      <SettingRows>
                        <SettingRow
                          label="Яндекс Метрика"
                          htmlFor="site-metrika"
                          description="Номер счётчика."
                          width="xs"
                        >
                          <Input
                            id="site-metrika"
                            inputMode="numeric"
                            placeholder="12345678"
                            className="tabular-nums"
                            value={form.yandexMetrika}
                            onChange={(e) => updateField("yandexMetrika", e.target.value)}
                          />
                        </SettingRow>
                        <SettingRow
                          label="Google Tag Manager"
                          htmlFor="site-gtm"
                          description="Идентификатор контейнера."
                          width="sm"
                        >
                          <Input
                            id="site-gtm"
                            placeholder="GTM-XXXXXXX"
                            value={form.gtmId}
                            onChange={(e) => updateField("gtmId", e.target.value)}
                          />
                        </SettingRow>
                      </SettingRows>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Панель работы с формой: видна на любой прокрутке, публикации здесь нет */}
            <div className="bg-background/95 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 shadow-xs backdrop-blur">
              <p className="text-muted-foreground text-sm" aria-live="polite">
                {errorCount > 0
                  ? `Не сохранено: ${errorCount === 1 ? "одно поле заполнено неверно" : `полей с ошибками — ${errorCount}`}`
                  : dirty
                    ? "Есть несохранённые правки"
                    : "Все правки сохранены"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void openPreview()}
                  disabled={saving}
                >
                  <IconExternalLink />
                  Предпросмотр
                </Button>
                <Button type="submit" disabled={saving || !dirty}>
                  {saving ? "Сохранение…" : "Сохранить"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </PartnerShell>
  );
}

export default function PartnerSitePage() {
  return (
    <Suspense
      fallback={
        <PartnerShell currentPath="/partner/site" title="Сайт">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </PartnerShell>
      }
    >
      <PartnerSiteContent />
    </Suspense>
  );
}
