/** Заявка с формы на сайте партнёра — то, что видит кабинет */

export type SiteRequestStatus = "new" | "in_progress" | "won" | "lost";
export type CrmStatus = "skipped" | "pending" | "sent" | "failed";

export type SiteRequestEventType = "created" | "status_changed" | "note" | "crm_delivery";

export type SiteRequestEvent = {
  id: string;
  type: SiteRequestEventType;
  payload: Record<string, unknown>;
  authorName: string | null;
  createdAt: string;
};

export type SiteRequest = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  formName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  message: string | null;
  utm: Record<string, string>;
  pageUrl: string | null;
  status: SiteRequestStatus;
  statusChangedAt: string | null;
  note: string | null;
  crmStatus: CrmStatus;
  crmError: string | null;
  createdAt: string;
};

/** Порядок колонок канбана */
export const REQUEST_STATUSES: SiteRequestStatus[] = ["new", "in_progress", "won", "lost"];

export const REQUEST_STATUS_LABEL: Record<SiteRequestStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  won: "Успех",
  lost: "Отказ"
};

/** Точка статуса: цвет несёт смысл, а не украшает */
export const REQUEST_STATUS_DOT: Record<SiteRequestStatus, string> = {
  new: "bg-sky-500",
  in_progress: "bg-amber-500",
  won: "bg-emerald-500",
  lost: "bg-muted-foreground/40"
};

export const CRM_STATUS_LABEL: Record<Exclude<CrmStatus, "skipped">, string> = {
  pending: "Ждёт передачи",
  sent: "Передана",
  failed: "Ошибка"
};

export const CRM_STATUS_VARIANT: Record<
  Exclude<CrmStatus, "skipped">,
  "secondary" | "default" | "destructive"
> = {
  pending: "secondary",
  sent: "default",
  failed: "destructive"
};

const UTM_ORDER = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** utm_source=ya, utm_campaign=spring → «ya · spring» */
export function formatUtm(utm: Record<string, string>): string {
  return UTM_ORDER.map((key) => utm[key])
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function utmPairs(utm: Record<string, string>): Array<[string, string]> {
  return UTM_ORDER.filter((key) => utm[key]).map((key) => [key, utm[key] as string]);
}

export function formatRequestDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatRequestDateFull(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/** tel: терпит только цифры и плюс */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Заявка целиком — то, что отдаёт карточка */
export type SiteRequestDetails = SiteRequest & { events: SiteRequestEvent[] };

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function statusLabel(value: unknown): string {
  const key = asString(value) as SiteRequestStatus;
  return REQUEST_STATUS_LABEL[key] ?? key;
}

/** Строка ленты: что произошло. Автор дописывается отдельно */
export function describeEvent(event: SiteRequestEvent): { title: string; detail?: string } {
  switch (event.type) {
    case "created": {
      const form = asString(event.payload.formName);
      return { title: "Заявка с сайта", ...(form ? { detail: form } : {}) };
    }
    case "status_changed":
      return {
        title: `${statusLabel(event.payload.from)} → ${statusLabel(event.payload.to)}`
      };
    case "note":
      return event.payload.cleared === true
        ? { title: "Заметка удалена" }
        : { title: "Заметка", detail: asString(event.payload.text) };
    case "crm_delivery": {
      const status = asString(event.payload.crmStatus);
      const provider = asString(event.payload.provider);
      const titles: Record<string, string> = {
        pending: "Ждёт передачи в CRM",
        sent: "Передана в CRM",
        failed: "CRM не приняла заявку"
      };
      return {
        title: titles[status] ?? "CRM",
        ...(provider ? { detail: provider === "bitrix24" ? "Bitrix24" : "amoCRM" } : {})
      };
    }
  }
}
