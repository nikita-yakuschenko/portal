"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { quadToMatrix3d, type ScreenQuad } from "@/lib/perspective";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./social-screens/screen-shell";

/**
 * Фотомокап: рука с iPhone 16 Pro на прозрачном фоне.
 * Ассет и координаты получены из исходного PSD — углы дисплея взяты из маски
 * смарт-объекта, поэтому экран садится ровно в стекло, без подгонки на глаз.
 */
const MOCKUP_SRC = "/mockups/hand-iphone-16-pro.webp";
const MOCKUP_WIDTH = 1400;
const MOCKUP_HEIGHT = 1938;

/** Углы дисплея в процентах от размеров ассета */
const SCREEN_CORNERS = {
  topLeft: { x: 39.6809, y: 2.3295 },
  topRight: { x: 79.1582, y: 10.2499 },
  bottomRight: { x: 50.8486, y: 75.5007 },
  bottomLeft: { x: 10.4209, y: 67.7275 }
};

export function HandPhoneMockup({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const apply = () => {
      const rect = host.getBoundingClientRect();
      setBox({ width: rect.width, height: rect.height });
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const matrix = useMemo(() => {
    if (box.width <= 0 || box.height <= 0) return null;
    const quad: ScreenQuad = {
      topLeft: {
        x: (SCREEN_CORNERS.topLeft.x / 100) * box.width,
        y: (SCREEN_CORNERS.topLeft.y / 100) * box.height
      },
      topRight: {
        x: (SCREEN_CORNERS.topRight.x / 100) * box.width,
        y: (SCREEN_CORNERS.topRight.y / 100) * box.height
      },
      bottomRight: {
        x: (SCREEN_CORNERS.bottomRight.x / 100) * box.width,
        y: (SCREEN_CORNERS.bottomRight.y / 100) * box.height
      },
      bottomLeft: {
        x: (SCREEN_CORNERS.bottomLeft.x / 100) * box.width,
        y: (SCREEN_CORNERS.bottomLeft.y / 100) * box.height
      }
    };
    return quadToMatrix3d(SCREEN_WIDTH, SCREEN_HEIGHT, quad);
  }, [box.width, box.height]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ position: "relative", aspectRatio: `${MOCKUP_WIDTH} / ${MOCKUP_HEIGHT}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MOCKUP_SRC}
        alt=""
        width={MOCKUP_WIDTH}
        height={MOCKUP_HEIGHT}
        className="absolute inset-0 z-[1] size-full select-none object-contain"
        draggable={false}
      />

      {/*
        Экран рисуется в натуральную величину и кладётся на стекло гомографией.
        Скругление задаётся до трансформации — перспектива искажает его вместе
        с содержимым, как настоящие углы дисплея.
      */}
      {matrix ? (
        <div
          className="absolute top-0 left-0 z-[2] overflow-hidden"
          style={{
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
            borderRadius: 58,
            transform: matrix,
            transformOrigin: "0 0",
            backfaceVisibility: "hidden"
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
