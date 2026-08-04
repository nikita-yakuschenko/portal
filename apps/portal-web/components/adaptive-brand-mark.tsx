"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type LogoTone = "light" | "dark" | "unknown";

/** Средняя яркость непрозрачных пикселей — для светлых/тёмных mark. */
function detectLogoTone(src: string): Promise<LogoTone> {
  return new Promise((resolve) => {
    const img = new Image();
    // data: и same-origin — ок; внешние URL могут taint canvas
    if (!src.startsWith("data:") && !src.startsWith("/") && !src.startsWith(window.location.origin)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve("unknown");
          return;
        }
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let sum = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3]!;
          if (alpha < 40) continue;
          const r = data[i]!;
          const g = data[i + 1]!;
          const b = data[i + 2]!;
          sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
          count += 1;
        }
        if (count < 8) {
          resolve("unknown");
          return;
        }
        resolve(sum / count >= 155 ? "light" : "dark");
      } catch {
        resolve("unknown");
      }
    };
    img.onerror = () => resolve("unknown");
    img.src = src;
  });
}

type AdaptiveBrandMarkProps = {
  src: string;
  alt?: string;
  className?: string;
  /** Если тон известен заранее (например AVGST mark) */
  toneHint?: LogoTone;
};

/**
 * Светлый mark на light-теме → тёмный силуэт;
 * тёмный mark на dark-теме → светлый силуэт.
 */
export function AdaptiveBrandMark({
  src,
  alt = "",
  className,
  toneHint
}: AdaptiveBrandMarkProps) {
  const [tone, setTone] = useState<LogoTone>(toneHint ?? "unknown");

  useEffect(() => {
    if (toneHint && toneHint !== "unknown") {
      setTone(toneHint);
      return;
    }
    let cancelled = false;
    void detectLogoTone(src).then((next) => {
      if (!cancelled) setTone(next);
    });
    return () => {
      cancelled = true;
    };
  }, [src, toneHint]);

  const toneClass =
    tone === "light"
      ? "brightness-0 dark:brightness-100"
      : tone === "dark"
        ? "dark:brightness-0 dark:invert"
        : "";

  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      className={cn("object-contain", toneClass, className)}
    />
  );
}
