"use client";

import { PartnerShell } from "@/components/partner-shell";
import { NotificationsPageContent } from "@/components/notifications-page-content";

export default function PartnerNotificationsPage() {
  return (
    <PartnerShell currentPath="/portal/notifications" title="Уведомления">
      <NotificationsPageContent />
    </PartnerShell>
  );
}
