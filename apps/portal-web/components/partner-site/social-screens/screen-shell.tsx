"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Логический размер экрана iPhone 16 Pro в CSS-пикселях */
export const SCREEN_WIDTH = 393;
export const SCREEN_HEIGHT = 852;

/**
 * Системные шрифты iOS.
 *
 * SF Pro — проприетарный шрифт Apple: его лицензия допускает использование в
 * интерфейсах под платформы Apple, но раздавать файл шрифта с сайта нельзя.
 * Поэтому стек: на устройствах Apple подхватывается настоящий SF, на остальных
 * — Inter, который создавался как его аналог и уже подключён в проекте.
 */
export const SF_TEXT =
  '"SF Pro Text", -apple-system, BlinkMacSystemFont, var(--font-inter), "Segoe UI", Arial, sans-serif';
export const SF_DISPLAY =
  '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, var(--font-inter), "Segoe UI", Arial, sans-serif';

/**
 * Экран рисуется в натуральных размерах телефона и масштабируется целиком.
 *
 * Так типографика и отступы остаются настоящими (17px заголовок остаётся 17px
 * относительно экрана), а не превращаются в подобранные на глаз доли rem.
 */
export function PhoneScreenShell({
  children,
  background
}: {
  children: ReactNode;
  background: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const apply = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      // cover: экран заполняет вырез мокапа целиком, лишнее срезает маска
      setScale(Math.max(width / SCREEN_WIDTH, height / SCREEN_HEIGHT));
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="relative size-full overflow-hidden" style={{ background }}>
      {scale > 0 ? (
        <div
          className="absolute top-1/2 left-1/2 origin-center"
          style={{
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
            transform: `translate(-50%, -50%) scale(${scale})`,
            fontFamily: SF_TEXT
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Честное состояние: данные не получены — вместо выдуманного контента */
export function ScreenUnavailable({
  title,
  hint,
  dark = false
}: {
  title: string;
  hint: string;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-10 text-center">
      <p
        className="text-[17px] leading-tight font-semibold"
        style={{ fontFamily: SF_DISPLAY, color: dark ? "#ffffff" : "#111111" }}
      >
        {title}
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

/** Скелет на время загрузки снимка — без подстановки чужих данных */
export function ScreenLoading({ dark = false }: { dark?: boolean }) {
  const tone = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-6">
      <div className="flex items-center gap-3">
        <span className="size-[86px] animate-pulse rounded-full" style={{ background: tone }} />
        <span className="flex-1 space-y-2">
          <span className="block h-4 w-2/3 animate-pulse rounded" style={{ background: tone }} />
          <span className="block h-3 w-1/2 animate-pulse rounded" style={{ background: tone }} />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {Array.from({ length: 9 }, (_, index) => (
          <span
            key={index}
            className="aspect-square animate-pulse"
            style={{ background: tone }}
          />
        ))}
      </div>
    </div>
  );
}
