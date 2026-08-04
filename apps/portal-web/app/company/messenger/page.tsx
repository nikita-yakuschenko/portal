"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { MessengerPageContent } from "@/components/messenger-page-content";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

export default function CompanyMessengerPage() {
  return (
    <DashboardShell
      cabinetKind="company"
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/messenger"
      navigation={companyNavigation}
      title="Мессенджер"
    >
      <MessengerPageContent />
    </DashboardShell>
  );
}
