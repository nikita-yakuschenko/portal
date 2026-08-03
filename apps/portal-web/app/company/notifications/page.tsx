"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { NotificationsPageContent } from "@/components/notifications-page-content";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

export default function CompanyNotificationsPage() {
  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/notifications"
      navigation={companyNavigation}
      title="Уведомления"
    >
      <NotificationsPageContent />
    </DashboardShell>
  );
}
