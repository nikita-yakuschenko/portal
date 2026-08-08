import type { PartnerSiteDraft } from "@/lib/partner-site-draft";

/** Каталог соцсетей сайта партнёра */
export const PARTNER_SITE_SOCIALS = [
  {
    id: "vk",
    label: "ВКонтакте",
    field: "socialVk",
    placeholder: "https://vk.com/..."
  },
  {
    id: "instagram",
    label: "Instagram",
    field: "socialInstagram",
    placeholder: "https://instagram.com/..."
  },
  {
    id: "youtube",
    label: "YouTube",
    field: "socialYoutube",
    placeholder: "https://youtube.com/@..."
  },
  {
    id: "dzen",
    label: "Дзен",
    field: "socialDzen",
    placeholder: "https://dzen.ru/..."
  },
  {
    id: "telegram",
    label: "Telegram",
    field: "socialTelegram",
    placeholder: "https://t.me/..."
  },
  {
    id: "max",
    label: "MAX",
    field: "socialMax",
    placeholder: "https://max.ru/..."
  }
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  field: keyof PartnerSiteDraft;
  placeholder: string;
}>;

export type PartnerSiteSocialId = (typeof PARTNER_SITE_SOCIALS)[number]["id"];

export type PartnerSiteSocialLink = {
  id: PartnerSiteSocialId;
  label: string;
  href: string;
};

/** Демо-ссылки для тестового дилера — чтобы в подвале были все иконки */
export const DEMO_PARTNER_SITE_SOCIAL_URLS: Record<
  (typeof PARTNER_SITE_SOCIALS)[number]["field"],
  string
> = {
  socialVk: "https://vk.com/avgst",
  socialInstagram: "https://instagram.com/avgst",
  socialYoutube: "https://youtube.com/@avgst",
  // Настоящий канал: dzen.ru/avgst — чужой профиль, показывать его нельзя
  socialDzen: "https://dzen.ru/avgstroy",
  socialTelegram: "https://t.me/avgst",
  socialMax: "https://max.ru/"
};

function isDemoPartnerName(name: string): boolean {
  return /демо/i.test(name.trim());
}

/** Для демо-дилера подставляет ссылки во все пустые соцсети */
export function withDemoPartnerSocials(draft: PartnerSiteDraft): PartnerSiteDraft {
  if (!isDemoPartnerName(draft.name)) return draft;
  const next = { ...draft };
  for (const item of PARTNER_SITE_SOCIALS) {
    if (String(next[item.field] ?? "").trim()) continue;
    next[item.field] = DEMO_PARTNER_SITE_SOCIAL_URLS[item.field];
  }
  return next;
}

/** Только сети, для которых админ указал ссылку */
export function resolvePartnerSiteSocials(draft: PartnerSiteDraft): PartnerSiteSocialLink[] {
  const links: PartnerSiteSocialLink[] = [];
  for (const item of PARTNER_SITE_SOCIALS) {
    const href = String(draft[item.field] ?? "").trim();
    if (!href) continue;
    links.push({
      id: item.id,
      label: item.label,
      href
    });
  }
  return links;
}

/**
 * Пул сетей для ротации после заявки (выбраны админом + есть ссылка).
 * Порядок = порядок в PARTNER_SITE_SOCIALS.
 */
export function resolvePostLeadSocialPool(draft: PartnerSiteDraft): PartnerSiteSocialLink[] {
  const wanted = new Set(
    (draft.postLeadOfferSocials ?? [])
      .map((id) => String(id).trim().toLowerCase())
      .filter(Boolean)
  );
  if (wanted.size === 0) return [];
  return resolvePartnerSiteSocials(draft).filter((link) => wanted.has(link.id));
}

/** @deprecated используйте resolvePostLeadSocialPool + takeNextPostLeadSocial */
export function resolvePostLeadSocial(draft: PartnerSiteDraft): PartnerSiteSocialLink | null {
  return resolvePostLeadSocialPool(draft)[0] ?? null;
}

const POST_LEAD_ROTATION_KEY = "avgst.partner.site.postLeadSocialRotation";

/**
 * Следующая сеть из пула (round-robin на каждую заявку).
 * Курсор в localStorage — переживает перезагрузку превью.
 */
export function takeNextPostLeadSocial(
  pool: PartnerSiteSocialLink[]
): PartnerSiteSocialLink | null {
  if (pool.length === 0) return null;
  let index = 0;
  try {
    const raw = localStorage.getItem(POST_LEAD_ROTATION_KEY);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) index = Math.floor(parsed);
  } catch {
    // private mode
  }
  const pick = pool[index % pool.length]!;
  try {
    localStorage.setItem(POST_LEAD_ROTATION_KEY, String(index + 1));
  } catch {
    // ignore
  }
  return pick;
}

/** Текст шага «подписка» — объект фразы зависит от сети */
export function postLeadSocialCopy(id: PartnerSiteSocialId): {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  /** Сноска к звёздочке в заголовке: нужна только там, где упомянута Meta */
  note?: string;
} {
  const description = "Проекты и ход строек — без спама в ленте.";
  const eyebrow = "Будьте на связи";

  switch (id) {
    case "vk":
      return {
        eyebrow,
        title: "Подписывайтесь на сообщество в ВКонтакте",
        description,
        cta: "Перейти во ВКонтакте"
      };
    case "telegram":
      return {
        eyebrow,
        title: "Подписывайтесь на наш Телеграм-канал",
        description,
        cta: "Перейти в Telegram"
      };
    case "max":
      return {
        eyebrow,
        title: "Подписывайтесь на канал в MAX",
        description,
        cta: "Перейти в MAX"
      };
    case "instagram":
      return {
        eyebrow,
        title: "Подписывайтесь на наш Instagram*",
        description,
        cta: "Перейти в Instagram",
        note: "*Принадлежит компании Meta Platforms, признанной экстремистской организацией на территории Российской Федерации, деятельность которой запрещена"
      };
    case "dzen":
      return {
        eyebrow,
        title: "Подписывайтесь на наш Дзен",
        description,
        cta: "Перейти в Дзен"
      };
    case "youtube":
      return {
        eyebrow,
        title: "Подписывайтесь на наш Youtube-канал",
        description,
        cta: "Перейти на YouTube"
      };
  }
}
