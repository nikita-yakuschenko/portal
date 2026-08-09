/** Сделка кабинета: пришла с формы на сайте, дальше её ведёт партнёр */

export type DealStatus = "new" | "in_progress" | "won" | "lost";
export type CrmStatus = "skipped" | "pending" | "sent" | "failed";

/** Человек, с которым общаемся. Один на все свои сделки */
export type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
};

export type DealEventType =
  | "created"
  | "status_changed"
  | "note"
  | "crm_delivery"
  | "field_changed"
  | "contact_changed";

export type DealEvent = {
  id: string;
  type: DealEventType;
  payload: Record<string, unknown>;
  authorName: string | null;
  createdAt: string;
};

export type Deal = {
  id: string;
  title: string;
  amount: number | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  contact: Contact | null;
  projectId: string | null;
  projectName: string | null;
  formName: string;
  message: string | null;
  utm: Record<string, string>;
  pageUrl: string | null;
  status: DealStatus;
  statusChangedAt: string | null;
  note: string | null;
  crmStatus: CrmStatus;
  crmError: string | null;
  createdAt: string;
};

export type DealDetails = Deal & { events: DealEvent[] };

/** Порядок колонок на доске */
export const DEAL_STATUSES: DealStatus[] = ["new", "in_progress", "won", "lost"];

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  won: "Успех",
  lost: "Отказ"
};

/** Цвет статуса несёт смысл, а не украшает */
export const DEAL_STATUS_DOT: Record<DealStatus, string> = {
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

export function formatDealDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatDealDateFull(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatAmount(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(amount);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function statusLabel(value: unknown): string {
  const key = asString(value) as DealStatus;
  return DEAL_STATUS_LABEL[key] ?? key;
}

const FIELD_LABEL: Record<string, string> = {
  title: "Название",
  amount: "Сумма",
  assignee: "Ответственный"
};

/** Строка ленты: что произошло. Автор и время дописываются отдельно */
export function describeEvent(event: DealEvent): { title: string; detail?: string } {
  switch (event.type) {
    case "created": {
      const form = asString(event.payload.formName);
      return { title: "Заявка с сайта", ...(form ? { detail: form } : {}) };
    }
    case "status_changed":
      return { title: `${statusLabel(event.payload.from)} → ${statusLabel(event.payload.to)}` };
    case "note":
      return event.payload.cleared === true
        ? { title: "Заметка удалена" }
        : { title: "Заметка", detail: asString(event.payload.text) };
    case "field_changed": {
      const field = asString(event.payload.field);
      const label = FIELD_LABEL[field] ?? field;
      if (field === "amount") {
        const to = event.payload.to;
        return {
          title: `${label} изменена`,
          detail: typeof to === "number" ? formatAmount(to) : "убрана"
        };
      }
      if (field === "assignee") {
        return { title: event.payload.to ? "Назначен ответственный" : "Ответственный снят" };
      }
      const to = asString(event.payload.to);
      return { title: `${label} изменено`, ...(to ? { detail: to } : {}) };
    }
    case "contact_changed": {
      const changed = Array.isArray(event.payload.changed)
        ? (event.payload.changed as unknown[]).map(asString).filter(Boolean)
        : [];
      return {
        title: "Контакт изменён",
        ...(changed.length > 0 ? { detail: `Обновили ${changed.join(", ")}` } : {})
      };
    }
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
