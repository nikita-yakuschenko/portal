"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { IconMinus, IconPlus } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type Point = { x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const WHEEL_FACTOR = 1.12;
const BUTTON_STEP = 0.4;

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export type ZoomableImageHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  getScale: () => number;
};

/** Pinch / Ctrl+колесо / кнопки; база = минимум, ниже нельзя */
export const ZoomableImage = forwardRef<
  ZoomableImageHandle,
  {
    src: string;
    alt: string;
    className?: string;
    onZoomChange?: (zoomed: boolean) => void;
  }
>(function ZoomableImage({ src, alt, className, onZoomChange }, ref) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const scaleRef = useRef(MIN_SCALE);
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

  const clampOffset = useCallback((next: Point, nextScale: number): Point => {
    const el = viewportRef.current;
    if (!el || nextScale <= MIN_SCALE) return { x: 0, y: 0 };
    const maxX = (el.clientWidth * (nextScale - 1)) / 2;
    const maxY = (el.clientHeight * (nextScale - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y))
    };
  }, []);

  const applyScale = useCallback(
    (nextScale: number, nextOffset: Point) => {
      const clamped = clampScale(nextScale);
      const next =
        clamped <= MIN_SCALE ? { x: 0, y: 0 } : clampOffset(nextOffset, clamped);
      scaleRef.current = clamped;
      offsetRef.current = next;
      setScale(clamped);
      setOffset(next);
      onZoomChangeRef.current?.(clamped > MIN_SCALE + 0.05);
    },
    [clampOffset]
  );

  const zoomAt = useCallback(
    (nextScale: number, clientX?: number, clientY?: number) => {
      const el = viewportRef.current;
      const clamped = clampScale(nextScale);
      if (!el || clamped === scaleRef.current) {
        applyScale(clamped, offsetRef.current);
        return;
      }
      const rect = el.getBoundingClientRect();
      const cx = clientX != null ? clientX - rect.left - rect.width / 2 : 0;
      const cy = clientY != null ? clientY - rect.top - rect.height / 2 : 0;
      const ratio = clamped / scaleRef.current;
      applyScale(clamped, {
        x: cx - (cx - offsetRef.current.x) * ratio,
        y: cy - (cy - offsetRef.current.y) * ratio
      });
    },
    [applyScale]
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => zoomAt(scaleRef.current + BUTTON_STEP),
      zoomOut: () => zoomAt(scaleRef.current - BUTTON_STEP),
      reset: () => applyScale(MIN_SCALE, { x: 0, y: 0 }),
      getScale: () => scaleRef.current
    }),
    [applyScale, zoomAt]
  );

  useEffect(() => {
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = MIN_SCALE;
    offsetRef.current = { x: 0, y: 0 };
    pinchRef.current = null;
    panRef.current = null;
    onZoomChangeRef.current?.(false);
  }, [src]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      const direction = event.deltaY < 0 ? 1 : -1;
      const next =
        direction > 0
          ? scaleRef.current * WHEEL_FACTOR
          : scaleRef.current / WHEEL_FACTOR;
      zoomAt(next, event.clientX, event.clientY);
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

      if (event.touches.length === 1 && scaleRef.current > MIN_SCALE) {
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
        const nextScale = clampScale(pinchRef.current.startScale * ratio);
        const mid = midpoint(a, b);
        applyScale(nextScale, {
          x: pinchRef.current.startOffset.x + (mid.x - pinchRef.current.startMid.x),
          y: pinchRef.current.startOffset.y + (mid.y - pinchRef.current.startMid.y)
        });
        return;
      }

      if (event.touches.length === 1 && panRef.current && scaleRef.current > MIN_SCALE) {
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
        if (scaleRef.current <= MIN_SCALE + 0.05) {
          applyScale(MIN_SCALE, { x: 0, y: 0 });
        }

        if (!movingRef.current) {
          const now = Date.now();
          if (now - lastTapRef.current < 280) {
            if (scaleRef.current > MIN_SCALE) {
              applyScale(MIN_SCALE, { x: 0, y: 0 });
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

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [applyScale, clampOffset, zoomAt]);

  return (
    <div
      ref={viewportRef}
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden",
        scale > MIN_SCALE ? "touch-none" : "touch-pan-x",
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
});

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
  const zoomRef = useRef<ZoomableImageHandle>(null);
  const lockRef = useRef(false);
  const [zoomed, setZoomed] = useState(false);
  const [scale, setScale] = useState(MIN_SCALE);

  useEffect(() => {
    setZoomed(false);
    setScale(MIN_SCALE);
  }, [index, items]);

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

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    lockRef.current = true;
    el.scrollTo({ left: index * el.clientWidth, behavior: "auto" });
    window.setTimeout(() => {
      lockRef.current = false;
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomRef.current?.zoomIn();
        window.setTimeout(() => setScale(zoomRef.current?.getScale() ?? MIN_SCALE), 0);
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomRef.current?.zoomOut();
        window.setTimeout(() => setScale(zoomRef.current?.getScale() ?? MIN_SCALE), 0);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el || lockRef.current || zoomed || el.clientWidth <= 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.min(Math.max(next, 0), items.length - 1);
    if (clamped !== index) onIndexChange(clamped);
  }

  function handleZoomChange(nextZoomed: boolean) {
    setZoomed(nextZoomed);
    setScale(zoomRef.current?.getScale() ?? (nextZoomed ? 1.2 : MIN_SCALE));
  }

  function zoomIn() {
    zoomRef.current?.zoomIn();
    window.setTimeout(() => setScale(zoomRef.current?.getScale() ?? MIN_SCALE), 0);
  }

  function zoomOut() {
    zoomRef.current?.zoomOut();
    window.setTimeout(() => setScale(zoomRef.current?.getScale() ?? MIN_SCALE), 0);
  }

  if (items.length === 0) return null;

  const canZoomOut = scale > MIN_SCALE + 0.05;
  const canZoomIn = scale < MAX_SCALE - 0.05;

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className={cn(
          "flex h-full w-full snap-x snap-mandatory overscroll-x-contain",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          zoomed ? "overflow-hidden" : "touch-pan-x overflow-x-auto overflow-y-hidden"
        )}
      >
        {items.map((item, itemIndex) => (
          <div
            key={`${item.sourceUrl}-${itemIndex}`}
            className="relative h-full w-full min-w-full shrink-0 snap-center snap-always"
          >
            <ZoomableImage
              ref={itemIndex === index ? zoomRef : null}
              src={item.sourceUrl}
              alt={item.label?.trim() || `Фото ${itemIndex + 1}`}
              className="absolute inset-0"
              {...(itemIndex === index ? { onZoomChange: handleZoomChange } : {})}
            />
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 sm:block">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/55 p-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={zoomOut}
            disabled={!canZoomOut}
            aria-label="Уменьшить"
            title="Уменьшить (−)"
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-full text-white transition",
              canZoomOut ? "hover:bg-white/15" : "cursor-not-allowed opacity-35"
            )}
          >
            <IconMinus className="size-5" stroke={1.75} />
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={!canZoomIn}
            aria-label="Увеличить"
            title="Увеличить (+)"
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-full text-white transition",
              canZoomIn ? "hover:bg-white/15" : "cursor-not-allowed opacity-35"
            )}
          >
            <IconPlus className="size-5" stroke={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
