"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { apiFetch } from "@/lib/api";
import {
  draftDefaultsFromPartner,
  loadPartnerSiteDraft,
  publicSiteHost,
  type PartnerSiteDraft
} from "@/lib/partner-site-draft";
import {
  loadSiteFavorites,
  saveSiteFavorites
} from "@/lib/partner-site-favorites";
import {
  filterStorefrontProjects,
  isPublicSiteRuntime,
  socialLinks,
  type StorefrontProject
} from "@/lib/partner-site-preview";
import { LEAD_FORMS, type LeadFormKind } from "@/lib/partner-site-lead-forms";
import { captureUtmTags, readUtmTags } from "@/lib/utm";

type MeResponse = {
  partner: {
    companyName: string;
    legalName?: string | null;
    inn?: string | null;
    region: string;
    email: string;
    phone: string;
  } | null;
};

export type PartnerLegalInfo = {
  companyName: string;
  legalName: string;
  inn: string;
};

type OpenLeadFormOptions = {
  kind: LeadFormKind;
  projectName?: string;
  selectionSummary?: string;
  technology?: string;
  projectImageUrl?: string;
  projectId?: string;
};

type PreviewState = {
  draft: PartnerSiteDraft | null;
  partnerLegal: PartnerLegalInfo | null;
  partnerId: string | null;
  projects: StorefrontProject[];
  host: string;
  socials: Array<{ label: string; href: string }>;
  favorites: Set<string>;
  toggleFavorite: (projectId: string) => void;
  consultOpen: boolean;
  leadFormKind: LeadFormKind;
  consultProjectName: string | undefined;
  consultSelectionSummary: string | undefined;
  consultTechnology: string | undefined;
  consultProjectImageUrl: string | undefined;
  consultProjectId: string | undefined;
  openLeadForm: (options: OpenLeadFormOptions) => void;
  setConsultOpen: (open: boolean) => void;
  submitLead: (input: {
    customerName: string;
    customerPhone: string;
    message?: string;
    projectId?: string;
    formKind?: LeadFormKind;
  }) => Promise<void>;
  loading: boolean;
  error: string;
};

const PreviewContext = createContext<PreviewState | null>(null);

function toPartnerLegal(
  partner:
    | MeResponse["partner"]
    | { companyName: string; legalName?: string | null; inn?: string | null }
    | null
    | undefined
): PartnerLegalInfo | null {
  if (!partner) return null;
  return {
    companyName: partner.companyName.trim(),
    legalName: (partner.legalName ?? "").trim(),
    inn: (partner.inn ?? "").trim()
  };
}

