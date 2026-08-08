"use client";

import { useSocialProfile } from "@/hooks/use-social-profile";
import type { PartnerSiteSocialId } from "@/lib/partner-site-socials";

import { SocialProfileCard } from "./social-profile-card";

/**
 * Экран площадки в мокапе: одна карточка профиля на все соцсети.
 *
 * Там, где у площадки есть провайдер, подставляются её данные — аватар,
 * название, подписчики, описание. Где провайдера нет, остаётся айдентика
 * партнёра. QR ведёт на профиль в обоих случаях.
 */
export function SocialAppScreen({
  platform,
  partnerId,
  brandName,
  brandLogo,
  profileUrl
}: {
  platform: PartnerSiteSocialId;
  partnerId: string | null;
  brandName: string;
  brandLogo: string;
  profileUrl: string;
}) {
  const { snapshot, loading } = useSocialProfile(platform, partnerId);

  return (
    <SocialProfileCard
      platform={platform}
      snapshot={snapshot}
      loading={loading}
      brandName={brandName}
      brandLogo={brandLogo}
      profileUrl={profileUrl}
    />
  );
}
