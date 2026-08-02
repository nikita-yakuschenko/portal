"use client";

import { PartnerSitePreviewChrome } from "@/components/partner-site/preview-chrome";
import { PartnerSitePreviewProvider } from "@/components/partner-site/preview-context";

export function PartnerSitePreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <PartnerSitePreviewProvider>
      <PartnerSitePreviewChrome>{children}</PartnerSitePreviewChrome>
    </PartnerSitePreviewProvider>
  );
}
