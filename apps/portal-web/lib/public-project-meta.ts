import type { Metadata } from "next";

import {
  fetchPublishedSiteByHost,
  siteDisplayTitle,
  type ResolvedPublicSite
} from "@/lib/public-site-meta";
import { projectShareCopy, type ProjectShareInput } from "@/lib/project-share-copy";
import { primaryImage, type StorefrontProject } from "@/lib/partner-site-preview";

function apiBase(): string {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export async function fetchPublicStorefrontProject(
  partnerId: string,
  key: string
): Promise<StorefrontProject | null> {
  try {
    const response = await fetch(
      `${apiBase()}/api/public/sites/${encodeURIComponent(partnerId)}/projects/${encodeURIComponent(key)}`,
      { next: { revalidate: 60 } }
    );
    if (!response.ok) return null;
    return (await response.json()) as StorefrontProject;
  } catch {
    return null;
  }
}

function companyForShare(site: ResolvedPublicSite): string {
  return site.config.name.trim() || site.partner?.companyName?.trim() || "";
}

export function buildProjectShareMetadata(input: {
  host: string;
  protocol: string;
  slug: string;
  site: ResolvedPublicSite;
  project: StorefrontProject;
}): Metadata {
  const { host, protocol, slug, site, project } = input;
  const origin = `${protocol}://${host.replace(/:\d+$/, "")}`;
  const company = companyForShare(site);
  const siteName = siteDisplayTitle(site.config, site.partner?.companyName);

  const shareInput: ProjectShareInput = {
    name: project.name,
    technology: project.technology,
    floors: project.floors,
    area: project.area,
    bedrooms: project.bedrooms,
    bathrooms: project.bathrooms
  };
  const { title, description } = projectShareCopy(shareInput, company);
  const hasImage = Boolean(primaryImage(project));
  const pageUrl = `${origin}/catalog/${encodeURIComponent(slug)}`;
  // Без ?query — Telegram часто не подтягивает og:image с параметрами
  const ogImage = `${origin}/site-branding/project-og/${encodeURIComponent(slug)}.jpg`;
  const shortTitle = title.replace(/\.$/, "");
  // site_name короткий, иначе Telegram ставит его вместо title
  const brand = company || siteName;

  return {
    metadataBase: new URL(origin),
    title: { absolute: shortTitle },
    description: description || undefined,
    openGraph: {
      type: "website",
      locale: "ru_RU",
      url: pageUrl,
      siteName: brand,
      title: shortTitle,
      description: description || undefined,
      images: hasImage
        ? [
            {
              url: ogImage,
              secureUrl: ogImage,
              alt: project.name,
              type: "image/jpeg",
              width: 1200,
              height: 630
            }
          ]
        : undefined
    },
    twitter: {
      card: hasImage ? "summary_large_image" : "summary",
      title: shortTitle,
      description: description || undefined,
      images: hasImage ? [ogImage] : undefined
    }
  };
}
