"use client";

import { useEffect, useId, useState } from "react";

// Тот же ролик экскурсии по производству, что на avgst.ru (#video-ekskursia)
const KINESCOPE_EMBED =
  "https://kinescope.io/embed/npS4zk5fgxhM7XbFGRkoq7?autoplay=1&muted=0";

const VIDEO_THUMB = "/landing/factory-video-thumb.jpg";
const PLAY_ICON = "/landing/play-circle.svg";

type FactoryVideoProps = {
  src: string;
  alt: string;
};

export function FactoryVideo({ src, alt }: FactoryVideoProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div className="group relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-sm md:mx-0 md:max-w-none">
        <img
          src={src}
          alt={alt}
          className="aspect-[5/6] w-full object-cover object-center grayscale transition-[filter] duration-500 ease-out group-hover:grayscale-0"
        />

        {/* Блок-превью как на avgst.ru */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl bg-white p-2 text-left shadow-md transition hover:shadow-lg sm:bottom-4 sm:left-4 sm:gap-3.5 sm:p-2.5"
          aria-haspopup="dialog"
          aria-label="Посмотреть видео с производства"
        >
          <span className="relative h-[4.25rem] w-[6.5rem] shrink-0 overflow-hidden rounded-lg sm:h-[5rem] sm:w-[7.5rem]">
            <img
              src={VIDEO_THUMB}
              alt=""
              className="h-full w-full object-cover"
            />
            <img
              src={PLAY_ICON}
              alt=""
              className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm sm:h-9 sm:w-9"
            />
          </span>

          <span className="flex min-w-0 flex-col items-start gap-2 pr-1 sm:gap-2.5 sm:pr-1.5">
            <span className="max-w-[8.5rem] text-[13px] leading-snug text-foreground sm:max-w-[9rem] sm:text-sm">
              Посмотреть видео с&nbsp;производства
            </span>
            <span className="inline-flex h-9 items-center justify-center rounded-lg bg-avgst-green px-4 text-sm font-semibold text-white sm:h-10 sm:px-5">
              Смотреть
            </span>
          </span>
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-6xl overflow-hidden rounded-xl bg-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="aspect-video w-full">
              <iframe
                src={KINESCOPE_EMBED}
                title='Завод «Авангард Строй»'
                className="h-full w-full border-0"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock;"
                allowFullScreen
              />
            </div>

            {/* Заголовок и закрытие поверх видео */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent px-3 pb-12 pt-3 sm:px-4 sm:pt-4">
              <h2
                id={titleId}
                className="pt-1.5 text-sm font-medium text-white drop-shadow sm:text-base"
              >
                Завод «Авангард Строй»
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-lg bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                aria-label="Закрыть"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