export function PartnerSitePreviewProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<PartnerSiteDraft | null>(null);
  const [partnerLegal, setPartnerLegal] = useState<PartnerLegalInfo | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [projects, setProjects] = useState<StorefrontProject[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [consultOpen, setConsultOpen] = useState(false);
  const [leadFormKind, setLeadFormKind] = useState<LeadFormKind>("consultation");
  const [consultProjectName, setConsultProjectName] = useState<string | undefined>();
  const [consultSelectionSummary, setConsultSelectionSummary] = useState<string | undefined>();
  const [consultTechnology, setConsultTechnology] = useState<string | undefined>();
  const [consultProjectImageUrl, setConsultProjectImageUrl] = useState<string | undefined>();
  const [consultProjectId, setConsultProjectId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const host = draft ? publicSiteHost(draft) : "";

  useLayoutEffect(() => {
    // Метки первого захода: до заявки посетитель успеет уйти с рекламного адреса
    captureUtmTags();
    if (isPublicSiteRuntime) return;
    const stored = loadPartnerSiteDraft();
    if (stored) setDraft(stored);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        if (isPublicSiteRuntime) {
          const currentHost =
            typeof window !== "undefined" ? window.location.host : "";
          const site = await apiFetch<{
            partnerId: string;
            config: PartnerSiteDraft;
            partner?: {
              companyName: string;
              legalName?: string | null;
              inn?: string | null;
            };
          }>(`/api/public/sites/resolve?host=${encodeURIComponent(currentHost)}`);

          setPartnerId(site.partnerId);
          setDraft(site.config);
          setPartnerLegal(toPartnerLegal(site.partner ?? { companyName: site.config.name }));

          const storefront = await apiFetch<StorefrontProject[]>(
            `/api/public/sites/${site.partnerId}/projects`
          );
          setProjects(filterStorefrontProjects(storefront));
          return;
        }

        const [me, site, storefront] = await Promise.all([
          apiFetch<MeResponse>("/api/partner/me"),
          apiFetch<{ partnerId: string; config: PartnerSiteDraft }>("/api/partner/site"),
          apiFetch<StorefrontProject[]>("/api/partner/storefront/projects")
        ]);

        setPartnerId(site.partnerId);
        setPartnerLegal(toPartnerLegal(me.partner));

        const fromApi = site.config?.name?.trim() ? site.config : null;
        const stored = loadPartnerSiteDraft();
        if (fromApi) setDraft(fromApi);
        else if (stored) setDraft(stored);
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

  useEffect(() => {
    if (!host) {
      setFavorites(new Set());
      return;
    }
    setFavorites(loadSiteFavorites(host));
  }, [host]);

  const toggleFavorite = useCallback(
    (projectId: string) => {
      if (!host) return;
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(projectId)) next.delete(projectId);
        else next.add(projectId);
        saveSiteFavorites(host, next);
        return next;
      });
    },
    [host]
  );

  const openLeadForm = useCallback((options: OpenLeadFormOptions) => {
    setLeadFormKind(options.kind);
    setConsultProjectName(options.projectName);
    setConsultSelectionSummary(options.selectionSummary);
    setConsultTechnology(options.technology);
    setConsultProjectImageUrl(options.projectImageUrl);
    setConsultProjectId(options.projectId);
    setConsultOpen(true);
  }, []);

  const handleConsultOpenChange = useCallback((open: boolean) => {
    setConsultOpen(open);
  }, []);

  const submitLead = useCallback(
    async (input: {
      customerName: string;
      customerPhone: string;
      message?: string;
      projectId?: string;
      /** Какая форма сработала; по умолчанию — открытая сейчас */
      formKind?: LeadFormKind;
    }) => {
      const kind = input.formKind ?? leadFormKind;
      const body: Record<string, unknown> = {
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        formName: LEAD_FORMS[kind].title,
        utm: readUtmTags()
      };
      const projectId = input.projectId ?? consultProjectId;
      if (projectId) body.projectId = projectId;
      if (input.message) body.message = input.message;
      if (typeof window !== "undefined") {
        body.pageUrl = window.location.href.slice(0, 2000);
      }

      if (isPublicSiteRuntime) {
        if (!partnerId) throw new Error("Сайт не загружен");
        await apiFetch(`/api/public/sites/${partnerId}/requests`, {
          method: "POST",
          body: JSON.stringify(body)
        });
        return;
      }

      await apiFetch("/api/partner/requests", {
        method: "POST",
        body: JSON.stringify(body)
      });
    },
    [partnerId, consultProjectId, leadFormKind]
  );

  const value = useMemo<PreviewState>(
    () => ({
      draft,
      partnerLegal,
      partnerId,
      projects,
      host,
      socials: draft ? socialLinks(draft) : [],
      favorites,
      toggleFavorite,
      consultOpen,
      leadFormKind,
      consultProjectName,
      consultSelectionSummary,
      consultTechnology,
      consultProjectImageUrl,
      consultProjectId,
      openLeadForm,
      setConsultOpen: handleConsultOpenChange,
      submitLead,
      loading,
      error
    }),
    [
      draft,
      partnerLegal,
      partnerId,
      projects,
      host,
      favorites,
      toggleFavorite,
      consultOpen,
      leadFormKind,
      consultProjectName,
      consultSelectionSummary,
      consultTechnology,
      consultProjectImageUrl,
      consultProjectId,
      openLeadForm,
      handleConsultOpenChange,
      submitLead,
      loading,
      error
    ]
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
