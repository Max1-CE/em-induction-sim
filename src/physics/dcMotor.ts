// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Розділ 3a. Колекторний двигун (і генератор) постійного струму.
 *
 * k_Φ = N B S — потокозчеплення обмотки якоря (Мкс), f(φ) — колекторна функція (див. нижче).
 * Рівняння (СГС):
 *   (L/c²) dI/dt = U − I(R + R_н) − ε_проти,     ε_проти = (k_Φ/c) ω f(φ)       (СІ: ε = k_Φ ω f);
 *   J dω/dt     = M_ел − M_нав − bω,             M_ел   = (k_Φ/c) I f(φ)       (СІ: M = k_Φ I f).
 * Один і той самий множник k_Φ f/c у проти-ЕРС і в моменті — це гарантує баланс потужностей:
 *   UI = I²(R + R_н) + d/dt(LI²/2c²) + d/dt(Jω²/2) + bω² + M_нав ω.
 * Колекторна функція для n котушок, зсунутих на π/n, з комутацією при sin = 0:
 *   f(φ) = (π/2)·(1/n) Σ_j |sin(φ + πj/n)|   (середнє ≈ 1); «ідеальний» колектор: f ≡ 1.
 * Режим генератора: U = 0, навантаження R_н, а M_нав < 0 — це момент зовнішнього приводу.
 */
import { C, C2 } from './constants';
import { RK4, stableStep, effectiveL } from './rk4';
import type { EnergyBudget } from './energy';

export interface DCMotorParams {
  U: number;      // статВ
  R: number;      // с/см — опір якоря
  Rload: number;  // с/см — опір навантаження (генератор)
  L: number;      // см
  k: number;      // k_Φ = N B S, Мкс
  J: number;      // г·см²
  b: number;      // дин·см·с — в'язке тертя
  Mload: number;  // дин·см (від'ємний — привід)
  coils: number;  // 0 — ідеальний колектор, інакше кількість котушок
}

export function commutator(phi: number, coils: number): number {
  if (coils <= 0) return 1;
  let s = 0;
  for (let j = 0; j < coils; j++) s += Math.abs(Math.sin(phi + (Math.PI * j) / coils));
  return (Math.PI / 2) * (s / coils);
}

const W = 0, PHI = 1, I = 2, Q = 3, A = 4;

export class DCMotor {
  t = 0;
  y = new Float64Array(5);
  private rk = new RK4(5);

  constructor(public p: DCMotorParams) {
    this.reset();
  }

  reset(): void {
    this.t = 0;
    this.y.fill(0);
    this.y[PHI] = 0.3;
  }

  get Rtot(): number {
    return this.p.R + this.p.Rload;
  }

  get L(): number {
    return effectiveL(this.p.L, this.p.L / (C2 * this.Rtot));
  }

  backEmf(y = this.y): number {
    return (this.p.k / C) * y[W] * commutator(y[PHI], this.p.coils);
  }

  current(y = this.y): number {
    return this.L > 0 ? y[I] : (this.p.U - this.backEmf(y)) / this.Rtot;
  }

  /** Електромагнітний момент M = (k_Φ/c) I f(φ). */
  torque(y = this.y): number {
    return (this.p.k / C) * this.current(y) * commutator(y[PHI], this.p.coils);
  }

  private deriv = (_t: number, y: Float64Array, d: Float64Array): void => {
    const p = this.p;
    const f = commutator(y[PHI], p.coils);
    const eps = (p.k / C) * y[W] * f;
    const L = this.L;
    const cur = L > 0 ? y[I] : (p.U - eps) / this.Rtot;
    const M = (p.k / C) * cur * f;
    d[W] = (M - p.Mload - p.b * y[W]) / p.J;
    d[PHI] = y[W];
    d[I] = L > 0 ? (C2 / L) * (p.U - cur * this.Rtot - eps) : 0;
    d[Q] = cur * cur * this.Rtot + p.b * y[W] * y[W];
    d[A] = p.U * cur - p.Mload * y[W];
  };

  step(dt: number): void {
    const w = Math.abs(this.y[W]) + 1;
    const hCap = Math.min(1e-3, 0.03 / w);
    this.t = this.rk.advance(this.deriv, this.t, this.y, dt, stableStep(this.L > 0 ? this.L / (C2 * this.Rtot) : 0, hCap));
  }

  energies(): EnergyBudget {
    const cur = this.current();
    return {
      mech: 0.5 * this.p.J * this.y[W] ** 2,
      mag: (this.L * cur * cur) / (2 * C2),
      heat: this.y[Q],
      ext: this.y[A],
    };
  }

  /** Усталена механічна характеристика ω(M) для ідеального колектора. */
  steadyOmega(M: number): number {
    const { U, k, b } = this.p;
    const R = this.Rtot;
    return (U - (C * R * M) / k) / (k / C + (C * R * b) / k);
  }

  /** Усталений струм при моменті навантаження M. */
  steadyCurrent(M: number): number {
    return (C * (M + this.p.b * this.steadyOmega(M))) / this.p.k;
  }

  /** ККД η = Mω/(UI) в усталеному режимі. */
  efficiency(M: number): number {
    const w = this.steadyOmega(M);
    const P = this.p.U * this.steadyCurrent(M);
    return P > 0 && w > 0 ? (M * w) / P : 0;
  }

  /** Пусковий момент (ω = 0): M_п = k U/(c R). */
  get stallTorque(): number {
    return (this.p.k * this.p.U) / (C * this.Rtot);
  }
}
