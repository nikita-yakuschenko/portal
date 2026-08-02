"use client";

import { useEffect } from "react";

import type { PartnerSiteDraft } from "@/lib/partner-site-draft";

const FAVICON_ATTR = "data-partner-site-favicon";
const APPLE_ICON_ATTR = "data-partner-site-apple-icon";
const DESC_ATTR = "data-partner-site-description";
const OG_TITLE_ATTR = "data-partner-site-og-title";
const OG_DESC_ATTR = "data-partner-site-og-description";

function upsertLink(rel: string, marker: string, href: string, type?: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[${marker}]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute(marker, "1");
    document.head.appendChild(el);
  }
  el.rel = rel;
  el.href = href;
  if (type) el.type = type;
  else el.removeAttribute("type");
}

function removeMarked(marker: string) {
  document.head.querySelectorAll(`[${marker}]`).forEach((node) => node.remove());
}

function upsertMeta(
  marker: string,
  attrs: { name?: string; property?: string },
  content: string
) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${marker}]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(marker, "1");
    document.head.appendChild(el);
  }
  if (attrs.name) el.name = attrs.name;
  if (attrs.property) el.setAttribute("property", attrs.property);
  el.content = content;
}

function faviconType(dataUrl: string): string | undefined {
  if (dataUrl.startsWith("data:image/svg+xml")) return "image/svg+xml";
  if (dataUrl.startsWith("data:image/png")) return "image/png";
  if (dataUrl.startsWith("data:image/webp")) return "image/webp";
  if (dataUrl.startsWith("data:image/x-icon") || dataUrl.startsWith("data:image/vnd.microsoft.icon")) {
    return "image/x-icon";
  }
  return undefined;
}

/** Title / description / favicon вкладки для превью и публичной витрины */
export function SiteDocumentHead({ draft }: { draft: PartnerSiteDraft }) {
  useEffect(() => {
    const previousTitle = document.title;
    const title = draft.seoTitle.trim() || draft.name.trim() || "Сайт";
    document.title = title;

    const description = draft.seoDescription.trim();
    if (description) {
      upsertMeta(DESC_ATTR, { name: "description" }, description);
      upsertMeta(OG_DESC_ATTR, { property: "og:description" }, description);
    } else {
      removeMarked(DESC_ATTR);
      removeMarked(OG_DESC_ATTR);
    }

    upsertMeta(OG_TITLE_ATTR, { property: "og:title" }, title);

    const favicon = draft.faviconDataUrl.trim();
    if (favicon) {
      upsertLink("icon", FAVICON_ATTR, favicon, faviconType(favicon));
      if (favicon.startsWith("data:image/png") || favicon.startsWith("data:image/svg+xml")) {
        upsertLink("apple-touch-icon", APPLE_ICON_ATTR, favicon);
      } else {
        removeMarked(APPLE_ICON_ATTR);
      }
    } else {
      removeMarked(FAVICON_ATTR);
      removeMarked(APPLE_ICON_ATTR);
    }

    return () => {
      document.title = previousTitle;
      removeMarked(DESC_ATTR);
      removeMarked(OG_TITLE_ATTR);
      removeMarked(OG_DESC_ATTR);
      removeMarked(FAVICON_ATTR);
      removeMarked(APPLE_ICON_ATTR);
    };
  }, [draft.seoTitle, draft.seoDescription, draft.name, draft.faviconDataUrl]);

  return null;
}
