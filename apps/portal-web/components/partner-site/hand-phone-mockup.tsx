"use client";

import type { ReactNode } from "react";

/**
 * Фотомокап: рука с iPhone, фронтальный вид.
 *
 * Ассет и координаты дисплея получены из исходного PSD — область экрана взята
 * из маски смарт-объекта подстановки, поэтому подгонять на глаз ничего не нужно.
 * Вид фронтальный: экран ложится прямоугольником, без перспективных матриц.
 */
const MOCKUP_SRC = "/mockups/hand-iphone-front.webp";
const MOCKUP_WIDTH = 1200;
const MOCKUP_HEIGHT = 1651;

/** Дисплей в процентах от размеров ассета */
const SCREEN_BOX = {
  left: 12.7057,
  top: 1.1627,
  width: 42.9159,
  height: 67.5011
};

export function HandPhoneMockup({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{ position: "relative", aspectRatio: `${MOCKUP_WIDTH} / ${MOCKUP_HEIGHT}` }}
    >
      {/*
        Экран лежит под фотографией: в самом ассете вырезано окно по маске
        подстановки из PSD, поэтому рамка, блики и пальцы остаются сверху,
        а скругления дисплея дают форму окна, а не CSS-радиус.
      */}
      <div
        className="absolute z-[1] overflow-hidden"
        style={{
          left: `${SCREEN_BOX.left}%`,
          top: `${SCREEN_BOX.top}%`,
          width: `${SCREEN_BOX.width}%`,
          height: `${SCREEN_BOX.height}%`,
          // Окно в ассете вырезано почти прямоугольным, а стекло скруглено:
          // без этого радиуса углы контента торчат из-под корпуса
          borderRadius: "13.5% / 6.3%"
        }}
      >
        {children}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MOCKUP_SRC}
        alt=""
        width={MOCKUP_WIDTH}
        height={MOCKUP_HEIGHT}
        className="pointer-events-none absolute inset-0 z-[2] size-full select-none object-contain"
        draggable={false}
      />
    </div>
  );
}
