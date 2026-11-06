// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Малювання провідної пластини з картою |j| (теплові кольори), лініями струму ψ = const
 * і позначками індукованого поля в центрах вихорів (⊙ — на нас, ⊗ — від нас).
 * Використовується в 2b (маятник) і 2c (диск).
 */
import type { Grid } from '../../physics/streamSolver';
import { contourSegments } from '../../ui/contour';
import { arrow, COL, fieldSymbol, heatColor } from '../../ui/draw';

export interface PlateDrawOpts {
  /** Перетворення координат сітки (i, j) → екран. */
  toScreen: (i: number, j: number) => [number, number];
  /** Масштаб нормування |∇ψ| (для яскравості). */
  jRef: number;
  showLines: boolean;
  /** Колір металу для неструмових ділянок. */
  metal: [number, number, number];
}

const cache = new WeakMap<Grid, { cv: HTMLCanvasElement; img: ImageData }>();

/** Карта |j| у вигляді зображення nx×ny (потім трансформується на екран через setTransform). */
export function plateImage(g: Grid, psi: Float64Array, scale: number, jRef: number, metal: [number, number, number]): HTMLCanvasElement {
  let c = cache.get(g);
  if (!c) {
    const cv = document.createElement('canvas');
    cv.width = g.nx;
    cv.height = g.ny;
    c = { cv, img: cv.getContext('2d')!.createImageData(g.nx, g.ny) };
    cache.set(g, c);
  }
  const { nx, ny, mask } = g;
  const data = c.img.data;
  const val = (i: number, j: number) => (i < 0 || j < 0 || i >= nx || j >= ny || !mask[j * nx + i] ? 0 : psi[j * nx + i]);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      // рядки зображення йдуть згори вниз, а j — знизу вгору
      const o = ((ny - 1 - j) * nx + i) * 4;
      if (!mask[k]) { data[o + 3] = 0; continue; }
      const gx = (val(i + 1, j) - val(i - 1, j)) / 2, gy = (val(i, j + 1) - val(i, j - 1)) / 2;
      const f = Math.min(1, (Math.hypot(gx, gy) * Math.abs(scale)) / jRef);
      const [r, gg, b] = heatColor(Math.sqrt(f));
      const w = Math.min(1, f * 3);
      data[o] = metal[0] * (1 - w) + r * w;
      data[o + 1] = metal[1] * (1 - w) + gg * w;
      data[o + 2] = metal[2] * (1 - w) + b * w;
      data[o + 3] = 255;
    }
  c.cv.getContext('2d')!.putImageData(c.img, 0, 0);
  return c.cv;
}

/** Лінії струму і знаки вихорів. */
export function drawStreamlines(
  ctx: CanvasRenderingContext2D, g: Grid, psi: Float64Array, scale: number, o: PlateDrawOpts,
): void {
  const { nx, ny, mask } = g;
  let max = 0, imax = -1, imin = -1, min = 0;
  for (let k = 0; k < psi.length; k++) {
    if (!mask[k]) continue;
    const v = psi[k] * scale;
    if (v > max) { max = v; imax = k; }
    if (v < min) { min = v; imin = k; }
  }
  const amp = Math.max(max, -min);
  if (amp <= 0) return;
  const levels = [-0.8, -0.55, -0.3, -0.1, 0.1, 0.3, 0.55, 0.8];
  ctx.lineWidth = 1.3;
  for (const lv of levels) {
    ctx.strokeStyle = 'rgba(94,234,212,0.85)';
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of contourSegments(psi.map((v) => v * scale), nx, ny, lv * amp, mask)) {
      const a = o.toScreen(x0, y0), b = o.toScreen(x1, y1);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
  }
  // стрілки напряму струму j = (∂ψ/∂y, −∂ψ/∂x) у кількох точках з великим |j|
  const stepI = Math.max(3, Math.round(nx / 9));
  for (let j = 2; j < ny - 2; j += stepI)
    for (let i = 2; i < nx - 2; i += stepI) {
      const k = j * nx + i;
      if (!mask[k]) continue;
      const jx = (psi[k + nx] - psi[k - nx]) * scale / 2, jy = -(psi[k + 1] - psi[k - 1]) * scale / 2;
      const m = Math.hypot(jx, jy);
      if (m < 0.25 * o.jRef) continue;
      const a = o.toScreen(i, j), b = o.toScreen(i + (jx / m) * 1.8, j + (jy / m) * 1.8);
      arrow(ctx, a[0], a[1], b[0], b[1], COL.cur, 1.6, 6);
    }
  // центри вихорів: максимум ψ → обертання проти год. стрілки → поле ⊙
  if (o.showLines)
    for (const [k, out] of [[imax, true], [imin, false]] as const) {
      if (k < 0) continue;
      const p = o.toScreen(k % nx, Math.floor(k / nx));
      fieldSymbol(ctx, p[0], p[1], 7, out, COL.bInd);
    }
}
