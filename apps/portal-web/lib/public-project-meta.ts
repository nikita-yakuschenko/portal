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
  const image = primaryImage(project);
  const pageUrl = `${origin}/catalog/${encodeURIComponent(slug)}`;

  return {
    metadataBase: new URL(origin),
    title: { absolute: title.replace(/\.$/, "") },
    description: description || undefined,
    openGraph: {
      type: "website",
      locale: "ru_RU",
      url: pageUrl,
      siteName,
      title: title.replace(/\.$/, ""),
      description: description || undefined,
      images: image ? [{ url: image, alt: project.name }] : undefined
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: title.replace(/\.$/, ""),
      description: description || undefined,
      images: image ? [image] : undefined
    }
  };
}
