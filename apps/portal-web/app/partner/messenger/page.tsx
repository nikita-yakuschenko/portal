"use client";

import { Suspense } from "react";

import { MessengerPageContent } from "@/components/messenger-page-content";
import { PartnerShell } from "@/components/partner-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function PartnerMessengerPage() {
  return (
    <PartnerShell currentPath="/partner/messenger" title="Мессенджер">
      <Suspense fallback={<Skeleton className="h-[min(78vh,820px)] w-full rounded-xl" />}>
        <MessengerPageContent audience="partner" />
      </Suspense>
    </PartnerShell>
  );
}
