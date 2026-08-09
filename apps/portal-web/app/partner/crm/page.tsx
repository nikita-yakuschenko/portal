"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

/** CRM переехала в Настройки */
export default function PartnerCrmRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/partner/settings?tab=integrations");
  }, [router]);

  return (
    <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center gap-2 text-sm">
      <Spinner />
      Переходим в настройки…
    </div>
  );
}
