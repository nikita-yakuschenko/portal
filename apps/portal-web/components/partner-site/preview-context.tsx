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
  socialLinks,
  type StorefrontProject
} from "@/lib/partner-site-preview";
import type { LeadFormKind } from "@/lib/partner-site-lead-forms";

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
  /** Состав конфигуратора для текста заявки */
  selectionSummary?: string;
  /** Технология проекта — для оффера подборки после заявки */
  technology?: string;
  /** Превью проекта для шага «спасибо» */
  projectImageUrl?: string;
};

type PreviewState = {
  draft: PartnerSiteDraft | null;
  /** Юр. реквизиты партнёра для подвала */
  partnerLegal: PartnerLegalInfo | null;
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
  openLeadForm: (options: OpenLeadFormOptions) => void;
  setConsultOpen: (open: boolean) => void;
  loading: boolean;
  error: string;
};

const PreviewContext = createContext<PreviewState | null>(null);

function toPartnerLegal(partner: MeResponse["partner"]): PartnerLegalInfo | null {
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
  const [projects, setProjects] = useState<StorefrontProject[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [consultOpen, setConsultOpen] = useState(false);
  const [leadFormKind, setLeadFormKind] = useState<LeadFormKind>("consultation");
  const [consultProjectName, setConsultProjectName] = useState<string | undefined>();
  const [consultSelectionSummary, setConsultSelectionSummary] = useState<string | undefined>();
  const [consultTechnology, setConsultTechnology] = useState<string | undefined>();
  const [consultProjectImageUrl, setConsultProjectImageUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const host = draft ? publicSiteHost(draft) : "";

  // Синхронно до paint — шапка сайта без вспышки «загрузка»
  useLayoutEffect(() => {
    const stored = loadPartnerSiteDraft();
    if (stored) setDraft(stored);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const stored = loadPartnerSiteDraft();
        const [me, storefront] = await Promise.all([
          apiFetch<MeResponse>("/api/partner/me"),
          apiFetch<StorefrontProject[]>("/api/partner/storefront/projects")
        ]);

        setPartnerLegal(toPartnerLegal(me.partner));

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
    setConsultOpen(true);
  }, []);

  const handleConsultOpenChange = useCallback((open: boolean) => {
    setConsultOpen(open);
  }, []);

  const value = useMemo<PreviewState>(
    () => ({
      draft,
      partnerLegal,
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
      openLeadForm,
      setConsultOpen: handleConsultOpenChange,
      loading,
      error
    }),
    [
      draft,
      partnerLegal,
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
      openLeadForm,
      handleConsultOpenChange,
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
