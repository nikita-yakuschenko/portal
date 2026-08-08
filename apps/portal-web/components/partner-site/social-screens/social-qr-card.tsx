"use client";

import type { PartnerSiteSocialId } from "@/lib/partner-site-socials";

import { IosHomeIndicator, IosStatusBar } from "./ios-status-bar";
import { PhoneScreenShell, SF_DISPLAY } from "./screen-shell";
import { QR_LOGOS } from "./qr-logos";
import { StyledQr } from "./styled-qr";

/**
 * Экран телефона: фирменный фон площадки и QR на профиль партнёра — так же,
 * как это делают сами приложения в разделе «QR-код профиля».
 *
 * Это изображение, а не работающий интерфейс: кнопок «закрыть» и «поделиться»
 * здесь нет. Данные площадки не запрашиваются — код строится из ссылки
 * партнёра, поэтому экран одинаково работает для всех сетей.
 */

type PlatformBrand = {
  name: string;
  background: string;
  /** Цвет модулей кода и подписи на белой карточке */
  ink: string;
};

const PLATFORM_BRANDS: Record<PartnerSiteSocialId, PlatformBrand> = {
  telegram: {
    name: "Telegram",
    background: "linear-gradient(168deg, #46C3FF 0%, #2AABEE 42%, #0088CC 100%)",
    ink: "#0088CC"
  },
  instagram: {
    name: "Instagram",
    background:
      "linear-gradient(160deg, #6A4AE8 0%, #A02FB3 24%, #C13584 44%, #E1306C 64%, #F56040 82%, #FCAF45 100%)",
    ink: "#C13584"
  },
  vk: {
    name: "ВКонтакте",
    background: "linear-gradient(168deg, #3E96FF 0%, #0077FF 48%, #0052CC 100%)",
    ink: "#0077FF"
  },
  youtube: {
    name: "YouTube",
    background: "linear-gradient(168deg, #FF5E56 0%, #FF0000 45%, #B00000 100%)",
    ink: "#E52117"
  },
  dzen: {
    name: "Дзен",
    background: "linear-gradient(168deg, #4A4A4A 0%, #1C1C1C 52%, #000000 100%)",
    ink: "#1C1C1C"
  },
  max: {
    name: "MAX",
    background: "linear-gradient(160deg, #9A6BFF 0%, #6C4BFF 45%, #2F6BFF 100%)",
    ink: "#5B3EF0"
  }
};

const QR_SIZE = 286;

/** Имя аккаунта под кодом: площадки печатают его капсом, без служебных частей */
function toHandle(brandName: string, profileUrl: string): string {
  try {
    const segment = new URL(profileUrl).pathname.split("/").filter(Boolean).pop();
    if (segment) return segment.replace(/^@/, "").toUpperCase();
  } catch {
    // ссылка партнёра может быть кривой — тогда подписываем брендом
  }
  return brandName.trim().toUpperCase();
}

function CameraIcon() {
  return (
    <svg width="24" height="21" viewBox="0 0 24 21" fill="none" aria-hidden>
      <rect x="1" y="4" width="22" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 4l1.5-2.8h5L16 4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function SocialQrCard({
  platform,
  profileUrl,
  brandName,
  brandLogo
}: {
  platform: PartnerSiteSocialId;
  profileUrl: string;
  brandName: string;
  /** Логотип партнёра — в круге над карточкой */
  brandLogo?: string | undefined;
}) {
  const brand = PLATFORM_BRANDS[platform];
  const handle = toHandle(brandName, profileUrl);
  const platformLogo = QR_LOGOS[platform];

  return (
    <PhoneScreenShell background={brand.background}>
      <div className="flex h-full flex-col text-white">
        <IosStatusBar dark />

        <div className="flex h-[54px] shrink-0 items-center justify-center">
          <span className="rounded-full border-[1.6px] border-white/90 px-[18px] py-[6px]">
            <span
              className="text-[14px] leading-none font-semibold tracking-[0.8px] uppercase"
              style={{ fontFamily: SF_DISPLAY }}
            >
              {brand.name}
            </span>
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-7">
          {/*
            Отступа сверху нет намеренно: круг выступает над карточкой на 52px,
            и центрирование по нему уводит композицию визуально вниз. Карточка
            центрируется сама, круг поднимает блок на половину выступа.
          */}
          <div className="relative w-full rounded-[38px] bg-white px-6 pt-9 pb-7 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
            <span
              className="absolute -top-[52px] left-1/2 flex size-[104px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-[6px] border-white"
              style={{ background: brand.ink }}
            >
              {brandLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogo} alt="" className="size-full object-cover" draggable={false} />
              ) : (
                <span
                  className="text-[40px] leading-none font-semibold text-white"
                  style={{ fontFamily: SF_DISPLAY }}
                >
                  {brandName.trim().slice(0, 1).toUpperCase() || "?"}
                </span>
              )}
            </span>

            <div className="mx-auto" style={{ width: QR_SIZE, height: QR_SIZE }}>
              <StyledQr
                value={profileUrl}
                size={QR_SIZE}
                color={brand.ink}
                logo={platformLogo}
              />
            </div>

            <p
              className="mt-6 line-clamp-1 text-center text-[32px] leading-none font-bold tracking-[0.5px] break-all uppercase"
              style={{ fontFamily: "var(--font-qr-handle), sans-serif", color: brand.ink }}
            >
              {handle}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-[11px] pb-4">
          <CameraIcon />
          <span className="text-[20px] leading-none font-medium" style={{ fontFamily: SF_DISPLAY }}>
            Отсканируйте QR-код
          </span>
        </div>

        <IosHomeIndicator dark />
      </div>
    </PhoneScreenShell>
  );
}
