"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

export default function PartnerLeadsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/partner");
  }, [router]);

  return (
    <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center gap-2 text-sm">
      <Spinner />
      Переходим…
    </div>
  );
}
