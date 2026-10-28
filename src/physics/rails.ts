/**
 * Розділ 1. Провідник довжини l ковзає по рейках у полі B (B ⟂ площини рейок), коло замкнене опором R.
 * x — положення стрижня, площа контуру lx.
 *
 *   Φ = B l x;   ε = −(1/c) dΦ/dt = −(1/c) B l v                (СГС; СІ: ε = −Blv);
 *   (L/c²) dI/dt = ε − R I;
 *   F = (I/c) B l    (сила Ампера на стрижень, Fv = −εI);
 *   m dv/dt = F + F_зовн.
 * «Анти-Ленц» (лише для демонстрації): знак ЕРС навпаки, ε = +(1/c)Blv, тоді стрижень
 * розганяється сам — енергія зростає з нічого, що порушує закон збереження.
 */
import { C, C2 } from './constants';
import { RK4, stableStep, effectiveL } from './rk4';
import type { EnergyBudget } from './energy';

export interface RailsParams {
  B: number;    // Гс
  l: number;    // см
  m: number;    // г
  R: number;    // с/см
  L: number;    // см
  Fext: number; // дин
  antiLenz: boolean;
}

const X = 0, V = 1, I = 2, Q = 3, A = 4;

export class Rails {
  t = 0;
  y = new Float64Array(5);
  private rk = new RK4(5);

  constructor(public p: RailsParams, v0 = 50) {
    this.reset(v0);
  }

  reset(v0: number): void {
    this.t = 0;
    this.y.fill(0);
    this.y[X] = 10;
    this.y[V] = v0;
  }

  get T(): number {
    return this.L / (C2 * this.p.R);
  }

  get L(): number {
    return effectiveL(this.p.L, this.p.L / (C2 * this.p.R));
  }

  emf(v = this.y[V]): number {
    const s = this.p.antiLenz ? 1 : -1;
    return (s * this.p.B * this.p.l * v) / C;
  }

  current(y = this.y): number {
    return this.L > 0 ? y[I] : this.emf(y[V]) / this.p.R;
  }

  /** Сила Ампера F = (I/c) B l. */
  force(y = this.y): number {
    return (this.current(y) * this.p.B * this.p.l) / C;
  }

  flux(): number {
    return this.p.B * this.p.l * this.y[X];
  }

  private deriv = (_t: number, y: Float64Array, d: Float64Array): void => {
    const p = this.p;
    const eps = this.emf(y[V]);
    const L = this.L;
    const cur = L > 0 ? y[I] : eps / p.R;
    const F = (cur * p.B * p.l) / C;
    d[X] = y[V];
    d[V] = (F + p.Fext) / p.m;
    d[I] = L > 0 ? (C2 / L) * (eps - p.R * cur) : 0;
    d[Q] = cur * cur * p.R;
    d[A] = p.Fext * y[V];
  };

  step(dt: number): void {
    const h = stableStep(this.T, 1e-3);
    this.t = this.rk.advance(this.deriv, this.t, this.y, dt, h);
  }

  energies(): EnergyBudget {
    const cur = this.current();
    return {
      mech: 0.5 * this.p.m * this.y[V] ** 2,
      mag: (this.L * cur * cur) / (2 * C2),
      heat: this.y[Q],
      ext: this.y[A],
    };
  }
}
