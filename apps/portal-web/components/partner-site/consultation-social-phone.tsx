"use client";

import { HandPhoneMockup } from "@/components/partner-site/hand-phone-mockup";
import { SocialAppScreen } from "@/components/partner-site/social-screens";
import { usePartnerSitePreview } from "@/components/partner-site/preview-context";
import type { PartnerSiteSocialLink } from "@/lib/partner-site-socials";

/**
 * Правая колонка шага соцсети: фотомокап с живым интерфейсом площадки.
 * Форма НЕ растёт — телефон absolute и торчит за её края.
 */
export function ConsultationSocialPhone({
  social,
  brandName,
  brandLogo
}: {
  social: PartnerSiteSocialLink;
  brandName: string;
  brandLogo: string;
  projectImageUrl?: string | undefined;
  projectName?: string | undefined;
}) {
  const { partnerId } = usePartnerSitePreview();

  return (
    // h-full = высота колонки формы; overflow visible, чтобы телефон рисовался снаружи
    <aside className="relative h-full min-h-0 overflow-visible border-t border-white/10 bg-[#070809] md:border-t-0 md:border-l md:border-white/10">
      <div
        className="pointer-events-none absolute top-1/2 z-30 -translate-y-1/2"
        style={{ right: "-4.5rem", width: "30rem" }}
      >
        <HandPhoneMockup className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.75)]">
          <SocialAppScreen
            platform={social.id}
            partnerId={partnerId}
            brandName={brandName || social.label}
            brandLogo={brandLogo}
          />
        </HandPhoneMockup>
      </div>
    </aside>
  );
}
