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

/** Pinch / double-tap zoom только на картинке; свайп влево/вправо при scale=1 */
export function ZoomableImage({
  src,
  alt,
  className,
  onSwipeLeft,
  onSwipeRight
}: {
  src: string;
  alt: string;
  className?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
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
  const swipeRef = useRef<Point | null>(null);
  const lastTapRef = useRef(0);
  const movingRef = useRef(false);
  const swipeLeftRef = useRef(onSwipeLeft);
  const swipeRightRef = useRef(onSwipeRight);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  useEffect(() => {
    swipeLeftRef.current = onSwipeLeft;
  }, [onSwipeLeft]);
  useEffect(() => {
    swipeRightRef.current = onSwipeRight;
  }, [onSwipeRight]);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    pinchRef.current = null;
    panRef.current = null;
    swipeRef.current = null;
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
        swipeRef.current = null;
        movingRef.current = true;
        return;
      }

      if (event.touches.length === 1) {
        const point = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
        if (scaleRef.current > 1) {
          panRef.current = { start: point, origin: offsetRef.current };
          swipeRef.current = null;
          movingRef.current = true;
        } else {
          swipeRef.current = point;
          movingRef.current = false;
        }
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
        scaleRef.current = nextScale;
        offsetRef.current = nextOffset;
        setScale(nextScale);
        setOffset(nextOffset);
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
        // Свайп между фото только без зума
        if (swipeRef.current && scaleRef.current <= 1 && event.changedTouches[0]) {
          const dx = event.changedTouches[0].clientX - swipeRef.current.x;
          const dy = event.changedTouches[0].clientY - swipeRef.current.y;
          if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) swipeLeftRef.current?.();
            else swipeRightRef.current?.();
            movingRef.current = true;
          }
        }

        panRef.current = null;
        swipeRef.current = null;
        if (scaleRef.current <= 1.05) {
          scaleRef.current = 1;
          offsetRef.current = { x: 0, y: 0 };
          setScale(1);
          setOffset({ x: 0, y: 0 });
        }

        // Double-tap zoom
        if (!movingRef.current || scaleRef.current === 1) {
          const now = Date.now();
          if (now - lastTapRef.current < 280) {
            if (scaleRef.current > 1) {
              scaleRef.current = 1;
              offsetRef.current = { x: 0, y: 0 };
              setScale(1);
              setOffset({ x: 0, y: 0 });
            } else {
              scaleRef.current = 2.4;
              setScale(2.4);
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
        "flex h-full w-full touch-none items-center justify-center overflow-hidden",
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
