"use client";

import { QRCodeSVG } from "qrcode.react";

import { IosHomeIndicator, IosStatusBar } from "./ios-status-bar";
import { PhoneScreenShell, SF_DISPLAY, ScreenLoading } from "./screen-shell";
import {
  formatSubscribers,
  proxiedMediaUrl,
  type SocialProfileSnapshot
} from "@/lib/social-profile";
import type { PartnerSiteSocialId } from "@/lib/partner-site-socials";

/**
 * Единая карточка профиля для всех площадок.
 *
 * Данные берутся из снимка, если площадка их отдала, иначе — айдентика самого
 * партнёра: логотип и название. Выдуманных счётчиков нет ни при каком раскладе.
 * QR ведёт на страницу профиля, куда посетитель попадает со своего телефона.
 */

type PlatformStyle = {
  /** Подпись площадки в шапке экрана */
  appName: string;
  /** Что это за сущность у площадки: канал, сообщество, профиль */
  entity: string;
  accent: string;
  accentText: string;
  background: string;
  dark: boolean;
  /** Форма кнопки: у каждой площадки своя */
  buttonRadius: string;
};

const PLATFORM_STYLES: Record<PartnerSiteSocialId, PlatformStyle> = {
  telegram: {
    appName: "Telegram",
    entity: "канал",
    accent: "#2AABEE",
    accentText: "#ffffff",
    background: "#ffffff",
    dark: false,
    buttonRadius: "14px"
  },
  instagram: {
    appName: "Instagram",
    entity: "профиль",
    accent: "#0095F6",
    accentText: "#ffffff",
    background: "#000000",
    dark: true,
    buttonRadius: "12px"
  },
  vk: {
    appName: "ВКонтакте",
    entity: "сообщество",
    accent: "#0077FF",
    accentText: "#ffffff",
    background: "#ffffff",
    dark: false,
    buttonRadius: "10px"
  },
  youtube: {
    appName: "YouTube",
    entity: "канал",
    accent: "#ffffff",
    accentText: "#0f0f0f",
    background: "#0f0f0f",
    dark: true,
    buttonRadius: "9999px"
  },
  dzen: {
    appName: "Дзен",
    entity: "канал",
    accent: "#000000",
    accentText: "#ffffff",
    background: "#ffffff",
    dark: false,
    buttonRadius: "9999px"
  },
  max: {
    appName: "MAX",
    entity: "канал",
    accent: "#2f6bff",
    accentText: "#ffffff",
    background: "#ffffff",
    dark: false,
    buttonRadius: "14px"
  }
};

export function SocialProfileCard({
  platform,
  snapshot,
  loading,
  brandName,
  brandLogo,
  profileUrl
}: {
  platform: PartnerSiteSocialId;
  snapshot: SocialProfileSnapshot | null;
  loading: boolean;
  brandName: string;
  brandLogo: string;
  profileUrl: string;
}) {
  const style = PLATFORM_STYLES[platform];
  const hasData = Boolean(snapshot && (snapshot.status === "live" || snapshot.status === "stale"));

  // Аватар площадки — только когда он действительно получен; иначе логотип партнёра
  const avatar = hasData ? proxiedMediaUrl(snapshot?.avatarUrl) : undefined;
  const logo = avatar ?? (brandLogo || undefined);
  const title = (hasData ? snapshot?.displayName : undefined) ?? brandName;
  const subscribers = hasData ? formatSubscribers(snapshot?.followersCount) : undefined;
  const biography = hasData ? snapshot?.biography : undefined;
  const handle = hasData ? snapshot?.username : undefined;

  const titleColor = style.dark ? "#ffffff" : "#000000";
  const mutedColor = style.dark ? "rgba(235,235,245,0.6)" : "rgba(60,60,67,0.6)";
  const bodyColor = style.dark ? "rgba(235,235,245,0.75)" : "rgba(60,60,67,0.85)";

  return (
    <PhoneScreenShell background={style.background}>
      <div className="flex h-full flex-col">
        <IosStatusBar dark={style.dark} />

        <div
          className="flex h-[44px] shrink-0 items-center justify-center border-b"
          style={{ borderColor: style.dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)" }}
        >
          <span
            className="text-[17px] leading-none font-semibold"
            style={{ fontFamily: SF_DISPLAY, color: titleColor }}
          >
            {style.appName}
          </span>
        </div>

        {loading ? (
          <ScreenLoading dark={style.dark} />
        ) : (
          <div className="flex flex-1 flex-col items-center px-7 pt-7 text-center">
            <span
              className="flex size-[92px] shrink-0 items-center justify-center overflow-hidden rounded-full"
              style={{ background: style.dark ? "#1c1c1e" : "#eef1f4" }}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="size-full object-cover" draggable={false} />
              ) : (
                <span
                  className="text-[36px] font-semibold"
                  style={{ fontFamily: SF_DISPLAY, color: style.accent }}
                >
                  {brandName.trim().slice(0, 1).toUpperCase() || "?"}
                </span>
              )}
            </span>

            <h1
              className="mt-[14px] line-clamp-2 text-[22px] leading-[26px] font-semibold"
              style={{ fontFamily: SF_DISPLAY, color: titleColor }}
            >
              {title}
            </h1>

            <p className="mt-[2px] text-[14px] leading-tight" style={{ color: mutedColor }}>
              {subscribers ?? style.entity}
            </p>

            {biography ? (
              <p
                className="mt-3 line-clamp-2 text-[14px] leading-[19px]"
                style={{ color: bodyColor }}
              >
                {biography}
              </p>
            ) : null}

            {/* QR — способ перейти с чужого экрана: посетитель наводит свой телефон */}
            <span className="mt-5 rounded-[18px] bg-white p-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
              <QRCodeSVG value={profileUrl} size={124} level="M" marginSize={0} />
            </span>

            <p className="mt-[10px] text-[13px] leading-tight" style={{ color: mutedColor }}>
              Наведите камеру телефона
            </p>

            <span
              className="mt-4 flex h-[46px] w-full items-center justify-center px-6"
              style={{ background: style.accent, borderRadius: style.buttonRadius }}
            >
              <span
                className="text-[16px] leading-none font-semibold"
                style={{ fontFamily: SF_DISPLAY, color: style.accentText }}
              >
                Подписаться
              </span>
            </span>

            {handle ? (
              <p className="mt-[10px] text-[13px] leading-tight" style={{ color: mutedColor }}>
                @{handle}
              </p>
            ) : null}
          </div>
        )}

        <IosHomeIndicator dark={style.dark} />
      </div>
    </PhoneScreenShell>
  );
}
