import { describe, expect, it } from "vitest";

import { quadToMatrix3d, type ScreenQuad } from "@/lib/perspective";

/** Применяет CSS-матрицу к точке так же, как это делает браузер */
function applyMatrix(matrix: string, x: number, y: number): { x: number; y: number } {
  const values = matrix
    .replace("matrix3d(", "")
    .replace(")", "")
    .split(",")
    .map(Number);

  // column-major: индексы 0..3 — первый столбец
  const a = values[0]!;
  const b = values[1]!;
  const c = values[4]!;
  const d = values[5]!;
  const tx = values[12]!;
  const ty = values[13]!;
  const p1 = values[3]!;
  const p2 = values[7]!;

  const w = p1 * x + p2 * y + 1;
  return { x: (a * x + c * y + tx) / w, y: (b * x + d * y + ty) / w };
}

const quad: ScreenQuad = {
  topLeft: { x: 120, y: 40 },
  topRight: { x: 420, y: 110 },
  bottomRight: { x: 360, y: 700 },
  bottomLeft: { x: 40, y: 610 }
};

describe("перспектива экрана мокапа", () => {
  const matrix = quadToMatrix3d(393, 852, quad);

  it("возвращает CSS-матрицу", () => {
    expect(matrix).toMatch(/^matrix3d\(/);
  });

  it("переводит углы прямоугольника ровно в углы дисплея", () => {
    expect(matrix).not.toBeNull();
    const corners: Array<[number, number, { x: number; y: number }]> = [
      [0, 0, quad.topLeft],
      [393, 0, quad.topRight],
      [393, 852, quad.bottomRight],
      [0, 852, quad.bottomLeft]
    ];

    for (const [x, y, expected] of corners) {
      const actual = applyMatrix(matrix!, x, y);
      expect(actual.x).toBeCloseTo(expected.x, 3);
      expect(actual.y).toBeCloseTo(expected.y, 3);
    }
  });

  it("центр экрана остаётся внутри четырёхугольника", () => {
    const center = applyMatrix(matrix!, 393 / 2, 852 / 2);
    const xs = Object.values(quad).map((point) => point.x);
    const ys = Object.values(quad).map((point) => point.y);
    expect(center.x).toBeGreaterThan(Math.min(...xs));
    expect(center.x).toBeLessThan(Math.max(...xs));
    expect(center.y).toBeGreaterThan(Math.min(...ys));
    expect(center.y).toBeLessThan(Math.max(...ys));
  });

  it("на вырожденных размерах возвращает null, а не кривую матрицу", () => {
    expect(quadToMatrix3d(0, 852, quad)).toBeNull();
    expect(quadToMatrix3d(393, 0, quad)).toBeNull();
  });
});
