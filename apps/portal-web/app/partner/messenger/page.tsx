"use client";

import { Suspense } from "react";

import { MessengerPageContent } from "@/components/messenger-page-content";
import { MessengerSectionTitle } from "@/components/messenger-section-title";
import { PartnerShell } from "@/components/partner-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function PartnerMessengerPage() {
  return (
    <PartnerShell
      currentPath="/partner/messenger"
      breadcrumbs={<MessengerSectionTitle />}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <Suspense fallback={<Skeleton className="min-h-0 w-full flex-1 rounded-xl" />}>
          <MessengerPageContent audience="partner" />
        </Suspense>
      </div>
    </PartnerShell>
  );
}
