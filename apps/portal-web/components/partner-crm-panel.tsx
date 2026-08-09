"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconAlertCircle,
  IconDotsVertical,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconKey,
  IconTrash
} from "@tabler/icons-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type ProviderId = "bitrix24" | "amocrm";

type CrmConnection = {
  id: string;
  provider: ProviderId;
  portalUrl: string;
  isEnabled: boolean;
  /** Хвост ключа: секрет наружу не отдаётся, узнать своё подключение — можно */
  secretHint?: string;
};

type CredentialField = {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  secret?: boolean;
};

type ProviderMeta = {
  id: ProviderId;
  label: string;
  mark: string;
  purpose: string;
  /** Куда идти в самой CRM за ключом */
  steps: string[];
  docsUrl: string;
  docsLabel: string;
  fields: CredentialField[];
  /** Адрес портала выводится из ключа — партнёру не нужно вводить его дважды */
  derivePortalUrl?: (values: Record<string, string>) => string;
  validate?: (values: Record<string, string>) => Record<string, string>;
};

// Секретный код вебхука: https://портал.bitrix24.ru/rest/<id>/<код>/
const BITRIX_WEBHOOK_RE = /^https:\/\/([a-z0-9-]+\.[a-z0-9.-]+)\/rest\/\d+\/[a-z0-9]+\/?$/i;
const AMO_ACCOUNT_RE = /^([a-z0-9-]+)\.amocrm\.(ru|com)$/i;

