"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { CompanyCatalogProject } from "@/components/company-catalog-project";
import { GeneralHouseDetail } from "@/components/general-house-detail";
import { PartnerCatalogProject } from "@/components/partner-catalog-project";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

type Role = "company_admin" | "company_manager" | "partner_owner" | "partner_member" | "dealer_guest";

function CatalogProject() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await apiFetch<{ user: { role: Role } }>("/api/auth/session");
        if (!cancelled) setRole(session.user.role);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Нет сессии");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!role || !slug) return;
    let cancelled = false;
    const endpoint =
      role === "company_admin" || role === "company_manager"
        ? `/api/company/catalog/projects/${slug}`
        : role === "dealer_guest"
          ? `/api/partner/general/houses/${slug}`
          : `/api/partner/catalog/projects/${slug}`;
    void apiFetch<{ slug: string }>(endpoint)
      .then((project) => {
        if (!cancelled && project.slug && project.slug !== slug) {
          router.replace(`/portal/catalog/${project.slug}`);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [role, slug, router]);

  if (error) return null;
  if (!role) return <Skeleton className="h-96 w-full" />;
  if (role === "company_admin" || role === "company_manager") {
    return <CompanyCatalogProject projectKey={slug} />;
  }
  if (role === "dealer_guest") return <GeneralHouseDetail projectKey={slug} />;
  return <PartnerCatalogProject projectKey={slug} />;
}

export default function CatalogProjectPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CatalogProject />
    </Suspense>
  );
}
