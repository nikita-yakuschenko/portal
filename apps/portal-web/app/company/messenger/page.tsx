"use client";

import { Suspense } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { MessengerPageContent } from "@/components/messenger-page-content";
import { Skeleton } from "@/components/ui/skeleton";
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
      <Suspense fallback={<Skeleton className="h-[min(78vh,820px)] w-full rounded-xl" />}>
        <MessengerPageContent audience="company" />
      </Suspense>
    </DashboardShell>
  );
}
