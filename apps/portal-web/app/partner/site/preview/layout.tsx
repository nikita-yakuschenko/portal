import type { Metadata } from "next";
import { headers } from "next/headers";

import { PartnerSitePreviewShell } from "./preview-shell";
import {
  buildPublicSiteMetadata,
  fetchPublishedSiteByHost
} from "@/lib/public-site-meta";

const SITE_MODE = process.env.APP_ROLE === "site" || process.env.NEXT_PUBLIC_APP_ROLE === "site";

export async function generateMetadata(): Promise<Metadata> {
  // В кабинете meta ставит клиент; в site-runtime — SSR для Telegram/OG
  if (!SITE_MODE) {
    return {};
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const protocol = h.get("x-forwarded-proto") ?? "https";
  const site = await fetchPublishedSiteByHost(host);
  return buildPublicSiteMetadata({ host, protocol, site });
}

export default function PartnerSitePreviewLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <PartnerSitePreviewShell>{children}</PartnerSitePreviewShell>;
}
