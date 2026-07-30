"use client";

import { useEffect } from "react";
import { animate, type AnimationPlaybackControls } from "framer-motion";

/**
 * После паузы скролла — короткое плавное залипание к секции.
 * Если пользователь снова крутит — анимация срывается, скролл свободный.
 */
export function LandingSnap() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let controls: AnimationPlaybackControls | null = null;
    let settleTimer = 0;
    let stickTimer = 0;
    let sticking = false;
    let programmatic = false;

    const getSections = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".landing-snap-section"));

    const sectionTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;

    const release = () => {
      window.clearTimeout(stickTimer);
      if (controls) {
        controls.stop();
        controls = null;
      }
      sticking = false;
      programmatic = false;
    };

    const stickToNearest = () => {
      if (sticking) {
        return;
      }

      const y = window.scrollY;
      const magnet = window.innerHeight * 0.2;
      let best: { top: number; dist: number } | null = null;

      for (const el of getSections()) {
        const top = sectionTop(el);
        const dist = Math.abs(top - y);
        if (dist <= magnet && (!best || dist < best.dist)) {
          best = { top, dist };
        }
      }

      if (!best || best.dist < 4) {
        return;
      }

      sticking = true;
      programmatic = true;
      controls = animate(window.scrollY, best.top, {
        duration: 0.38,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (value) => window.scrollTo(0, value),
        onComplete: () => {
          controls = null;
          programmatic = false;
          // Короткое залипание на месте, колесо сразу отпустит
          stickTimer = window.setTimeout(() => {
            sticking = false;
          }, 320);
        }
      });
    };

    const onScroll = () => {
      if (programmatic) {
        return;
      }
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(stickToNearest, 120);
    };

    const onUserIntent = () => {
      window.clearTimeout(settleTimer);
      if (sticking) {
        release();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onUserIntent, { passive: true });
    window.addEventListener("touchstart", onUserIntent, { passive: true });
    window.addEventListener("keydown", onUserIntent, { passive: true });

    return () => {
      release();
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onUserIntent);
      window.removeEventListener("touchstart", onUserIntent);
      window.removeEventListener("keydown", onUserIntent);
    };
  }, []);

  return null;
}
