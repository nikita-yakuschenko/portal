"use client";

import type { PartnerSiteSocialId } from "@/lib/partner-site-socials";

import { SocialQrCard } from "./social-qr-card";

/**
 * Экран площадки в мокапе телефона: фирменный фон и QR на профиль партнёра.
 * Данные площадок не запрашиваются — экрану достаточно ссылки из конфига сайта.
 */
export function SocialAppScreen({
  platform,
  brandName,
  brandLogo,
  profileUrl
}: {
  platform: PartnerSiteSocialId;
  brandName: string;
  /** Логотип партнёра — в круге над карточкой кода */
  brandLogo?: string | undefined;
  profileUrl: string;
}) {
  return (
    <SocialQrCard
      platform={platform}
      brandName={brandName}
      brandLogo={brandLogo}
      profileUrl={profileUrl}
    />
  );
}
