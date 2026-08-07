"use client";

import { IosHomeIndicator, IosStatusBar } from "./ios-status-bar";
import { PhoneScreenShell, SF_DISPLAY } from "./screen-shell";

/**
 * Оболочки площадок без провайдера данных: ВКонтакте, YouTube, MAX.
 *
 * Интерфейс воспроизводит соответствующее приложение, но заполняется только
 * данными самого партнёра — названием и логотипом. Счётчиков и ленты здесь
 * нет намеренно: их неоткуда взять, а рисовать правдоподобные числа нельзя.
 */

export type ShellProps = {
  brandName: string;
  brandLogo: string;
  /** Что именно площадка не отдаёт — показывается вместо ленты */
  noDataHint?: string;
};

function BrandAvatar({
  brandLogo,
  brandName,
  size,
  rounded = "9999px",
  background
}: {
  brandLogo: string;
  brandName: string;
  size: number;
  rounded?: string;
  background: string;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: size, borderRadius: rounded, background }}
    >
      {brandLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brandLogo} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <span
          className="text-white"
          style={{ fontFamily: SF_DISPLAY, fontSize: size * 0.4, fontWeight: 600 }}
        >
          {brandName.trim().slice(0, 1).toUpperCase() || "?"}
        </span>
      )}
    </span>
  );
}

function NoFeedNotice({ hint, dark }: { hint: string; dark: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-10 text-center">
      <p
        className="text-[15px] leading-tight font-semibold"
        style={{ fontFamily: SF_DISPLAY, color: dark ? "#ffffff" : "#111111" }}
      >
        Публикации не загружаются
      </p>
      <p
        className="text-[13px] leading-snug"
        style={{ color: dark ? "rgba(235,235,245,0.6)" : "rgba(60,60,67,0.6)" }}
      >
        {hint}
      </p>
    </div>
  );
}

export function VkScreen({ brandName, brandLogo, noDataHint }: ShellProps) {
  return (
    <PhoneScreenShell background="#ffffff">
      <div className="flex h-full flex-col">
        <IosStatusBar />

        <div className="h-[104px] w-full bg-gradient-to-br from-[#3f8ae0] to-[#2a5885]" />

        <div className="-mt-[38px] flex flex-col items-center px-4">
          <span className="rounded-full border-[3px] border-white">
            <BrandAvatar
              brandLogo={brandLogo}
              brandName={brandName}
              size={76}
              background="#3f8ae0"
            />
          </span>
          <p
            className="mt-2 line-clamp-2 text-center text-[19px] leading-tight font-semibold text-[#000000]"
            style={{ fontFamily: SF_DISPLAY }}
          >
            {brandName}
          </p>
          <p className="mt-[2px] text-[13px] text-[rgba(60,60,67,0.6)]">Сообщество</p>

          <span className="mt-3 flex h-[36px] w-full items-center justify-center rounded-[10px] bg-[#0077FF] text-[15px] font-semibold text-white">
            Подписаться
          </span>
        </div>

        <NoFeedNotice
          dark={false}
          hint={noDataHint ?? "ВКонтакте не отдаёт публичную ленту без ключа приложения."}
        />
        <IosHomeIndicator />
      </div>
    </PhoneScreenShell>
  );
}

export function YoutubeScreen({ brandName, brandLogo, noDataHint }: ShellProps) {
  return (
    <PhoneScreenShell background="#0f0f0f">
      <div className="flex h-full flex-col text-white">
        <IosStatusBar dark />

        <div className="mx-4 h-[72px] rounded-[10px] bg-gradient-to-r from-[#282828] to-[#3a3a3a]" />

        <div className="flex flex-col items-center px-4 pt-4">
          <BrandAvatar
            brandLogo={brandLogo}
            brandName={brandName}
            size={72}
            background="#ff0033"
          />
          <p
            className="mt-3 line-clamp-2 text-center text-[20px] leading-tight font-semibold"
            style={{ fontFamily: SF_DISPLAY }}
          >
            {brandName}
          </p>
          <p className="mt-1 text-[13px] text-[rgba(255,255,255,0.55)]">Канал на YouTube</p>

          <span className="mt-4 flex h-[36px] items-center justify-center rounded-full bg-white px-6 text-[14px] font-semibold text-black">
            Подписаться
          </span>
        </div>

        <div className="mt-5 flex h-[42px] items-center gap-5 border-b border-white/10 px-4 text-[14px]">
          <span className="border-b-2 border-white pb-[10px] font-semibold">Главная</span>
          <span className="pb-[10px] text-[rgba(255,255,255,0.55)]">Видео</span>
          <span className="pb-[10px] text-[rgba(255,255,255,0.55)]">Плейлисты</span>
        </div>

        <NoFeedNotice
          dark
          hint={noDataHint ?? "YouTube отдаёт список видео только через Data API с ключом."}
        />
        <IosHomeIndicator dark />
      </div>
    </PhoneScreenShell>
  );
}

export function MaxScreen({ brandName, brandLogo, noDataHint }: ShellProps) {
  return (
    <PhoneScreenShell background="#f2f3f5">
      <div className="flex h-full flex-col">
        <div className="bg-gradient-to-r from-[#7c4dff] to-[#2f6bff]">
          <IosStatusBar dark />
          <div className="flex h-[52px] items-center gap-3 px-4 pb-1">
            <BrandAvatar
              brandLogo={brandLogo}
              brandName={brandName}
              size={36}
              background="rgba(255,255,255,0.25)"
            />
            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-[16px] leading-tight font-semibold text-white"
                style={{ fontFamily: SF_DISPLAY }}
              >
                {brandName}
              </span>
              <span className="block text-[12px] leading-tight text-white/70">канал в MAX</span>
            </span>
          </div>
        </div>

        <NoFeedNotice
          dark={false}
          hint={noDataHint ?? "MAX не публикует открытый API для каналов."}
        />

        <div className="shrink-0 border-t border-black/10 bg-white/85 backdrop-blur-xl">
          <div className="px-4 py-[10px] text-center">
            <span
              className="text-[16px] leading-none font-semibold text-[#2f6bff]"
              style={{ fontFamily: SF_DISPLAY }}
            >
              Подписаться
            </span>
          </div>
          <IosHomeIndicator />
        </div>
      </div>
    </PhoneScreenShell>
  );
}
