import type { Metadata } from "next";
import type { PartnerSiteDraft } from "@b2b/site-schema";

export type ResolvedPublicSite = {
  partnerId: string;
  config: PartnerSiteDraft;
  partner?: {
    companyName: string;
    legalName?: string | null;
  };
};

function apiBase(): string {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

/** Резолв опубликованного сайта по Host (для SSR meta и brand-asset routes). */
export async function fetchPublishedSiteByHost(
  host: string
): Promise<ResolvedPublicSite | null> {
  const cleaned = host.trim().toLowerCase().replace(/:\d+$/, "");
  if (!cleaned) return null;

  try {
    const response = await fetch(
      `${apiBase()}/api/public/sites/resolve?host=${encodeURIComponent(cleaned)}`,
      { next: { revalidate: 30 } }
    );
    if (!response.ok) return null;
    return (await response.json()) as ResolvedPublicSite;
  } catch {
    return null;
  }
}

export function siteDisplayTitle(config: PartnerSiteDraft, companyName?: string): string {
  return (
    config.seoTitle.trim() ||
    config.name.trim() ||
    companyName?.trim() ||
    "Сайт"
  );
}

export function siteDisplayDescription(config: PartnerSiteDraft, companyName?: string): string {
  const fromSeo = config.seoDescription.trim();
  if (fromSeo) return fromSeo;
  const brand = config.name.trim() || companyName?.trim();
  if (brand) {
    return `${brand} помогает выбрать проект, рассчитать смету и построить дом.`;
  }
  return "";
}

/** data:... → байты и content-type */
export function decodeDataUrl(
  dataUrl: string
): { body: Buffer; contentType: string } | null {
  const raw = dataUrl.trim();
  const match = /^data:([^;,]+)?((?:;[^,]*)*),([\s\S]*)$/i.exec(raw);
  if (!match) return null;

  const contentType = (match[1] || "application/octet-stream").trim();
  const params = match[2] || "";
  const payload = match[3] || "";
  const isBase64 = /;base64/i.test(params);

  try {
    if (isBase64) {
      return { body: Buffer.from(payload, "base64"), contentType };
    }
    return {
      body: Buffer.from(decodeURIComponent(payload.replace(/\s/g, ""))),
      contentType
    };
  } catch {
    return null;
  }
}

export function pickBrandImageDataUrl(config: PartnerSiteDraft): string {
  return config.faviconDataUrl.trim() || config.logoDataUrl.trim();
}

export function pickOgImageDataUrl(config: PartnerSiteDraft): string {
  return config.logoDataUrl.trim() || config.faviconDataUrl.trim();
}

export function buildPublicSiteMetadata(input: {
  host: string;
  protocol: string;
  site: ResolvedPublicSite | null;
}): Metadata {
  const { host, protocol, site } = input;
  const origin = `${protocol}://${host.replace(/:\d+$/, "")}`;

  if (!site) {
    return {
      title: "Сайт",
      description: undefined
    };
  }

  const title = siteDisplayTitle(site.config, site.partner?.companyName);
  const description = siteDisplayDescription(site.config, site.partner?.companyName);
  const hasIcon = Boolean(pickBrandImageDataUrl(site.config));
  const hasOg = Boolean(pickOgImageDataUrl(site.config));
  const iconUrl = `${origin}/site-branding/icon`;
  const ogUrl = `${origin}/site-branding/og`;

  return {
    metadataBase: new URL(origin),
    title: { absolute: title },
    description: description || undefined,
    icons: hasIcon
      ? {
          icon: [{ url: iconUrl }],
          apple: [{ url: iconUrl }]
        }
      : undefined,
    openGraph: {
      type: "website",
      locale: "ru_RU",
      url: origin,
      siteName: title,
      title,
      description: description || undefined,
      images: hasOg ? [{ url: ogUrl, alt: title }] : undefined
    },
    twitter: {
      card: hasOg ? "summary_large_image" : "summary",
      title,
      description: description || undefined,
      images: hasOg ? [ogUrl] : undefined
    }
  };
}
