"use client";

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
      className="relative z-20 flex h-[54px] shrink-0 items-end justify-between px-[27px] pb-[6px] select-none"
      style={{ color: tone }}
    >
      <span className="w-[54px] text-[17px] leading-none font-semibold tracking-[-0.2px]">
        9:41
      </span>

      {/* Dynamic Island: физический вырез, внутри него ничего не показываем */}
      <span
        aria-hidden
        className="absolute top-[11px] left-1/2 h-[37px] w-[125px] -translate-x-1/2 rounded-full bg-black"
      />

      <span className="flex w-[78px] items-center justify-end gap-[5px]">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden>
          <rect x="0" y="8" width="3" height="4" rx="1" fill={tone} />
          <rect x="5" y="6" width="3" height="6" rx="1" fill={tone} />
          <rect x="10" y="3" width="3" height="9" rx="1" fill={tone} />
          <rect x="15" y="0" width="3" height="12" rx="1" fill={tone} />
        </svg>

        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
          <path
            d="M8 10.5 6.2 8.7a2.6 2.6 0 0 1 3.6 0L8 10.5Zm0-4.2a5.2 5.2 0 0 0-3.7 1.5L2.9 6.4a7.2 7.2 0 0 1 10.2 0l-1.4 1.4A5.2 5.2 0 0 0 8 6.3Zm0-3.8a9 9 0 0 0-6.4 2.6L.2 3.7a11 11 0 0 1 15.6 0l-1.4 1.4A9 9 0 0 0 8 2.5Z"
            fill={tone}
          />
        </svg>

        {/* Цельная батарея iOS, без процентов и без состояния зарядки */}
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none" aria-hidden>
          <rect
            x="0.5"
            y="0.5"
            width="23"
            height="12"
            rx="3.8"
            stroke={tone}
            strokeOpacity="0.35"
          />
          <rect x="2" y="2" width="18" height="9" rx="2.5" fill={tone} />
          <path
            d="M25 4.5v4a2.1 2.1 0 0 0 0-4Z"
            fill={tone}
            fillOpacity="0.4"
          />
        </svg>
      </span>
    </div>
  );
}

/** Индикатор жеста «домой» — нижняя чёрточка */
export function IosHomeIndicator({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex h-[21px] shrink-0 items-center justify-center">
      <span
        className="h-[5px] w-[139px] rounded-full"
        style={{ background: dark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.75)" }}
      />
    </div>
  );
}
