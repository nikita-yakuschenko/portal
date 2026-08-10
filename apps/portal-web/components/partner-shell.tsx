"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { DealerSunsetNotice } from "@/components/partner-general/dealer-sunset-notice";
import { apiFetch } from "@/lib/api";
import { dealerGuestNavigation, partnerAccountMenu, partnerCabinetLabel, partnerNavigation } from "@/lib/partner-nav";
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
  user: { role: string } | null;
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
  /** Общий дилерский вход: кабинета у него нет, только общий раздел */
  const [isGuest, setIsGuest] = useState(false);
  /** Пока роль не известна — меню кабинета не показываем, чтобы гостю не мелькнули «Настройки» */
  const [roleReady, setRoleReady] = useState(false);
  const router = useRouter();

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

      const guest = me?.user?.role === "dealer_guest";
      setIsGuest(guest);
      setRoleReady(true);
      // Ручной заход на чужую страницу кабинета: API её всё равно не отдаст,
      // но упереться в ошибку хуже, чем вернуться туда, где есть содержимое
      if (guest && !currentPath.startsWith("/partner/general")) {
        router.replace("/partner/general");
      }
      setBrandTitle(guest ? "Дилерам AVGST" : name);
      setBrandLogoSrc(logo);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPath, router]);

  return (
    <DashboardShell
      cabinetKind="partner"
      cabinetLabel={partnerCabinetLabel}
      brandTitle={brandTitle}
      brandLogoSrc={brandLogoSrc}
      brandHref={isGuest ? "/partner/general" : "/partner"}
      currentPath={currentPath}
      navigation={isGuest ? dealerGuestNavigation : partnerNavigation}
      accountMenuItems={roleReady && !isGuest ? partnerAccountMenu : []}
      {...(title !== undefined ? { title } : {})}
      {...(breadcrumbs !== undefined ? { breadcrumbs } : {})}
      {...(headerActions !== undefined ? { headerActions } : {})}
      {...(headerCenter !== undefined ? { headerCenter } : {})}
      {...(fluidContent !== undefined ? { fluidContent } : {})}
    >
      {children}
      <DealerSunsetNotice enabled={roleReady && isGuest} />
    </DashboardShell>
  );
}
