import type { Metadata } from "next";
import { headers } from "next/headers";

import { fetchPublishedSiteByHost } from "@/lib/public-site-meta";
import {
  buildProjectShareMetadata,
  fetchPublicStorefrontProject
} from "@/lib/public-project-meta";

const SITE_MODE = process.env.APP_ROLE === "site" || process.env.NEXT_PUBLIC_APP_ROLE === "site";

type PageParams = { slug: string };

export async function generateMetadata({
  params
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  if (!SITE_MODE) return {};

  const { slug } = await params;
  if (!slug?.trim()) return {};

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const protocol = h.get("x-forwarded-proto") ?? "https";
  const site = await fetchPublishedSiteByHost(host);
  if (!site) return {};

  const project = await fetchPublicStorefrontProject(site.partnerId, slug);
  if (!project) return {};

  return buildProjectShareMetadata({ host, protocol, slug, site, project });
}

export default function ProjectShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
