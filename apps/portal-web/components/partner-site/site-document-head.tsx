"use client";

import { useEffect } from "react";

import type { PartnerSiteDraft } from "@/lib/partner-site-draft";

const FAVICON_ATTR = "data-partner-site-favicon";
const APPLE_ICON_ATTR = "data-partner-site-apple-icon";
const DESC_ATTR = "data-partner-site-description";

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
    let meta = document.head.querySelector<HTMLMetaElement>(`meta[${DESC_ATTR}]`);
    if (description) {
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(DESC_ATTR, "1");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = description;
    } else if (meta) {
      meta.remove();
    }

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
      removeMarked(FAVICON_ATTR);
      removeMarked(APPLE_ICON_ATTR);
    };
  }, [draft.seoTitle, draft.seoDescription, draft.name, draft.faviconDataUrl]);

  return null;
}
