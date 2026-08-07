/**
 * Проективное преобразование прямоугольника в произвольный четырёхугольник.
 *
 * Нужно, чтобы плоский экран лёг в дисплей телефона на фотографии: у мокапа
 * ракурс, и обычных rotate/skew недостаточно — только гомография даёт сходящиеся
 * стороны. Матрица считается один раз на размер контейнера.
 */

export type Point = { x: number; y: number };

export type ScreenQuad = {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
};

/** Решение системы линейных уравнений методом Гаусса с выбором главного элемента */
function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) {
        pivot = row;
      }
    }
    if (Math.abs(augmented[pivot]![column]!) < 1e-10) return null;

    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];

    const pivotRow = augmented[column]!;
    const pivotValue = pivotRow[column]!;
    for (let index = column; index <= size; index += 1) {
      pivotRow[index] = pivotRow[index]! / pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      if (factor === 0) continue;
      for (let index = column; index <= size; index += 1) {
        augmented[row]![index] = augmented[row]![index]! - factor * pivotRow[index]!;
      }
    }
  }

  return augmented.map((row) => row[size]!);
}

/**
 * CSS-строка matrix3d, переводящая прямоугольник width × height (от origin 0 0)
 * в четырёхугольник quad. null — вырожденный случай, вызывающий прячет экран.
 */
export function quadToMatrix3d(width: number, height: number, quad: ScreenQuad): string | null {
  if (width <= 0 || height <= 0) return null;

  const source: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ];
  const target: Point[] = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];

  const matrix: number[][] = [];
  const vector: number[] = [];

  for (let index = 0; index < 4; index += 1) {
    const s = source[index]!;
    const t = target[index]!;
    matrix.push([s.x, s.y, 1, 0, 0, 0, -s.x * t.x, -s.y * t.x]);
    vector.push(t.x);
    matrix.push([0, 0, 0, s.x, s.y, 1, -s.x * t.y, -s.y * t.y]);
    vector.push(t.y);
  }

  const h = solveLinearSystem(matrix, vector);
  if (!h) return null;

  // CSS ждёт column-major 4×4; третья строка/столбец — тождественные по Z
  const values = [
    h[0]!, h[3]!, 0, h[6]!,
    h[1]!, h[4]!, 0, h[7]!,
    0, 0, 1, 0,
    h[2]!, h[5]!, 0, 1
  ];

  // Коэффициенты перспективы имеют порядок 1e-4: округление до 6 знаков
  // уводит углы экрана на десятые доли пикселя, поэтому храним 10
  return `matrix3d(${values.map((value) => Number(value.toFixed(10))).join(",")})`;
}
