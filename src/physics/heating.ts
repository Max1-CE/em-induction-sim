// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Розділ 2d. Нагрів провідної пластини змінним полем (індукційний нагрів, втрати в осерді).
 *
 * Пластина товщини d (x ∈ [−d/2, d/2]), зовнішнє поле B₀ sin ωt паралельне поверхням (уздовж z).
 *
 * 1) Тонка пластина (d ≪ δ), поле проникає повністю. Закон Фарадея для прямокутного контуру
 *    з половиною ширини x: E(x)·2l = −(1/c)Ḃ·2xl ⇒ E = −(x/c)Ḃ, j = σE. Усереднення ⟨cos²⟩ = ½:
 *      P/V = (1/d)∫ σ⟨E²⟩dx = σω²B₀²d²/(24c²) = π²f²B₀²d²σ/(6c²)     (СІ: π²f²B₀²d²σ/6).
 *    Шихтування: n пластин товщини d/n ⇒ P/V зменшується в n² разів.
 *
 * 2) Точний розв'язок (рівняння дифузії поля ∂B/∂t = (c²/4πσ)∂²B/∂x²), комплексна амплітуда:
 *      B̂(x) = B₀ ch(kx)/ch(kd/2),  k = (1+i)/δ,  δ = c/√(2πσω)   (СІ: δ = √(2/(μ₀σω)));
 *      ĵ(x) = −(c/4π) dB̂/dx      (rot B = (4π/c) j для B = B_z(x)ẑ: (rot B)_y = −∂B_z/∂x);
 *      Ê = ĵ/σ.
 *    Баланс (теорема Пойнтінга, на одиницю площі пластини):
 *      потік енергії через обидві поверхні = джоулеве тепло + d/dt ∫B²/8π dx.
 */
import { C, C2 } from './constants';
import { RK4 } from './rk4';
import type { EnergyBudget } from './energy';

/** Мінімальна комплексна арифметика. */
type Cx = [number, number];
const cmul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a: Cx, b: Cx): Cx => {
  const q = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / q, (a[1] * b[0] - a[0] * b[1]) / q];
};
const ccosh = (z: Cx): Cx => [Math.cosh(z[0]) * Math.cos(z[1]), Math.sinh(z[0]) * Math.sin(z[1])];
const csinh = (z: Cx): Cx => [Math.sinh(z[0]) * Math.cos(z[1]), Math.cosh(z[0]) * Math.sin(z[1])];

/** Глибина скін-шару δ = c/√(2πσω) (СГС). */
export function skinDepth(sigma: number, omega: number): number {
  return C / Math.sqrt(2 * Math.PI * sigma * omega);
}

/** Питома потужність втрат у тонкій пластині, ерг/(с·см³): π²f²B₀²d²σ/(6c²). */
export function thinPlatePower(f: number, B0: number, d: number, sigma: number): number {
  return (Math.PI ** 2 * f * f * B0 * B0 * d * d * sigma) / (6 * C2);
}

export class Slab {
  readonly omega: number;
  readonly delta: number;
  private k: Cx;
  private chHalf: Cx;

  constructor(public sigma: number, public f: number, public B0: number, public d: number) {
    this.omega = 2 * Math.PI * f;
    this.delta = skinDepth(sigma, this.omega);
    this.k = [1 / this.delta, 1 / this.delta];
    this.chHalf = ccosh(cmul(this.k, [d / 2, 0]));
  }

  /** Комплексна амплітуда B̂(x). */
  B(x: number): Cx {
    const r = cdiv(ccosh(cmul(this.k, [x, 0])), this.chHalf);
    return [this.B0 * r[0], this.B0 * r[1]];
  }

  /** Комплексна амплітуда ĵ(x) = −(c/4π) B₀ k sh(kx)/ch(kd/2). */
  j(x: number): Cx {
    const r = cdiv(cmul(this.k, csinh(cmul(this.k, [x, 0]))), this.chHalf);
    const s = (-C / (4 * Math.PI)) * this.B0;
    return [s * r[0], s * r[1]];
  }

  /** Миттєві значення: Re[X̂ e^{iωt}]. Поле має фазу sin ωt: беремо Re[X̂ e^{i(ωt−π/2)}]. */
  static at(z: Cx, phase: number): number {
    return z[0] * Math.cos(phase - Math.PI / 2) - z[1] * Math.sin(phase - Math.PI / 2);
  }

  /** Середня за період потужність на одиницю об'єму (точно): (1/d)∫|ĵ|²/(2σ) dx. */
  avgPowerDensity(n = 400): number {
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const x = -this.d / 2 + (this.d * i) / n;
      const jj = this.j(x);
      const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
      s += w * (jj[0] ** 2 + jj[1] ** 2);
    }
    return ((s * this.d) / (3 * n)) / (2 * this.sigma * this.d);
  }

  /** Миттєва потужність тепла на одиницю площі: ∫ j²/σ dx. */
  heatRate(phase: number, n = 120): number {
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const x = -this.d / 2 + (this.d * i) / n;
      const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
      s += w * Slab.at(this.j(x), phase) ** 2;
    }
    return (s * this.d) / (3 * n) / this.sigma;
  }

  /** Магнітна енергія в пластині на одиницю площі: ∫ B²/8π dx. */
  magEnergy(phase: number, n = 120): number {
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const x = -this.d / 2 + (this.d * i) / n;
      const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
      s += w * Slab.at(this.B(x), phase) ** 2;
    }
    return (s * this.d) / (3 * n) / (8 * Math.PI);
  }

  /**
   * Потік Пойнтінга всередину через обидві поверхні (на одиницю площі):
   * S = (c/4π) E×B; при x = +d/2 вектор E_y B_z дає S_x = (c/4π)E_y B_z, усередину — −S_x;
   * при x = −d/2 усередину +S_x. E = j/σ, j напрямлене вздовж y.
   */
  poyntingIn(phase: number): number {
    const flux = (x: number) => (C / (4 * Math.PI)) * (Slab.at(this.j(x), phase) / this.sigma) * Slab.at(this.B(x), phase);
    return -flux(this.d / 2) + flux(-this.d / 2);
  }
}

/** Інтегрування в часі тепла і роботи джерела (через Пойнтінга) — перевірка енергетичного балансу. */
export class SlabHeating {
  t = 0;
  y = new Float64Array(2); // [Q, A] на одиницю площі
  private rk = new RK4(2);
  W0: number;

  constructor(public slab: Slab) {
    this.W0 = slab.magEnergy(0);
  }

  private deriv = (t: number, _y: Float64Array, d: Float64Array): void => {
    const ph = this.slab.omega * t;
    d[0] = this.slab.heatRate(ph);
    d[1] = this.slab.poyntingIn(ph);
  };

  step(dt: number): void {
    this.t = this.rk.advance(this.deriv, this.t, this.y, dt, 1 / (this.slab.f * 40));
  }

  energies(): EnergyBudget {
    return { mech: 0, mag: this.slab.magEnergy(this.slab.omega * this.t) - this.W0, heat: this.y[0], ext: this.y[1] };
  }
}
