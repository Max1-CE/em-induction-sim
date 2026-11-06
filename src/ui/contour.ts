// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Ізолінії скалярного поля на сітці (marching squares). Лінії ψ = const — це лінії струму,
 * бо j = rot(ψẑ) дотичне до ізоліній ψ.
 * Повертає відрізки в координатах сітки (i, j — центри комірок).
 */
export function contourSegments(
  f: Float64Array, nx: number, ny: number, level: number, mask?: Uint8Array,
): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const val = (i: number, j: number) => (mask && !mask[j * nx + i] ? 0 : f[j * nx + i]);
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = val(i, j), b = val(i + 1, j), c = val(i + 1, j + 1), d = val(i, j + 1);
      const idx = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const lerp = (p: number, q: number) => (level - p) / (q - p || 1e-300);
      const pts: Record<string, [number, number]> = {
        b: [i + lerp(a, b), j],         // нижнє ребро
        r: [i + 1, j + lerp(b, c)],     // праве
        t: [i + lerp(d, c), j + 1],     // верхнє
        l: [i, j + lerp(a, d)],         // ліве
      };
      const seg = (p: string, q: string) => out.push([pts[p][0], pts[p][1], pts[q][0], pts[q][1]]);
      switch (idx) {
        case 1: case 14: seg('l', 'b'); break;
        case 2: case 13: seg('b', 'r'); break;
        case 3: case 12: seg('l', 'r'); break;
        case 4: case 11: seg('r', 't'); break;
        case 5: seg('l', 't'); seg('b', 'r'); break;
        case 6: case 9: seg('b', 't'); break;
        case 7: case 8: seg('l', 't'); break;
        case 10: seg('l', 'b'); seg('r', 't'); break;
      }
    }
  return out;
}
