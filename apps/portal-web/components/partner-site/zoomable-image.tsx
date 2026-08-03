"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Point = { x: number; y: number };

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Pinch / double-tap zoom на одном кадре (листание — снаружи, каруселью) */
export function ZoomableImage({
  src,
  alt,
  className,
  onZoomChange
}: {
  src: string;
  alt: string;
  className?: string;
  onZoomChange?: (zoomed: boolean) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });

  const pinchRef = useRef<{
    startDist: number;
    startScale: number;
    startOffset: Point;
    startMid: Point;
  } | null>(null);
  const panRef = useRef<{ start: Point; origin: Point } | null>(null);
  const lastTapRef = useRef(0);
  const movingRef = useRef(false);
  const onZoomChangeRef = useRef(onZoomChange);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    pinchRef.current = null;
    panRef.current = null;
    onZoomChangeRef.current?.(false);
  }, [src]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function clampOffset(next: Point, nextScale: number): Point {
      if (!el || nextScale <= 1) return { x: 0, y: 0 };
      const maxX = (el.clientWidth * (nextScale - 1)) / 2;
      const maxY = (el.clientHeight * (nextScale - 1)) / 2;
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y))
      };
    }

    function applyScale(nextScale: number, nextOffset: Point) {
      scaleRef.current = nextScale;
      offsetRef.current = nextOffset;
      setScale(nextScale);
      setOffset(nextOffset);
      onZoomChangeRef.current?.(nextScale > 1.05);
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length === 2) {
        const a = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
        const b = { x: event.touches[1]!.clientX, y: event.touches[1]!.clientY };
        pinchRef.current = {
          startDist: distance(a, b) || 1,
          startScale: scaleRef.current,
          startOffset: offsetRef.current,
          startMid: midpoint(a, b)
        };
        panRef.current = null;
        movingRef.current = true;
        return;
      }

      if (event.touches.length === 1 && scaleRef.current > 1) {
        panRef.current = {
          start: { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY },
          origin: offsetRef.current
        };
        movingRef.current = true;
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (event.touches.length === 2 && pinchRef.current) {
        event.preventDefault();
        const a = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
        const b = { x: event.touches[1]!.clientX, y: event.touches[1]!.clientY };
        const ratio = distance(a, b) / pinchRef.current.startDist;
        const nextScale = Math.min(4, Math.max(1, pinchRef.current.startScale * ratio));
        const mid = midpoint(a, b);
        const nextOffset = clampOffset(
          {
            x: pinchRef.current.startOffset.x + (mid.x - pinchRef.current.startMid.x),
            y: pinchRef.current.startOffset.y + (mid.y - pinchRef.current.startMid.y)
          },
          nextScale
        );
        applyScale(nextScale, nextOffset);
        return;
      }

      if (event.touches.length === 1 && panRef.current && scaleRef.current > 1) {
        event.preventDefault();
        const nextOffset = clampOffset(
          {
            x: panRef.current.origin.x + (event.touches[0]!.clientX - panRef.current.start.x),
            y: panRef.current.origin.y + (event.touches[0]!.clientY - panRef.current.start.y)
          },
          scaleRef.current
        );
        offsetRef.current = nextOffset;
        setOffset(nextOffset);
      }
    }

    function onTouchEnd(event: TouchEvent) {
      if (event.touches.length < 2) pinchRef.current = null;
      if (event.touches.length === 0) {
        panRef.current = null;
        if (scaleRef.current <= 1.05) {
          applyScale(1, { x: 0, y: 0 });
        }

        if (!movingRef.current) {
          const now = Date.now();
          if (now - lastTapRef.current < 280) {
            if (scaleRef.current > 1) {
              applyScale(1, { x: 0, y: 0 });
            } else {
              applyScale(2.4, { x: 0, y: 0 });
            }
            lastTapRef.current = 0;
          } else {
            lastTapRef.current = now;
          }
        }
        movingRef.current = false;
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={viewportRef}
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden",
        scale > 1 ? "touch-none" : "touch-pan-x",
        className
      )}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
        className="max-h-full max-w-full origin-center object-contain select-none"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          transition: pinchRef.current || panRef.current ? "none" : "transform 160ms ease-out"
        }}
      />
    </div>
  );
}

export type LightboxCarouselItem = {
  sourceUrl: string;
  label?: string | null;
};

/** Полноэкранная карусель: соседние кадры едут за пальцем (scroll-snap) */
export function MediaLightboxCarousel({
  items,
  index,
  onIndexChange,
  className
}: {
  items: LightboxCarouselItem[];
  index: number;
  onIndexChange: (index: number) => void;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || zoomed) return;
    const target = index * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) < 2) return;
    lockRef.current = true;
    el.scrollTo({ left: target, behavior: "smooth" });
    const timer = window.setTimeout(() => {
      lockRef.current = false;
    }, 420);
    return () => window.clearTimeout(timer);
  }, [index, zoomed, items.length]);

  // При открытии / смене набора — без анимации встать на нужный кадр
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    lockRef.current = true;
    el.scrollTo({ left: index * el.clientWidth, behavior: "auto" });
    window.setTimeout(() => {
      lockRef.current = false;
    }, 50);
    // только при первом маунте / смене длины ленты
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el || lockRef.current || zoomed || el.clientWidth <= 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.min(Math.max(next, 0), items.length - 1);
    if (clamped !== index) onIndexChange(clamped);
  }

  if (items.length === 0) return null;

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className={cn(
        "flex h-full w-full snap-x snap-mandatory overscroll-x-contain",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        zoomed ? "overflow-hidden" : "touch-pan-x overflow-x-auto overflow-y-hidden",
        className
      )}
    >
      {items.map((item, itemIndex) => (
        <div
          key={`${item.sourceUrl}-${itemIndex}`}
          className="relative h-full w-full min-w-full shrink-0 snap-center snap-always"
        >
          <ZoomableImage
            src={item.sourceUrl}
            alt={item.label?.trim() || `Фото ${itemIndex + 1}`}
            className="absolute inset-0"
            {...(itemIndex === index ? { onZoomChange: setZoomed } : {})}
          />
        </div>
      ))}
    </div>
  );
}