const PROVIDERS: ProviderMeta[] = [
  {
    id: "bitrix24",
    label: "Bitrix24",
    mark: "B24",
    purpose: "Заявки с сайта становятся лидами на вашем портале.",
    steps: [
      "В Битрикс24 откройте «Приложения» → «Разработчикам».",
      "Готовые сценарии → «Другое» → «Входящий вебхук».",
      "В правах доступа отметьте CRM и сохраните.",
      "Скопируйте ссылку вебхука и вставьте её сюда."
    ],
    docsUrl: "https://apidocs.bitrix24.ru/local-integrations/developers-area.html",
    docsLabel: "Инструкция Битрикс24",
    fields: [
      {
        // Не прячем под точками: партнёр вставляет длинную ссылку и должен
        // видеть, что вставил. Обратно наружу она всё равно не отдаётся.
        key: "webhookUrl",
        label: "Ссылка вебхука",
        placeholder: "https://company.bitrix24.ru/rest/1/abcd1234efgh5678/",
        hint: "Одна строка целиком — адрес портала возьмём из неё."
      }
    ],
    derivePortalUrl: (values) => {
      const match = BITRIX_WEBHOOK_RE.exec((values.webhookUrl ?? "").trim());
      return match?.[1] ? `https://${match[1]}` : "";
    },
    validate: (values) => {
      const value = (values.webhookUrl ?? "").trim();
      if (!value) return { webhookUrl: "Вставьте ссылку вебхука." };
      if (!BITRIX_WEBHOOK_RE.test(value)) {
        return {
          webhookUrl: "Не похоже на вебхук. Ссылка выглядит так: https://компания.bitrix24.ru/rest/1/код/"
        };
      }
      return {};
    }
  },
  {
    id: "amocrm",
    label: "amoCRM",
    mark: "amo",
    purpose: "Заявки с сайта становятся сделками в вашем аккаунте.",
    steps: [
      "В amoCRM откройте «Настройки» → «Интеграции».",
      "Создайте внешнюю интеграцию и разрешите доступ к сделкам.",
      "Скопируйте ID и секретный ключ интеграции.",
      "Там же получите долгосрочный ключ (refresh token)."
    ],
    docsUrl: "https://www.amocrm.ru/developers/content/oauth/step-by-step",
    docsLabel: "Инструкция amoCRM",
    fields: [
      {
        key: "account",
        label: "Адрес аккаунта",
        placeholder: "company.amocrm.ru",
        hint: "Так, как он открывается в браузере."
      },
      { key: "clientId", label: "ID интеграции", placeholder: "" },
      { key: "clientSecret", label: "Секретный ключ", placeholder: "", secret: true },
      { key: "refreshToken", label: "Долгосрочный ключ", placeholder: "", secret: true }
    ],
    derivePortalUrl: (values) => {
      const account = (values.account ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
      return AMO_ACCOUNT_RE.test(account) ? `https://${account.toLowerCase()}` : "";
    },
    validate: (values) => {
      const errors: Record<string, string> = {};
      const account = (values.account ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
      if (!account) errors.account = "Укажите адрес аккаунта.";
      else if (!AMO_ACCOUNT_RE.test(account)) {
        errors.account = "Адрес выглядит так: company.amocrm.ru";
      }
      for (const key of ["clientId", "clientSecret", "refreshToken"]) {
        if (!(values[key] ?? "").trim()) errors[key] = "Заполните поле.";
      }
      return errors;
    }
  }
];

function providerHost(portalUrl: string): string {
  return portalUrl
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function ProviderMark({ mark, muted }: { mark: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold tracking-tight",
        muted ? "bg-muted/60 text-muted-foreground" : "bg-muted text-foreground"
      )}
      aria-hidden
    >
      {mark}
    </span>
  );
}

/** Форма ключей: одна и та же на подключение и на замену протухшего ключа */
function CredentialsDialog({
  provider,
  open,
  mode,
  saving,
  onOpenChange,
  onSubmit
}: {
  provider: ProviderMeta;
  open: boolean;
  mode: "create" | "update";
  saving: boolean;
  onOpenChange: (next: boolean) => void;
  onSubmit: (values: Record<string, string>, portalUrl: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setValues({});
      setErrors({});
      setShown({});
    }
  }, [open]);

  const portalUrl = provider.derivePortalUrl?.(values) ?? "";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = provider.validate?.(values) ?? {};
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(values, portalUrl);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? `Подключить ${provider.label}` : `Новый ключ ${provider.label}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? provider.purpose
              : "Старый ключ перестанет использоваться сразу после сохранения."}
          </DialogDescription>
        </DialogHeader>

        <ol className="bg-muted/40 text-muted-foreground space-y-1.5 rounded-lg border p-3 text-sm">
          {provider.steps.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="text-foreground/70 shrink-0 tabular-nums">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
          <li className="pt-1">
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground inline-flex items-center gap-1 text-sm underline underline-offset-4"
            >
              {provider.docsLabel}
              <IconExternalLink className="size-3.5" />
            </a>
          </li>
        </ol>

        <form id="crm-credentials-form" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {provider.fields.map((field) => {
            const inputId = `crm-${provider.id}-${field.key}`;
            const revealed = shown[field.key] === true;
            return (
              <Field key={field.key} data-invalid={Boolean(errors[field.key])}>
                <FieldLabel htmlFor={inputId}>{field.label}</FieldLabel>
                <div className="relative">
                  <Input
                    id={inputId}
                    type={field.secret && !revealed ? "password" : "text"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ""}
                    aria-invalid={Boolean(errors[field.key])}
                    className={cn(field.secret && "pr-10")}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                  />
                  {field.secret ? (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md"
                      aria-label={revealed ? "Скрыть значение" : "Показать значение"}
                      onClick={() =>
                        setShown((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                      }
                    >
                      {revealed ? (
                        <IconEyeOff className="size-4" />
                      ) : (
                        <IconEye className="size-4" />
                      )}
                    </button>
                  ) : null}
                </div>
                {field.hint ? <FieldDescription>{field.hint}</FieldDescription> : null}
                <FieldError>{errors[field.key]}</FieldError>
              </Field>
            );
          })}

          {portalUrl ? (
            <p className="text-muted-foreground text-sm">
              Портал: <span className="text-foreground font-medium">{providerHost(portalUrl)}</span>
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="submit" form="crm-credentials-form" disabled={saving}>
            {saving ? <Spinner /> : null}
            {mode === "create" ? "Подключить" : "Сохранить ключ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PartnerCrmPanel({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<CrmConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ provider: ProviderMeta; mode: "create" | "update" } | null>(
    null
  );
  const [removing, setRemoving] = useState<CrmConnection | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await apiFetch<CrmConnection[]>("/api/partner/crm-connections");
      setItems(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить подключения");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function connectionOf(providerId: ProviderId) {
    return items.find((item) => item.provider === providerId);
  }

  async function submitCredentials(values: Record<string, string>, portalUrl: string) {
    if (!dialog) return;
    const existing = connectionOf(dialog.provider.id);
    setSaving(true);
    try {
      if (dialog.mode === "update" && existing) {
        await apiFetch(`/api/partner/crm-connections/${existing.id}/credentials`, {
          method: "PUT",
          body: JSON.stringify({ portalUrl, credentials: values })
        });
        toast.success("Ключ обновлён");
      } else {
        await apiFetch("/api/partner/crm-connections", {
          method: "POST",
          body: JSON.stringify({ provider: dialog.provider.id, portalUrl, credentials: values })
        });
        toast.success(`${dialog.provider.label} подключён`);
      }
      setDialog(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function setEnabled(connection: CrmConnection, isEnabled: boolean) {
    setBusyId(connection.id);
    try {
      await apiFetch(`/api/partner/crm-connections/${connection.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled })
      });
      setItems((prev) =>
        prev.map((row) => (row.id === connection.id ? { ...row, isEnabled } : row))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить");
    } finally {
      setBusyId(null);
    }
  }

  async function removeConnection(connection: CrmConnection) {
    setBusyId(connection.id);
    try {
      await apiFetch(`/api/partner/crm-connections/${connection.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((row) => row.id !== connection.id));
      toast.success("Подключение удалено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setBusyId(null);
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Пока адаптеры не отправляют заявки — интерфейс не должен обещать обратное */}
      <Alert>
        <IconAlertCircle />
        <AlertDescription>
          Заявки с сайта сейчас собираются в кабинете. Автоматическая передача в CRM ещё не
          включена — подключение сохранится и заработает, как только мы её включим.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>CRM</CardTitle>
          <CardDescription>
            Одна CRM на кабинет: заявки уйдут в то подключение, которое включено.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-2">
            {PROVIDERS.map((provider) => {
              const connection = connectionOf(provider.id);
              const busy = connection ? busyId === connection.id : false;
              const otherEnabled = items.some(
                (item) => item.provider !== provider.id && item.isEnabled
              );

              return (
                <div
                  key={provider.id}
                  className={cn(
                    // min-w-0: без него grid-элемент растягивается под текст
                    // и карточка вылезает за экран телефона
                    "flex min-w-0 flex-col gap-3 rounded-xl border p-4",
                    "transition-colors duration-150",
                    connection?.isEnabled && "border-primary/30 bg-primary/[0.03]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <ProviderMark mark={provider.mark} muted={!connection} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{provider.label}</p>
                      <p className="text-muted-foreground text-sm">
                        {connection ? (
                          <span className="block truncate">
                            {providerHost(connection.portalUrl)}
                          </span>
                        ) : (
                          provider.purpose
                        )}
                      </p>
                    </div>

                    {connection && canManage ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground shrink-0"
                            aria-label={`Действия: ${provider.label}`}
                            disabled={busy}
                          >
                            <IconDotsVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => setDialog({ provider, mode: "update" })}
                          >
                            <IconKey />
                            Заменить ключ
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setRemoving(connection)}
                          >
                            <IconTrash />
                            Удалить подключение
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>

                  {connection ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-muted-foreground text-sm">
                        {connection.isEnabled ? "Заявки пойдут сюда" : "Выключено"}
                        {connection.secretHint ? (
                          <>
                            {" · "}
                            <span className="font-mono text-xs">ключ {connection.secretHint}</span>
                          </>
                        ) : null}
                      </p>
                      {canManage ? (
                        <Switch
                          checked={connection.isEnabled}
                          disabled={busy}
                          onCheckedChange={(checked) => void setEnabled(connection, checked)}
                          aria-label={
                            connection.isEnabled
                              ? `Выключить ${provider.label}`
                              : `Включить ${provider.label}`
                          }
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-muted-foreground text-sm">Не подключено</p>
                      {canManage ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDialog({ provider, mode: "create" })}
                        >
                          Подключить
                        </Button>
                      ) : null}
                    </div>
                  )}

                  {connection?.isEnabled && otherEnabled ? (
                    <p className="text-muted-foreground text-xs">
                      Включено две CRM — заявка уйдёт только в одну из них.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!canManage ? (
            <p className="text-muted-foreground mt-4 text-sm">
              Подключения меняет владелец кабинета.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Что настраивается в другом месте</CardTitle>
          <CardDescription>
            Эти вещи относятся к сайту, поэтому живут в его разделе.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
              <span className="text-muted-foreground">Копии заявок на почту</span>
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <a href="/partner/site?tab=leads">Сайт → Заявки</a>
              </Button>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-3 py-3 last:pb-0">
              <span className="text-muted-foreground">Яндекс Метрика и Google Tag Manager</span>
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <a href="/partner/site?tab=seo">Сайт → Продвижение</a>
              </Button>
            </li>
          </ul>
        </CardContent>
      </Card>

      {dialog ? (
        <CredentialsDialog
          provider={dialog.provider}
          open
          mode={dialog.mode}
          saving={saving}
          onOpenChange={(next) => {
            if (!next) setDialog(null);
          }}
          onSubmit={(values, portalUrl) => void submitCredentials(values, portalUrl)}
        />
      ) : null}

      <AlertDialog open={Boolean(removing)} onOpenChange={(next) => !next && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить подключение?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing
                ? `${PROVIDERS.find((p) => p.id === removing.provider)?.label ?? "CRM"} — ${providerHost(removing.portalUrl)}. Ключ будет стёрт, подключать придётся заново. Чтобы просто приостановить передачу, хватит переключателя.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => removing && void removeConnection(removing)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
