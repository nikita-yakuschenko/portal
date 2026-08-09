"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type CrmConnection = {
  id: string;
  provider: string;
  portalUrl: string;
  isEnabled: boolean;
};

type ProviderId = "bitrix24" | "amocrm";

const PROVIDERS: { id: ProviderId; label: string; mark: string }[] = [
  { id: "bitrix24", label: "Bitrix24", mark: "B24" },
  { id: "amocrm", label: "amoCRM", mark: "amo" }
];

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function ProviderMark({ mark, active }: { mark: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold tracking-tight transition-colors duration-150",
        active
          ? "border-primary/25 bg-primary/10 text-foreground"
          : "border-border bg-muted/60 text-foreground"
      )}
      aria-hidden
    >
      {mark}
    </span>
  );
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full transition-colors duration-150",
        on ? "bg-primary" : "bg-muted-foreground/40"
      )}
      aria-hidden
    />
  );
}

export function PartnerCrmPanel({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<CrmConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftProvider, setDraftProvider] = useState<ProviderId | null>(null);
  const [portalUrl, setPortalUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  const load = useCallback(async () => {
    try {
      const rows = await apiFetch<CrmConnection[]>("/api/partner/crm-connections");
      setItems(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetDraft() {
    setPortalUrl("");
    setWebhookUrl("");
    setClientId("");
    setClientSecret("");
    setRefreshToken("");
  }

  function openDraft(provider: ProviderId) {
    resetDraft();
    setDraftProvider((prev) => (prev === provider ? null : provider));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!draftProvider) return;
    setSaving(true);

    const credentials =
      draftProvider === "bitrix24"
        ? { webhookUrl }
        : { clientId, clientSecret, refreshToken };

    try {
      await apiFetch("/api/partner/crm-connections", {
        method: "POST",
        body: JSON.stringify({
          provider: draftProvider,
          portalUrl,
          credentials
        })
      });
      toast.success("Сохранено");
      resetDraft();
      setDraftProvider(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function setEnabled(id: string, isEnabled: boolean) {
    setBusyId(id);
    try {
      await apiFetch(`/api/partner/crm-connections/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled })
      });
      setItems((prev) =>
        prev.map((row) => (row.id === id ? { ...row, isEnabled } : row))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить");
    } finally {
      setBusyId(null);
    }
  }

  async function removeConnection(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/api/partner/crm-connections/${id}`, { method: "DELETE" });
      toast.success("Удалено");
      setItems((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CRM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-[4.25rem] w-full rounded-xl" />
          <Skeleton className="h-[4.25rem] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CRM</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {PROVIDERS.map((provider) => {
          const connections = items.filter((item) => item.provider === provider.id);
          const drafting = draftProvider === provider.id;

          return (
            <div
              key={provider.id}
              className={cn(
                "overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-200",
                drafting ? "border-foreground/15 shadow-xs" : "border-border"
              )}
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <ProviderMark mark={provider.mark} active={connections.some((c) => c.isEnabled)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium tracking-tight">{provider.label}</p>
                  {connections.length === 0 ? (
                    <p className="text-muted-foreground text-xs">Не подключено</p>
                  ) : null}
                </div>

                {connections.length === 0 && canManage ? (
                  <Button
                    type="button"
                    variant={drafting ? "secondary" : "outline"}
                    size="sm"
                    className="active:scale-[0.97]"
                    onClick={() => openDraft(provider.id)}
                  >
                    {drafting ? "Отмена" : "Подключить"}
                  </Button>
                ) : null}
              </div>

              {connections.map((item) => (
                <div
                  key={item.id}
                  className="border-border flex flex-wrap items-center gap-3 border-t px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <StatusDot on={item.isEnabled} />
                    <p className="text-muted-foreground truncate text-sm">{item.portalUrl}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage ? (
                      <>
                        <Switch
                          checked={item.isEnabled}
                          disabled={busyId === item.id}
                          onCheckedChange={(checked) => void setEnabled(item.id, checked)}
                          aria-label={item.isEnabled ? "Выключить" : "Включить"}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive active:scale-[0.97]"
                              disabled={busyId === item.id}
                              aria-label="Удалить"
                            >
                              <IconTrash className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Удалить подключение?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {provider.label}: {item.portalUrl}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-white hover:bg-destructive/90"
                                onClick={() => void removeConnection(item.id)}
                              >
                                Удалить
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {item.isEnabled ? "Включено" : "Выключено"}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              <AnimatePresence initial={false}>
                {drafting && canManage ? (
                  <motion.div
                    key={`${provider.id}-form`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: EASE_OUT }}
                    className="overflow-hidden"
                  >
                    <form
                      onSubmit={(event) => void handleCreate(event)}
                      className="border-border bg-muted/40 border-t px-4 py-4"
                    >
                      <FieldGroup className="gap-3">
                        <Field>
                          <FieldLabel htmlFor={`${provider.id}-portal`}>URL портала</FieldLabel>
                          <Input
                            id={`${provider.id}-portal`}
                            type="url"
                            required
                            autoComplete="off"
                            value={portalUrl}
                            onChange={(e) => setPortalUrl(e.target.value)}
                          />
                        </Field>

                        {provider.id === "bitrix24" ? (
                          <Field>
                            <FieldLabel htmlFor={`${provider.id}-webhook`}>Webhook URL</FieldLabel>
                            <Input
                              id={`${provider.id}-webhook`}
                              type="password"
                              required
                              autoComplete="off"
                              value={webhookUrl}
                              onChange={(e) => setWebhookUrl(e.target.value)}
                            />
                          </Field>
                        ) : (
                          <>
                            <Field>
                              <FieldLabel htmlFor={`${provider.id}-client`}>Client ID</FieldLabel>
                              <Input
                                id={`${provider.id}-client`}
                                required
                                autoComplete="off"
                                value={clientId}
                                onChange={(e) => setClientId(e.target.value)}
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`${provider.id}-secret`}>
                                Client Secret
                              </FieldLabel>
                              <Input
                                id={`${provider.id}-secret`}
                                type="password"
                                required
                                autoComplete="off"
                                value={clientSecret}
                                onChange={(e) => setClientSecret(e.target.value)}
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`${provider.id}-refresh`}>
                                Refresh Token
                              </FieldLabel>
                              <Input
                                id={`${provider.id}-refresh`}
                                type="password"
                                required
                                autoComplete="off"
                                value={refreshToken}
                                onChange={(e) => setRefreshToken(e.target.value)}
                              />
                            </Field>
                          </>
                        )}
                      </FieldGroup>

                      <div className="flex justify-end pt-4">
                        <Button
                          type="submit"
                          disabled={saving}
                          className="active:scale-[0.97]"
                        >
                          {saving ? <Spinner /> : null}
                          {saving ? "Сохраняем…" : "Сохранить"}
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
