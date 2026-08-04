"use client";

import { PartnerShell } from "@/components/partner-shell";
import { MessengerPageContent } from "@/components/messenger-page-content";

export default function PartnerMessengerPage() {
  return (
    <PartnerShell currentPath="/partner/messenger" title="Мессенджер">
      <MessengerPageContent />
    </PartnerShell>
  );
}
