"use client";

import { SF_TEXT } from "./screen-shell";

/**
 * Системная строка iOS — общая для всех экранов мокапа.
 *
 * Никакого состояния зрителя: время нейтральное, Dynamic Island пустой,
 * значков Focus и уведомлений нет. Всё, что было бы «подсмотрено» со
 * скриншота реального телефона, здесь отсутствует намеренно.
 */
export function IosStatusBar({ dark = false }: { dark?: boolean }) {
  const tone = dark ? "#ffffff" : "#000000";

  return (
    <div
      className="relative z-20 flex h-[54px] shrink-0 items-end justify-between px-[30px] pb-[8px] select-none"
      style={{ color: tone, fontFamily: SF_TEXT }}
    >
      <span className="w-[62px] text-[17px] leading-none font-semibold tracking-[-0.2px]">
        9:41
      </span>

      {/* Dynamic Island: физический вырез, внутри него ничего не показываем */}
      <span
        aria-hidden
        className="absolute top-[11px] left-1/2 h-[37px] w-[125px] -translate-x-1/2 rounded-full bg-black"
      />

      <span className="flex items-center gap-[7px]">
        {/* Уровень сигнала */}
        <svg width="19" height="13" viewBox="0 0 19 13" fill="none" aria-hidden>
          <rect x="0" y="9" width="3.4" height="4" rx="1.1" fill={tone} />
          <rect x="5.2" y="6.4" width="3.4" height="6.6" rx="1.1" fill={tone} />
          <rect x="10.4" y="3.4" width="3.4" height="9.6" rx="1.1" fill={tone} />
          <rect x="15.6" y="0" width="3.4" height="13" rx="1.1" fill={tone} />
        </svg>

        {/* Wi-Fi */}
        <svg width="17" height="13" viewBox="0 0 17 13" fill="none" aria-hidden>
          <path
            d="M8.5 12.6 6.3 10.2a3.1 3.1 0 0 1 4.4 0L8.5 12.6Zm-4-4.4a6.4 6.4 0 0 1 8 0l1.6-1.7a8.7 8.7 0 0 0-11.2 0l1.6 1.7Zm-3-3.2a10.9 10.9 0 0 1 14 0l1.6-1.7a13.2 13.2 0 0 0-17.2 0l1.6 1.7Z"
            fill={tone}
          />
        </svg>

        {/* Батарея: цельная, без процентов и состояния зарядки */}
        <svg width="28" height="13" viewBox="0 0 28 13" fill="none" aria-hidden>
          <rect
            x="0.6"
            y="0.6"
            width="24"
            height="11.8"
            rx="3.6"
            stroke={tone}
            strokeOpacity="0.38"
            strokeWidth="1.1"
          />
          <rect x="2.2" y="2.2" width="18.6" height="8.6" rx="2.3" fill={tone} />
          <path d="M26.4 4.5v4a2.15 2.15 0 0 0 0-4Z" fill={tone} fillOpacity="0.42" />
        </svg>
      </span>
    </div>
  );
}

/** Индикатор жеста «домой» — нижняя чёрточка */
export function IosHomeIndicator({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex h-[24px] shrink-0 items-center justify-center">
      <span
        className="h-[5px] w-[139px] rounded-full"
        style={{ background: dark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.8)" }}
      />
    </div>
  );
}
