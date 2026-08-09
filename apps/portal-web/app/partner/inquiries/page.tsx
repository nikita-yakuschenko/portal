"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { PartnerShell } from "@/components/partner-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Запросы на завод живут в мессенджере — отдельный раздел больше не нужен */
export default function PartnerInquiriesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/partner/messenger");
  }, [router]);

  return (
    <PartnerShell currentPath="/partner/messenger" title="Мессенджер">
      <Skeleton className="h-64 w-full" />
    </PartnerShell>
  );
}
