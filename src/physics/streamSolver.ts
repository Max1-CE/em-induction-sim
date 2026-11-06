// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Розв'язувач для функції струму ψ у тонкій провідній пластині (розділи 2b, 2c).
 *
 * Густина струму j = σ(E + f), де f = (1/c) v×B — стороння (рухова) «напруженість».
 * Подаємо j = rot(ψ ẑ) = (∂ψ/∂y, −∂ψ/∂x) — тоді div j = 0 автоматично.
 * Беремо rot від j/σ = E + f; у лабораторній системі поле магніту стале, тому rot E = 0:
 *   ∇²ψ = −σ (rot f)_z.
 * Крайова умова j·n = 0 на краю пластини ⇔ ψ = const на межі; для однозв'язної
 * області (суцільна пластина або гребінка з прорізами, відкритими на краю) беремо ψ = 0.
 *
 * Дискретизація: комірки h×h, невідомі ψ у центрах «провідних» комірок,
 * за межею пластини ψ = 0; 5-точковий лапласіан; метод спряжених градієнтів (матриця −∇² SPD).
 */

export interface Grid {
  nx: number;
  ny: number;
  /** Крок сітки, см. */
  h: number;
  /** Маска провідних комірок (1 — метал). */
  mask: Uint8Array;
}

/**
 * Розв'язує −Δψ = rhs (rhs = σ·(rot f)_z) з ψ = 0 поза маскою. Повертає ψ (розмір nx·ny).
 */
export function solvePoisson(g: Grid, rhs: Float64Array, tol = 1e-10, maxIt = 2000): Float64Array {
  const { nx, ny, h, mask } = g;
  const n = nx * ny;
  const x = new Float64Array(n);
  const r = new Float64Array(n);
  const p = new Float64Array(n);
  const Ap = new Float64Array(n);
  const h2 = h * h;
  // A = (−Δ)·h²:  (Aψ)_i = 4ψ_i − Σ ψ_сусідів
  const applyA = (v: Float64Array, out: Float64Array) => {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!mask[k]) { out[k] = 0; continue; }
        let s = 4 * v[k];
        if (i > 0 && mask[k - 1]) s -= v[k - 1];
        if (i < nx - 1 && mask[k + 1]) s -= v[k + 1];
        if (j > 0 && mask[k - nx]) s -= v[k - nx];
        if (j < ny - 1 && mask[k + nx]) s -= v[k + nx];
        out[k] = s;
      }
  };
  let rr = 0, bb = 0;
  for (let k = 0; k < n; k++) {
    r[k] = mask[k] ? rhs[k] * h2 : 0;
    p[k] = r[k];
    rr += r[k] * r[k];
  }
  bb = rr;
  if (bb === 0) return x;
  for (let it = 0; it < maxIt && rr > tol * tol * bb; it++) {
    applyA(p, Ap);
    let pAp = 0;
    for (let k = 0; k < n; k++) pAp += p[k] * Ap[k];
    const alpha = rr / pAp;
    let rrNew = 0;
    for (let k = 0; k < n; k++) {
      x[k] += alpha * p[k];
      r[k] -= alpha * Ap[k];
      rrNew += r[k] * r[k];
    }
    const beta = rrNew / rr;
    rr = rrNew;
    for (let k = 0; k < n; k++) p[k] = r[k] + beta * p[k];
  }
  return x;
}

/**
 * Дискретна «енергія Діріхле» ∫|∇ψ|² dA = Σ_ребер (Δψ)² (h²/h² = 1), включно з ребрами до межі (ψ = 0).
 * Потужність джоулевих втрат у пластині товщини d: P = (d/σ) ∫ |j|² dA = (d/σ) ∫ |∇ψ|² dA.
 */
export function dirichletEnergy(g: Grid, psi: Float64Array): number {
  const { nx, ny, mask } = g;
  let s = 0;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!mask[k]) continue;
      const v = psi[k];
      // праве та верхнє ребра; ребра до неметалевих комірок — повний внесок (ψ = 0 там)
      const right = i < nx - 1 && mask[k + 1] ? psi[k + 1] : 0;
      const up = j < ny - 1 && mask[k + nx] ? psi[k + nx] : 0;
      s += (v - right) ** 2 + (v - up) ** 2;
      if (i === 0 || !mask[k - 1]) s += v * v;
      if (j === 0 || !mask[k - nx]) s += v * v;
    }
  return s;
}

/** Густина струму в центрі комірки: j = (∂ψ/∂y, −∂ψ/∂x) (центральні різниці, ψ = 0 поза маскою). */
export function currentAt(g: Grid, psi: Float64Array, i: number, j: number): [number, number] {
  const { nx, ny, h, mask } = g;
  const val = (ii: number, jj: number) => (ii < 0 || jj < 0 || ii >= nx || jj >= ny || !mask[jj * nx + ii] ? 0 : psi[jj * nx + ii]);
  const dpdx = (val(i + 1, j) - val(i - 1, j)) / (2 * h);
  const dpdy = (val(i, j + 1) - val(i, j - 1)) / (2 * h);
  return [dpdy, -dpdx];
}
