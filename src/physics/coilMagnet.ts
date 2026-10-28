/**
 * Розділ 1. Постійний магніт (точковий диполь 𝔪 ∥ +z) рухається вздовж осі котушки.
 *
 * Рівняння (СГС):
 *   Φ(z)            — потік через усі витки, див. solenoidFlux;
 *   ε = −(1/c) dΦ/dt = −(1/c) Φ′(z) v                         (закон Фарадея);
 *   (L/c²) dI/dt = ε − R I                                     (коло з самоіндукцією);
 *   F = (I/c) Φ′(z)                                           (сила на магніт; Fv = −εI);
 *   m dv/dt = F                                               (вільний рух, без тертя).
 * У режимі «привід» рух z(t) заданий, а зовнішня сила −F виконує роботу A = ∫ εI dt.
 */
import { C, C2 } from './constants';
import { RK4, stableStep, effectiveL } from './rk4';
import { solenoidFlux, solenoidFluxDz, solenoidInductance } from './dipole';
import type { EnergyBudget } from './energy';

export interface CoilMagnetParams {
  /** Магнітний момент, ерг/Гс. */
  m: number;
  /** Маса магніту, г. */
  mass: number;
  /** Радіус котушки, см. */
  a: number;
  /** Кількість витків. */
  N: number;
  /** Довжина котушки, см. */
  len: number;
  /** Повний опір кола (котушка + гальванометр), с/см. */
  R: number;
  /** Чи враховувати самоіндукцію котушки. */
  selfInduction: boolean;
}

export type Motion = (t: number) => { z: number; v: number };

// Індекси вектора стану
const Z = 0, V = 1, I = 2, Q = 3, A = 4;

export class CoilMagnet {
  t = 0;
  y = new Float64Array(5);
  /** Якщо задано — рух магніту примусовий (привід або мишка). */
  motion: Motion | null = null;
  private rk = new RK4(5);

  constructor(public p: CoilMagnetParams, z0 = -30, v0 = 0) {
    this.reset(z0, v0);
  }

  reset(z0: number, v0: number): void {
    this.t = 0;
    this.y.fill(0);
    this.y[Z] = z0;
    this.y[V] = v0;
  }

  /** Індуктивність котушки (0, якщо самоіндукцію вимкнено або T < T_MIN). */
  get L(): number {
    if (!this.p.selfInduction) return 0;
    const L = solenoidInductance(this.p.a, this.p.N, this.p.len);
    return effectiveL(L, L / (C2 * this.p.R));
  }

  /** Стала часу T = L/(c²R) (СГС). */
  get T(): number {
    return this.L / (C2 * this.p.R);
  }

  flux(z = this.y[Z]): number {
    return solenoidFlux(this.p.m, this.p.a, this.p.N, this.p.len, z);
  }

  fluxDz(z = this.y[Z]): number {
    return solenoidFluxDz(this.p.m, this.p.a, this.p.N, this.p.len, z);
  }

  /** ЕРС за поточних z, v: ε = −(1/c)Φ′(z)v. */
  emf(z = this.y[Z], v = this.y[V]): number {
    return (-this.fluxDz(z) * v) / C;
  }

  /** Струм у колі: зі станом (якщо L>0) або квазістатичний ε/R. */
  current(): number {
    return this.L > 0 ? this.y[I] : this.emf() / this.p.R;
  }

  /** Сила, що діє на магніт з боку струму котушки: F = (I/c)Φ′(z). */
  force(): number {
    return (this.current() * this.fluxDz()) / C;
  }

  private deriv = (t: number, y: Float64Array, d: Float64Array): void => {
    const p = this.p;
    let z = y[Z], v = y[V];
    if (this.motion) {
      const mv = this.motion(t);
      z = mv.z;
      v = mv.v;
    }
    const dPhi = solenoidFluxDz(p.m, p.a, p.N, p.len, z);
    const eps = (-dPhi * v) / C;
    const L = this.L;
    const cur = L > 0 ? y[I] : eps / p.R;
    const F = (cur * dPhi) / C;
    d[Z] = v;
    d[V] = this.motion ? 0 : F / p.mass;
    d[I] = L > 0 ? (C2 / L) * (eps - p.R * cur) : 0;
    d[Q] = cur * cur * p.R;
    d[A] = this.motion ? -F * v : 0; // робота приводу: F_зовн·v = −F·v
  };

  step(dt: number): void {
    const h = stableStep(this.T, 5e-4);
    this.t = this.rk.advance(this.deriv, this.t, this.y, dt, h);
    if (this.motion) {
      const mv = this.motion(this.t);
      this.y[Z] = mv.z;
      this.y[V] = mv.v;
    }
  }

  energies(): EnergyBudget {
    const cur = this.current();
    return {
      // При примусовому русі інерцію магніту «бере на себе» привід — у балансі лише ЕМ-робота.
      mech: this.motion ? 0 : 0.5 * this.p.mass * this.y[V] ** 2,
      mag: (this.L * cur * cur) / (2 * C2),
      heat: this.y[Q],
      ext: this.y[A],
    };
  }
}
