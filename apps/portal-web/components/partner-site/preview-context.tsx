"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { apiFetch } from "@/lib/api";
import {
  draftDefaultsFromPartner,
  loadPartnerSiteDraft,
  publicSiteHost,
  type PartnerSiteDraft
} from "@/lib/partner-site-draft";
import {
  filterStorefrontProjects,
  socialLinks,
  type StorefrontProject
} from "@/lib/partner-site-preview";

type MeResponse = {
  partner: {
    companyName: string;
    region: string;
    email: string;
    phone: string;
  } | null;
};

type PreviewState = {
  draft: PartnerSiteDraft | null;
  projects: StorefrontProject[];
  host: string;
  socials: Array<{ label: string; href: string }>;
  loading: boolean;
  error: string;
};

const PreviewContext = createContext<PreviewState | null>(null);

export function PartnerSitePreviewProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<PartnerSiteDraft | null>(null);
  const [projects, setProjects] = useState<StorefrontProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const stored = loadPartnerSiteDraft();
        const [me, storefront] = await Promise.all([
          apiFetch<MeResponse>("/api/partner/me"),
          apiFetch<StorefrontProject[]>("/api/partner/storefront/projects")
        ]);

        if (stored) setDraft(stored);
        else if (me.partner) setDraft(draftDefaultsFromPartner(me.partner));
        else setError("Нет данных партнёра");

        setProjects(filterStorefrontProjects(storefront));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить предпросмотр");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<PreviewState>(
    () => ({
      draft,
      projects,
      host: draft ? publicSiteHost(draft) : "",
      socials: draft ? socialLinks(draft) : [],
      loading,
      error
    }),
    [draft, projects, loading, error]
  );

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function usePartnerSitePreview(): PreviewState {
  const ctx = useContext(PreviewContext);
  if (!ctx) {
    throw new Error("usePartnerSitePreview вне PartnerSitePreviewProvider");
  }
  return ctx;
}
