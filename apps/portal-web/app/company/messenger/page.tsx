"use client";

import { Suspense, useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { MessengerHeaderSearch, MessengerPageContent } from "@/components/messenger-page-content";
import { MessengerSectionTitle } from "@/components/messenger-section-title";
import { Skeleton } from "@/components/ui/skeleton";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

export default function CompanyMessengerPage() {
  const [search, setSearch] = useState("");

  return (
    <DashboardShell
      cabinetKind="company"
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/messenger"
      navigation={companyNavigation}
      breadcrumbs={<MessengerSectionTitle />}
      headerCenter={<MessengerHeaderSearch value={search} onChange={setSearch} />}
      fluidContent
    >
      <Suspense fallback={<Skeleton className="min-h-0 w-full flex-1 rounded-xl" />}>
        <MessengerPageContent audience="company" search={search} />
      </Suspense>
    </DashboardShell>
  );
}
