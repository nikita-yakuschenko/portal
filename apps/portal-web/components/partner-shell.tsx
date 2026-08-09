"use client";

import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { apiFetch } from "@/lib/api";
import { partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";
import type { PartnerSiteDraft } from "@/lib/partner-site-draft";

type PartnerShellProps = {
  currentPath: string;
  title?: string;
  breadcrumbs?: React.ReactNode;
  headerActions?: React.ReactNode;
  headerCenter?: React.ReactNode;
  fluidContent?: boolean;
  children: React.ReactNode;
};

type MeResponse = {
  partner: { companyName: string } | null;
};

type SiteResponse = {
  config: PartnerSiteDraft;
};

export function PartnerShell({
  currentPath,
  title,
  breadcrumbs,
  headerActions,
  headerCenter,
  fluidContent,
  children
}: PartnerShellProps) {
  const [brandTitle, setBrandTitle] = useState("Партнёр");
  const [brandLogoSrc, setBrandLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // По отдельности: падение site не должно оставлять AVGST в шапке
      const [me, site] = await Promise.all([
        apiFetch<MeResponse>("/api/partner/me").catch(() => null),
        apiFetch<SiteResponse>("/api/partner/site").catch(() => null)
      ]);
      if (cancelled) return;

      const name =
        me?.partner?.companyName?.trim() ||
        site?.config?.name?.trim() ||
        "Партнёр";
      const logo =
        site?.config?.logoMobileDataUrl?.trim() ||
        site?.config?.logoDataUrl?.trim() ||
        null;

      setBrandTitle(name);
      setBrandLogoSrc(logo);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell
      cabinetKind="partner"
      cabinetLabel={partnerCabinetLabel}
      brandTitle={brandTitle}
      brandLogoSrc={brandLogoSrc}
      brandHref="/partner"
      currentPath={currentPath}
      navigation={partnerNavigation}
      {...(title !== undefined ? { title } : {})}
      {...(breadcrumbs !== undefined ? { breadcrumbs } : {})}
      {...(headerActions !== undefined ? { headerActions } : {})}
      {...(headerCenter !== undefined ? { headerCenter } : {})}
      {...(fluidContent !== undefined ? { fluidContent } : {})}
    >
      {children}
    </DashboardShell>
  );
}
