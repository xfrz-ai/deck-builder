export type Point = readonly [x: number, y: number];

// Corners in order: top-left, top-right, bottom-right, bottom-left.
export type Quad = readonly [Point, Point, Point, Point];

export interface PixelBuffer {
  data: Uint8ClampedArray;
  height: number;
  width: number;
}

// Gaussian elimination with partial pivoting; `matrix` is n×n.
function solveLinearSystem(matrix: number[][], values: number[]) {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;

    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) {
        pivot = row;
      }
    }

    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];

    for (let row = column + 1; row < size; row += 1) {
      const factor = rows[row][column] / rows[column][column];

      for (let index = column; index <= size; index += 1) {
        rows[row][index] -= factor * rows[column][index];
      }
    }
  }

  const solution = new Array<number>(size).fill(0);

  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = rows[row][size];

    for (let index = row + 1; index < size; index += 1) {
      sum -= rows[row][index] * solution[index];
    }

    solution[row] = sum / rows[row][row];
  }

  return solution;
}

// Row-major 3×3 matrix that maps each `from` corner onto the `to` corner.
function computeHomography(from: Quad, to: Quad) {
  const matrix: number[][] = [];
  const values: number[] = [];

  for (let index = 0; index < 4; index += 1) {
    const [x, y] = from[index];
    const [u, v] = to[index];

    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }

  return [...solveLinearSystem(matrix, values), 1];
}

// Pushes every corner away from the centre so anti-aliased mask edges
// never reveal what is underneath the warped image.
export function expandQuad(quad: Quad, amount: number): Quad {
  const centerX = quad.reduce((sum, [x]) => sum + x, 0) / 4;
  const centerY = quad.reduce((sum, [, y]) => sum + y, 0) / 4;
  const expand = ([x, y]: Point): Point => {
    const distance = Math.hypot(x - centerX, y - centerY) || 1;

    return [
      x + ((x - centerX) / distance) * amount,
      y + ((y - centerY) / distance) * amount,
    ];
  };

  return [expand(quad[0]), expand(quad[1]), expand(quad[2]), expand(quad[3])];
}

// Draws the whole `source` into `quad` on `target` with a perspective
// transform, sampling bilinearly. Pixels outside the quad are untouched.
export function warpIntoQuad(
  source: PixelBuffer,
  target: PixelBuffer,
  quad: Quad,
) {
  const { data: sourceData, height: sourceHeight, width: sourceWidth } = source;
  const { data: targetData, height: targetHeight, width: targetWidth } = target;
  // Inverse mapping: target pixel → source pixel.
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = computeHomography(quad, [
    [0, 0],
    [sourceWidth, 0],
    [sourceWidth, sourceHeight],
    [0, sourceHeight],
  ]);
  const xs = quad.map(([x]) => x);
  const ys = quad.map(([, y]) => y);
  const left = Math.max(0, Math.floor(Math.min(...xs)));
  const right = Math.min(targetWidth, Math.ceil(Math.max(...xs)));
  const top = Math.max(0, Math.floor(Math.min(...ys)));
  const bottom = Math.min(targetHeight, Math.ceil(Math.max(...ys)));

  for (let y = top; y < bottom; y += 1) {
    const pixelY = y + 0.5;

    for (let x = left; x < right; x += 1) {
      const pixelX = x + 0.5;
      const w = h6 * pixelX + h7 * pixelY + h8;
      const u = (h0 * pixelX + h1 * pixelY + h2) / w;
      const v = (h3 * pixelX + h4 * pixelY + h5) / w;

      if (u < 0 || v < 0 || u > sourceWidth || v > sourceHeight) {
        continue;
      }

      const sampleX = Math.min(Math.max(u - 0.5, 0), sourceWidth - 1);
      const sampleY = Math.min(Math.max(v - 0.5, 0), sourceHeight - 1);
      const x0 = Math.floor(sampleX);
      const y0 = Math.floor(sampleY);
      const x1 = Math.min(x0 + 1, sourceWidth - 1);
      const y1 = Math.min(y0 + 1, sourceHeight - 1);
      const tx = sampleX - x0;
      const ty = sampleY - y0;
      const i00 = (y0 * sourceWidth + x0) * 4;
      const i10 = (y0 * sourceWidth + x1) * 4;
      const i01 = (y1 * sourceWidth + x0) * 4;
      const i11 = (y1 * sourceWidth + x1) * 4;
      const targetIndex = (y * targetWidth + x) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        const topValue =
          sourceData[i00 + channel] * (1 - tx) + sourceData[i10 + channel] * tx;
        const bottomValue =
          sourceData[i01 + channel] * (1 - tx) + sourceData[i11 + channel] * tx;

        targetData[targetIndex + channel] =
          topValue * (1 - ty) + bottomValue * ty;
      }
    }
  }
}
