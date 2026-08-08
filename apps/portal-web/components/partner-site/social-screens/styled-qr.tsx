"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * QR-код со скруглёнными модулями — как в фирменных кодах Telegram и Instagram.
 *
 * Стандартные генераторы рисуют строгие квадраты; здесь каждый модуль скругляет
 * только те углы, у которых нет соседа, поэтому соседние модули сливаются в
 * непрерывные линии, а одиночные превращаются в точки.
 *
 * Границы проверены декодером: радиус 0.40 модуля читается, при 0.45
 * распознавание разваливается.
 */

const RADIUS_RATIO = 0.4;

/**
 * Сторона поля под знак — доля от всего кода вместе с тихой зоной. Считать её
 * от матрицы нельзя: у разных ссылок разная версия символа (29 модулей против
 * 37), и поле выходило бы у каждой площадки своей величины.
 *
 * Предел проверен декодером: 28% читается на всех ссылках, с 30% начинаются
 * сбои, поэтому берём 26% — с запасом на печать и блики экрана.
 */
const FIELD_RATIO = 0.26;

/**
 * Тихая зона внутри кода. Стандартные 4 модуля здесь избыточны: код лежит на
 * белой карточке с полями, которая сама работает внешней тихой зоной. Один
 * модуль оставлен запасом — с ним код читается даже вырезанным из карточки,
 * а полезная площадь растёт с 78% до 94%.
 */
const QUIET_ZONE = 1;

/** Показатель суперэллипса: 4 — форма иконок iOS, мягче обычного скругления */
const SQUIRCLE_EXPONENT = 4;

type Corners = [boolean, boolean, boolean, boolean];

/** Прямоугольник модуля с индивидуальными скруглениями углов */
function modulePath(x: number, y: number, size: number, r: number, corners: Corners): string {
  const [tl, tr, br, bl] = corners;
  const rtl = tl ? r : 0;
  const rtr = tr ? r : 0;
  const rbr = br ? r : 0;
  const rbl = bl ? r : 0;

  return [
    `M${x + rtl},${y}`,
    `H${x + size - rtr}`,
    rtr ? `A${rtr},${rtr} 0 0 1 ${x + size},${y + rtr}` : "",
    `V${y + size - rbr}`,
    rbr ? `A${rbr},${rbr} 0 0 1 ${x + size - rbr},${y + size}` : "",
    `H${x + rbl}`,
    rbl ? `A${rbl},${rbl} 0 0 1 ${x},${y + size - rbl}` : "",
    `V${y + rtl}`,
    rtl ? `A${rtl},${rtl} 0 0 1 ${x + rtl},${y}` : "",
    "Z"
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Суперэллипс |x/a|^n + |y/b|^n = 1 — «мягкий квадрат» без стыков дуг,
 * которыми обычное скругление выдаёт себя на крупных формах.
 */
function squirclePath(cx: number, cy: number, half: number, steps = 96): string {
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const x = cx + half * Math.sign(cos) * Math.abs(cos) ** (2 / SQUIRCLE_EXPONENT);
    const y = cy + half * Math.sign(sin) * Math.abs(sin) ** (2 / SQUIRCLE_EXPONENT);
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(4)},${y.toFixed(4)}`);
  }
  return `${points.join(" ")} Z`;
}

export function StyledQr({
  value,
  size,
  color,
  logo
}: {
  value: string;
  size: number;
  color: string;
  /** Знак площадки в центре; поле под него вырезается из кода */
  logo?: string | undefined;
}) {
  const geometry = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "H" });
    const count = qr.modules.size;
    const data = qr.modules.data;
    const total = count + QUIET_ZONE * 2;

    /**
     * Поле вырезается формой суперэллипса, а не прямоугольником из модулей:
     * округление до целых модулей давало у разных площадок поля разной
     * величины, а доля от размера всего кода держит его одинаковым.
     */
    const holeHalf = (total * FIELD_RATIO) / 2;
    const middle = count / 2;

    const insideField = (row: number, col: number): boolean => {
      const dx = Math.abs(col + 0.5 - middle) / holeHalf;
      const dy = Math.abs(row + 0.5 - middle) / holeHalf;
      return dx ** SQUIRCLE_EXPONENT + dy ** SQUIRCLE_EXPONENT <= 1;
    };

    const isDark = (row: number, col: number): boolean => {
      if (row < 0 || col < 0 || row >= count || col >= count) return false;
      if (logo && insideField(row, col)) return false;
      return data[row * count + col] === 1;
    };

    const parts: string[] = [];
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (!isDark(row, col)) continue;
        const up = isDark(row - 1, col);
        const down = isDark(row + 1, col);
        const left = isDark(row, col - 1);
        const right = isDark(row, col + 1);
        const corners: Corners = [!up && !left, !up && !right, !down && !right, !down && !left];
        parts.push(modulePath(col + QUIET_ZONE, row + QUIET_ZONE, 1, RADIUS_RATIO, corners));
      }
    }

    return { path: parts.join(" "), total, holeHalf };
  }, [value, logo]);

  const center = geometry.total / 2;
  const fieldHalf = geometry.holeHalf;
  // Знак занимает большую часть поля, оставляя ровный воздух по периметру.
  // На читаемость не влияет: модули под полем уже вырезаны
  const markSide = fieldHalf * 2 * 0.8;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${geometry.total} ${geometry.total}`}
      shapeRendering="geometricPrecision"
      aria-hidden
    >
      <path d={geometry.path} fill={color} />

      {logo ? (
        <>
          <path d={squirclePath(center, center, fieldHalf)} fill="#ffffff" />
          <image
            href={logo}
            x={center - markSide / 2}
            y={center - markSide / 2}
            width={markSide}
            height={markSide}
            preserveAspectRatio="xMidYMid meet"
          />
        </>
      ) : null}
    </svg>
  );
}
