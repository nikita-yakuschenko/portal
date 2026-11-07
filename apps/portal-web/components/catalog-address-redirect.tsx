"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { catalogProjectHref } from "@/lib/catalog-path";

/** Старый адрес с uuid уводит на /catalog/{slug}. */
export function CatalogAddressRedirect({ projectKey }: { projectKey: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await apiFetch<{ user: { role: string } }>("/api/auth/session");
        const role = session.user.role;
        const endpoint =
          role === "company_admin" || role === "company_manager"
            ? `/api/company/catalog/projects/${projectKey}`
            : role === "dealer_guest"
              ? `/api/partner/general/houses/${projectKey}`
              : `/api/partner/catalog/projects/${projectKey}`;
        const project = await apiFetch<{ slug: string }>(endpoint);
        if (!cancelled && project.slug) router.replace(catalogProjectHref(project.slug));
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectKey, router]);

  return <Skeleton className="h-96 w-full" />;
}
