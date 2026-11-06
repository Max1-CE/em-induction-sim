// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Розділ 1. Рамка (N витків, площа S), що обертається в однорідному полі B — генератор змінного струму.
 * φ — кут між нормаллю рамки і B.
 *
 *   Φ = N B S cos φ;
 *   ε = −(1/c) dΦ/dt = (1/c) N B S ω sin φ                     (СГС; СІ: ε = NBSω sin φ);
 *   (L/c²) dI/dt = ε − R I;
 *   M_ел = −(I/c) N B S sin φ  (= 𝔪×B, 𝔪 = N I S / c)          — гальмує обертання (Ленц), M_ел·ω = −εI;
 *   J dω/dt = M_ел + M_прив.
 * Режими: «вільне обертання» (M_прив = 0) або «привід» (ω = const, привід виконує роботу).
 */
import { C, C2 } from './constants';
import { RK4, stableStep, effectiveL } from './rk4';
import type { EnergyBudget } from './energy';

export interface GeneratorParams {
  B: number;   // Гс
  S: number;   // см²
  N: number;
  R: number;   // с/см (рамка + навантаження)
  L: number;   // см
  J: number;   // г·см²
  driven: boolean;
  omegaDrive: number; // рад/с
}

const PHI = 0, W = 1, I = 2, Q = 3, A = 4;

export class Generator {
  t = 0;
  y = new Float64Array(5);
  private rk = new RK4(5);

  constructor(public p: GeneratorParams, omega0 = 2 * Math.PI) {
    this.reset(omega0);
  }

  reset(omega0: number): void {
    this.t = 0;
    this.y.fill(0);
    this.y[W] = this.p.driven ? this.p.omegaDrive : omega0;
  }

  get T(): number {
    return this.p.L / (C2 * this.p.R);
  }

  /** Індуктивність, з якою реально інтегруємо (0 при надто малій T). */
  get L(): number {
    return effectiveL(this.p.L, this.T);
  }

  private quasiI(phi: number, w: number): number {
    const p = this.p;
    return (p.N * p.B * p.S * w * Math.sin(phi)) / C / p.R;
  }

  current(y = this.y): number {
    return this.L > 0 ? y[I] : this.quasiI(y[PHI], y[W]);
  }

  flux(): number {
    return this.p.N * this.p.B * this.p.S * Math.cos(this.y[PHI]);
  }

  emf(): number {
    const p = this.p;
    return (p.N * p.B * p.S * this.y[W] * Math.sin(this.y[PHI])) / C;
  }

  /** Електромагнітний момент M = −(I/c) N B S sin φ. */
  torque(y = this.y): number {
    const p = this.p;
    return (-this.current(y) * p.N * p.B * p.S * Math.sin(y[PHI])) / C;
  }

  private deriv = (_t: number, y: Float64Array, d: Float64Array): void => {
    const p = this.p;
    const w = p.driven ? p.omegaDrive : y[W];
    const eps = (p.N * p.B * p.S * w * Math.sin(y[PHI])) / C;
    const L = this.L;
    const cur = L > 0 ? y[I] : eps / p.R;
    const M = (-cur * p.N * p.B * p.S * Math.sin(y[PHI])) / C;
    d[PHI] = w;
    d[W] = p.driven ? 0 : M / p.J;
    d[I] = L > 0 ? (C2 / L) * (eps - p.R * cur) : 0;
    d[Q] = cur * cur * p.R;
    d[A] = p.driven ? -M * w : 0;
  };

  step(dt: number): void {
    const wMax = Math.max(Math.abs(this.y[W]), 1);
    const h = stableStep(this.L > 0 ? this.T : 0, Math.min(1e-3, 0.02 / wMax));
    this.t = this.rk.advance(this.deriv, this.t, this.y, dt, h);
  }

  energies(): EnergyBudget {
    const cur = this.current();
    return {
      mech: this.p.driven ? 0 : 0.5 * this.p.J * this.y[W] ** 2,
      mag: (this.L * cur * cur) / (2 * C2),
      heat: this.y[Q],
      ext: this.y[A],
    };
  }
}
