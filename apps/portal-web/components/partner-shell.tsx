"use client";

import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import {
  PARTNER_MODULES_CHANGED,
  readPartnerModules,
  type PartnerModules
} from "@/lib/partner-modules";
import { buildPartnerNavigation, partnerCabinetLabel } from "@/lib/partner-nav";

type PartnerShellProps = {
  currentPath: string;
  title?: string;
  breadcrumbs?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
};

export function PartnerShell({
  currentPath,
  title,
  breadcrumbs,
  headerActions,
  children
}: PartnerShellProps) {
  const [modules, setModules] = useState<PartnerModules>({ leadsEnabled: false });

  useEffect(() => {
    const sync = () => setModules(readPartnerModules());
    sync();
    window.addEventListener(PARTNER_MODULES_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PARTNER_MODULES_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <DashboardShell
      cabinetLabel={partnerCabinetLabel}
      currentPath={currentPath}
      navigation={buildPartnerNavigation(modules)}
      {...(title !== undefined ? { title } : {})}
      {...(breadcrumbs !== undefined ? { breadcrumbs } : {})}
      {...(headerActions !== undefined ? { headerActions } : {})}
    >
      {children}
    </DashboardShell>
  );
}
