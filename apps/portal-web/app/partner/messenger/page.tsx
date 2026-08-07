"use client";

import { Suspense, useState } from "react";

import { MessengerHeaderSearch, MessengerPageContent } from "@/components/messenger-page-content";
import { MessengerSectionTitle } from "@/components/messenger-section-title";
import { PartnerShell } from "@/components/partner-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function PartnerMessengerPage() {
  const [search, setSearch] = useState("");

  return (
    <PartnerShell
      currentPath="/partner/messenger"
      breadcrumbs={<MessengerSectionTitle />}
      headerCenter={<MessengerHeaderSearch value={search} onChange={setSearch} />}
      fluidContent
    >
      <Suspense fallback={<Skeleton className="min-h-0 w-full flex-1 rounded-xl" />}>
        <MessengerPageContent audience="partner" search={search} />
      </Suspense>
    </PartnerShell>
  );
}
