// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Розділ 2c. Електромагнітне гальмо: провідний диск (радіус R_d, товщина d) обертається з ω,
 * нерухомий магніт (квадратний полюс зі стороною 2s) на відстані r₀ від осі.
 *
 * Малі ω (квазістатика): як і в 2b, f = (1/c)v×B = (ω/c)B(r)·r, ∇²ψ = −σ(rot f)_z, ψ = 0 на ободі.
 * Диск осесиметричний, тож картина струмів у лабораторії стаціонарна, і
 *   M = −K₀ω,   K₀ = (d/σ)∫|∇Ψ|²dA  ∝ σ B² d   (Ψ — розв'язок при ω = 1).
 * Великі ω: поле вихрових струмів уже не мале порівняно з B (скін-ефект / магнітне число Рейнольдса),
 * струми «відтісняються» і момент спадає. Використовуємо напівемпіричну модель тонкого листа
 * (теорія рухомих зображень Максвелла–Рейтца) з характерною швидкістю w = c²/(2πσd)
 * (СІ: w = 2/(μ₀σd)):
 *   M(ω) = −K₀ω / (1 + (ω/ω_c)²),   ω_c = w/r₀ = c²/(2πσ d r₀),
 * максимум |M| = K₀ω_c/2 при ω = ω_c.
 * Динаміка: J dω/dt = M_привід + M(ω);  Q̇ = −M(ω)ω.
 */
import { C, C2 } from './constants';
import { RK4 } from './rk4';
import { solvePoisson, dirichletEnergy, type Grid } from './streamSolver';
import type { EnergyBudget } from './energy';

export interface DiskParams {
  sigma: number;
  rho: number;
  d: number;      // товщина, см
  Rd: number;     // радіус диска, см
  r0: number;     // відстань центру полюса від осі, см
  pole: number;   // половина сторони полюса, см
  B0: number;     // Гс
  drive: number;  // момент приводу, дин·см
  skin: boolean;  // враховувати спадання при великих ω
}

export function diskPoleField(p: DiskParams, x: number, y: number): number {
  const del = 0.25;
  const S = (s: number) => 0.5 * (Math.tanh((s + p.pole) / del) - Math.tanh((s - p.pole) / del));
  return p.B0 * S(x - p.r0) * S(y);
}

export class DiskModel {
  grid: Grid;
  x0: number;
  psi: Float64Array;
  K0: number;
  J: number;

  constructor(public p: DiskParams, n = 70) {
    const h = (2 * p.Rd) / n;
    const mask = new Uint8Array(n * n);
    this.x0 = -p.Rd + h / 2;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = this.x0 + i * h, y = this.x0 + j * h;
        mask[j * n + i] = x * x + y * y < p.Rd * p.Rd ? 1 : 0;
      }
    this.grid = { nx: n, ny: n, h, mask };
    const rhs = new Float64Array(n * n);
    const e = h / 2;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = this.x0 + i * h, y = this.x0 + j * h;
        const dBx = (diskPoleField(p, x + e, y) - diskPoleField(p, x - e, y)) / (2 * e);
        const dBy = (diskPoleField(p, x, y + e) - diskPoleField(p, x, y - e)) / (2 * e);
        // (rot f)_z = (1/c)(y ∂B/∂x − x ∂B/∂y) при ω = 1
        rhs[j * n + i] = (p.sigma / C) * (y * dBx - x * dBy);
      }
    this.psi = solvePoisson(this.grid, rhs);
    this.K0 = (p.d / p.sigma) * dirichletEnergy(this.grid, this.psi);
    this.J = 0.5 * Math.PI * p.Rd ** 2 * p.d * p.rho * p.Rd ** 2;
  }

  /** Характерна кутова швидкість ω_c = c²/(2πσ d r₀). */
  get omegaC(): number {
    return C2 / (2 * Math.PI * this.p.sigma * this.p.d * this.p.r0);
  }

  /** Гальмівний момент M(ω). */
  torque(w: number): number {
    const x = this.p.skin ? w / this.omegaC : 0;
    return (-this.K0 * w) / (1 + x * x);
  }
}

const W = 0, PH = 1, Q = 2, A = 3;

export class DiskBrake {
  t = 0;
  y = new Float64Array(4);
  private rk = new RK4(4);

  constructor(public m: DiskModel, public omega0 = 100) {
    this.reset();
  }

  reset(): void {
    this.t = 0;
    this.y.fill(0);
    this.y[W] = this.omega0;
  }

  private deriv = (_t: number, y: Float64Array, d: Float64Array): void => {
    const M = this.m.torque(y[W]);
    d[W] = (this.m.p.drive + M) / this.m.J;
    d[PH] = y[W];
    d[Q] = -M * y[W];
    d[A] = this.m.p.drive * y[W];
  };

  step(dt: number): void {
    const w = Math.abs(this.y[W]) + 1;
    this.t = this.rk.advance(this.deriv, this.t, this.y, dt, Math.min(1e-3, 0.05 / w));
  }

  energies(): EnergyBudget {
    return { mech: 0.5 * this.m.J * this.y[W] ** 2, mag: 0, heat: this.y[Q], ext: this.y[A] };
  }
}
