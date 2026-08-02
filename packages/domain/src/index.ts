export type SourceSystem = "tilda";

export type PartnerStatus = "pending" | "active" | "suspended";
export type PartnerApplicationStatus = "new" | "under_review" | "approved" | "rejected";
export type Role = "company_admin" | "company_manager" | "partner_owner" | "partner_member";
export type SiteStatus = "draft" | "provisioning" | "published" | "archived";
export type LeadEventType =
  | "project_view"
  | "price_request"
  | "contact_request"
  | "crm_delivery_succeeded"
  | "crm_delivery_failed";
export type LeadDeliveryStatus = "pending" | "sent" | "failed";
export type CrmProvider = "amocrm" | "bitrix24";
export type CatalogTechnology = "modular" | "panel_frame";

export type CatalogDocKind = "passport" | "spec" | "plan" | "manual" | "other";

export interface CatalogProjectDetails {
  summary?: string;
  mark?: string;
  dimensions?: {
    lengthM?: number;
    widthM?: number;
    label?: string;
  };
  characteristics: Array<{ title: string; value: string }>;
  packages: Array<{
    id: string;
    name: string;
    price?: number;
    description?: string;
  }>;
  optionGroups: Array<{
    id: string;
    title: string;
    items: Array<{ id: string; name: string; note?: string }>;
  }>;
  techDocs: Array<{
    id: string;
    title: string;
    kind: CatalogDocKind;
    status: "available" | "on_request";
    url?: string;
    note?: string;
  }>;
  cargo: {
    modulesNote?: string;
    dimensionsNote?: string;
    weightNote?: string;
    packingNote?: string;
  };
  transport: {
    method?: string;
    leadTimeNote?: string;
    deliveryNote?: string;
    unloadingNote?: string;
    mountingNote?: string;
  };
}

export interface CatalogAsset {
  id: string;
  projectId: string;
  sourceUrl: string;
  localPath: string;
  type: "exterior" | "floor_plan" | "interior" | "unknown";
  /** Номер этажа для планировки (если у дома больше одного этажа) */
  floorNumber?: number | null;
  sortOrder: number;
  isPrimary: boolean;
  isHidden?: boolean;
}

export interface CatalogProject {
  id: string;
  source: SourceSystem;
  sourceUid: string;
  name: string;
  slug: string;
  description: string;
  technology: CatalogTechnology;
  details: CatalogProjectDetails;
  area?: number;
  floors?: number;
  bedrooms?: number;
  bathrooms?: string;
  basePrice?: number;
  currency: string;
  projectUrl: string;
  active: boolean;
  sourcePayload: Record<string, unknown>;
  lastSyncedAt: string;
  assets: CatalogAsset[];
}

export interface Partner {
  id: string;
  companyName: string;
  legalName?: string;
  inn?: string;
  status: PartnerStatus;
  region: string;
  managerName?: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface PartnerApplication {
  id: string;
  inn: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  region: string;
  interests?: string[];
  message?: string;
  status: PartnerApplicationStatus;
  reviewComment?: string;
  createdAt?: string;
  reviewedAt?: string;
}

export interface PartnerUser {
  id: string;
  partnerId?: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface PartnerSite {
  id: string;
  partnerId: string;
  name: string;
  status: SiteStatus;
  domain?: string;
  subdomain: string;
  theme: string;
  contactPhone: string;
  contactEmail: string;
  address?: string;
  analytics?: {
    yandexMetrikaCounter?: string;
    googleTagManagerId?: string;
  };
  seo?: {
    title?: string;
    description?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PartnerProjectExtra {
  id: string;
  name: string;
  price?: number;
  note?: string;
}

/** Раздел допов дилера; title="" — опции без раздела */
export interface PartnerProjectExtraGroup {
  id: string;
  title: string;
  items: PartnerProjectExtra[];
}

/** Библиотека разделов/опций партнёра (переиспользование между проектами) */
export type PartnerExtraOptionLibrary = PartnerProjectExtraGroup[];

export type PartnerPricingMode = "markup" | "exact" | "on_request";

export interface PartnerProjectPrice {
  id: string;
  partnerId: string;
  projectId: string;
  /** Наценка % от заводской basePrice, либо точная publicPrice, либо по запросу */
  pricingMode: PartnerPricingMode;
  markupPercent?: number;
  publicPrice?: number;
  priceOnRequest: boolean;
  isPublished: boolean;
  /** Допы дилера: разделы с опциями (JSONB, совместим со старым плоским массивом через normalize) */
  extras: PartnerProjectExtraGroup[];
  updatedAt: string;
}

export interface CrmConnection {
  id: string;
  partnerId: string;
  provider: CrmProvider;
  portalUrl: string;
  credentials: Record<string, string>;
  isEnabled: boolean;
  createdAt: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface AuthSession {
  user: PartnerUser;
  partner?: Partner | null;
}

export interface LeadEvent {
  id: string;
  partnerId: string;
  siteId: string;
  projectId?: string;
  type: LeadEventType;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  message?: string;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface LeadDelivery {
  id: string;
  leadEventId: string;
  crmConnectionId: string;
  status: LeadDeliveryStatus;
  externalLeadId?: string;
  errorMessage?: string;
  attemptedAt?: string;
}

export interface PartnerInquiry {
  id: string;
  partnerId: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface AnalyticsSnapshot {
  projectId: string;
  projectName: string;
  priceRequests: number;
  contactRequests: number;
  lastRequestedAt?: string;
}

export interface TildaSyncResult {
  created: number;
  updated: number;
  assetsDiscovered: number;
  errors: string[];
}

export interface CrmLeadPayload {
  leadEvent: LeadEvent;
  project?: CatalogProject;
  partner: Partner;
  site: PartnerSite;
}

export interface CrmSendResult {
  success: boolean;
  externalLeadId?: string;
  errorMessage?: string;
}
