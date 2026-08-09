import { PARTNER_SITE_SOCIALS } from "@/lib/partner-site-socials";
import { slugifySubdomain, type PartnerSiteDraft } from "@/lib/partner-site-draft";

/** Разделы формы сайта — совпадают со значениями таба в адресной строке */
export const SITE_TABS = ["general", "contacts", "content", "texts", "leads", "seo"] as const;
export type SiteTab = (typeof SITE_TABS)[number];

export const SITE_TAB_LABELS: Record<SiteTab, string> = {
  general: "Адрес и бренд",
  contacts: "Контакты",
  content: "Проекты",
  texts: "Тексты",
  leads: "Заявки",
  seo: "Продвижение"
};

/** Поля формы, у которых бывают ошибки */
export type SiteFieldKey =
  | "name"
  | "subdomain"
  | "domain"
  | "contactPhone"
  | "contactEmail"
  | "inquiryEmail"
  | "postLeadOfferSocials"
  | (typeof PARTNER_SITE_SOCIALS)[number]["field"];

/** В каком разделе искать поле — нужно, чтобы увести пользователя к ошибке */
export const SITE_FIELD_TAB: Record<SiteFieldKey, SiteTab> = {
  name: "general",
  subdomain: "general",
  domain: "general",
  contactPhone: "contacts",
  contactEmail: "contacts",
  socialVk: "contacts",
  socialInstagram: "contacts",
  socialYoutube: "contacts",
  socialDzen: "contacts",
  socialTelegram: "contacts",
  socialMax: "contacts",
  inquiryEmail: "leads",
  postLeadOfferSocials: "leads"
};

/** id инпута для фокуса: держим в одном месте с разметкой */
export const SITE_FIELD_INPUT_ID: Record<SiteFieldKey, string> = {
  name: "site-name",
  subdomain: "site-subdomain",
  domain: "site-domain",
  contactPhone: "site-phone",
  contactEmail: "site-email",
  socialVk: "site-vk",
  socialInstagram: "site-instagram",
  socialYoutube: "site-youtube",
  socialDzen: "site-dzen",
  socialTelegram: "site-telegram",
  socialMax: "site-max",
  inquiryEmail: "site-inquiry-email",
  postLeadOfferSocials: "site-post-lead-switch"
};

export type SiteErrors = Partial<Record<SiteFieldKey, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Латиница, цифры и дефисы в метках — то, что принимает DNS
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
// Телефон проверяем по числу цифр, а не по маске: партнёры пишут в разных форматах
const PHONE_DIGITS_MIN = 10;

function cleanDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

/**
 * Проверяет черновик целиком. Возвращает карту «поле → текст ошибки»:
 * форма подсвечивает поля сама, а вызывающий код по первому ключу знает,
 * на какой раздел переключиться.
 */
export function validatePartnerSiteDraft(draft: PartnerSiteDraft): SiteErrors {
  const errors: SiteErrors = {};

  if (!draft.name.trim()) {
    errors.name = "Укажите название — оно стоит в шапке сайта и в поиске.";
  }

  const subdomain = draft.subdomain.trim();
  if (!subdomain) {
    errors.subdomain = "Укажите адрес сайта на avgst.ru.";
  } else if (slugifySubdomain(subdomain) === "partner" && subdomain.toLowerCase() !== "partner") {
    errors.subdomain = "В адресе нужны латинские буквы или цифры: например spb-doma.";
  }

  const domain = draft.domain.trim();
  if (domain && !DOMAIN_RE.test(cleanDomain(domain))) {
    errors.domain = "Домен пишется латиницей, без http:// и без пути: например stroy-dom.ru.";
  }

  const phoneDigits = draft.contactPhone.replace(/\D/g, "");
  if (!draft.contactPhone.trim()) {
    errors.contactPhone = "Укажите телефон — по нему звонят с сайта.";
  } else if (phoneDigits.length < PHONE_DIGITS_MIN) {
    errors.contactPhone = "В номере не хватает цифр.";
  }

  if (!draft.contactEmail.trim()) {
    errors.contactEmail = "Укажите почту — её видит покупатель на сайте.";
  } else if (!EMAIL_RE.test(draft.contactEmail.trim())) {
    errors.contactEmail = "Проверьте адрес почты: похоже на опечатку.";
  }

  const inquiryEmail = draft.inquiryEmail.trim();
  if (inquiryEmail && !EMAIL_RE.test(inquiryEmail)) {
    errors.inquiryEmail = "Проверьте адрес почты: похоже на опечатку.";
  }

  for (const social of PARTNER_SITE_SOCIALS) {
    const value = String(draft[social.field] ?? "").trim();
    if (!value) continue;
    if (!/^https?:\/\//i.test(value)) {
      errors[social.field] = "Нужна полная ссылка, начиная с https://";
      continue;
    }
    try {
      new URL(value);
    } catch {
      errors[social.field] = "Ссылка не открывается — проверьте адрес.";
    }
  }

  // Ротация обещает показать сеть после заявки: без ссылок показывать нечего
  const offered = draft.postLeadOfferSocials ?? [];
  if (offered.length > 0) {
    const withLink = offered.filter((id) => {
      const social = PARTNER_SITE_SOCIALS.find((item) => item.id === id);
      return social ? String(draft[social.field] ?? "").trim().length > 0 : false;
    });
    if (withLink.length === 0) {
      errors.postLeadOfferSocials =
        "У выбранных сетей нет ссылок — покупателю будет некуда перейти.";
    }
  }

  return errors;
}

/** Первое поле с ошибкой в порядке разделов — куда вести пользователя */
export function firstErrorField(errors: SiteErrors): SiteFieldKey | null {
  const keys = Object.keys(errors) as SiteFieldKey[];
  if (keys.length === 0) return null;
  const order = (key: SiteFieldKey) => SITE_TABS.indexOf(SITE_FIELD_TAB[key]);
  return keys.sort((a, b) => order(a) - order(b))[0] ?? null;
}

export function countErrors(errors: SiteErrors): number {
  return Object.keys(errors).length;
}
