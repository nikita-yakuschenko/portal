"use client";

import { IconChevronLeft } from "@tabler/icons-react";

import type { PartnerSiteSocialLink } from "@/lib/partner-site-socials";

/** Обрезанный PNG Cosmic Orange (прозрачный фон) */
const MOCKUP_SRC = "/mockups/iphone-17-pro-cosmic-orange.png?v=3";

/**
 * Правая колонка шага соцсети: Cosmic Orange.
 * Форма НЕ растёт — телефон absolute и торчит за её края.
 */
export function ConsultationSocialPhone({
  social,
  brandName,
  brandLogo,
  projectImageUrl,
  projectName
}: {
  social: PartnerSiteSocialLink;
  brandName: string;
  brandLogo: string;
  projectImageUrl?: string | undefined;
  projectName?: string | undefined;
}) {
  const isTelegram = social.id === "telegram";
  const channelName = brandName || social.label;
  const avatarLetter = (channelName || "Т").slice(0, 1).toUpperCase();

  return (
    // h-full = высота колонки формы; overflow visible, чтобы телефон рисовался снаружи
    <aside className="relative h-full min-h-0 overflow-visible border-t border-white/10 bg-[#070809] md:border-t-0 md:border-l md:border-white/10">
      {/*
        Absolute: не влияет на высоту формы.
        Высота телефона больше формы → торчит сверху/снизу;
        right отрицательный → торчит справа.
      */}
      <div
        className="pointer-events-none absolute top-1/2 z-30 -translate-y-1/2"
        style={{ right: "-6.5rem", width: "21rem" }}
      >
        <div className="relative aspect-[1275/2707] w-full drop-shadow-[0_28px_55px_rgba(0,0,0,0.8)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MOCKUP_SRC}
            alt="iPhone 17 Pro Cosmic Orange"
            width={1275}
            height={2707}
            className="absolute inset-0 z-[1] block h-full w-full select-none object-contain"
            draggable={false}
          />

          {/*
            Экран в PNG уже с ракурсом — доп. rotateY ломает посадку.
            Плоский UI кладем точно в чёрный дисплей.
          */}
          <div
            className="absolute z-[2] overflow-hidden bg-[#0e1621]"
            style={{
              left: "4.4%",
              top: "3.6%",
              width: "86.2%",
              height: "93.2%",
              borderRadius: "12.5% / 5.8%",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.45)"
            }}
          >
            <div className="flex h-full flex-col text-white">
              <div className="h-2.5 shrink-0 bg-[#17212b]" />
              <div className="flex shrink-0 items-center gap-1 border-b border-white/5 bg-[#17212b] px-1.5 pb-1">
                <IconChevronLeft className="size-3 shrink-0 text-[#6ab2f2]" stroke={2} />
                <span className="relative inline-flex size-5 shrink-0 overflow-hidden rounded-full bg-[#2AABEE]">
                  {brandLogo || projectImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brandLogo || projectImageUrl!}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[0.45rem] font-bold">
                      {avatarLetter}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.55rem] font-semibold leading-none">{channelName}</p>
                  <p className="mt-0.5 truncate text-[0.42rem] text-white/45">
                    {isTelegram ? "канал" : social.label}
                  </p>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden bg-[#0e1621] p-1.5">
                {projectImageUrl ? (
                  <div className="overflow-hidden rounded-md bg-[#182533]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={projectImageUrl}
                      alt={projectName || ""}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <div className="px-1.5 py-1">
                      <p className="truncate text-[0.55rem] font-semibold">
                        {projectName || "Новый проект"}
                      </p>
                      <p className="line-clamp-2 text-[0.42rem] leading-snug text-white/50">
                        Подборка и ход стройки в канале
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md bg-[#182533] px-1.5 py-1.5">
                    <p className="text-[0.55rem] leading-snug text-white/80">
                      Новые проекты и стройки — в канале
                    </p>
                  </div>
                )}
                <div className="rounded-md bg-[#2AABEE] px-1.5 py-1.5 text-center">
                  <p className="text-[0.55rem] font-semibold leading-none text-white">
                    Подписаться
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
