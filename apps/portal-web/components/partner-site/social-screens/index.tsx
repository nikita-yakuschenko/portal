"use client";

import { useSocialProfile } from "@/hooks/use-social-profile";
import type { PartnerSiteSocialId } from "@/lib/partner-site-socials";

import { InstagramScreen } from "./instagram-screen";
import { DzenScreen, MaxScreen, VkScreen, YoutubeScreen } from "./platform-shells";
import { TelegramScreen } from "./telegram-screen";

/**
 * Роутер экранов: по площадке выбирает интерфейс приложения.
 * Данные приходят только для площадок с провайдером; остальные показывают
 * собственную оболочку с брендом партнёра и без придуманных цифр.
 */
export function SocialAppScreen({
  platform,
  partnerId,
  brandName,
  brandLogo
}: {
  platform: PartnerSiteSocialId;
  partnerId: string | null;
  brandName: string;
  brandLogo: string;
}) {
  const { snapshot, loading } = useSocialProfile(platform, partnerId);

  switch (platform) {
    case "telegram":
      return <TelegramScreen snapshot={snapshot} loading={loading} fallbackTitle={brandName} />;
    case "instagram":
      return <InstagramScreen snapshot={snapshot} loading={loading} fallbackTitle={brandName} />;
    case "vk":
      return <VkScreen brandName={brandName} brandLogo={brandLogo} />;
    case "youtube":
      return <YoutubeScreen brandName={brandName} brandLogo={brandLogo} />;
    case "dzen":
      return <DzenScreen brandName={brandName} brandLogo={brandLogo} />;
    case "max":
      return <MaxScreen brandName={brandName} brandLogo={brandLogo} />;
  }
}
