/**
 * Розділ 1. RL-коло з батареєю ε₀ і вимикачем.
 *
 * Рівняння (СГС):  (L/c²) dI/dt + R I = ε(t)      (СІ: L dI/dt + R I = ε).
 * Стала часу:      T = L/(c²R)                   (СІ: T = L/R).
 * Інтегрувальний множник τ(t) = exp(t/T):
 *   (L/c²)(τ İ + τ I/T) = τ ε  ⇒  d(τ I)/dt = τ ε c²/L  ⇒  τ I = I₀ + (ε/R)(τ − 1)
 *   ⇒  I(t) = ε/R + (I₀ − ε/R) e^{−t/T}.
 * При розмиканні вимикача струм замикається через розрядний резистор R_d:
 *   (L/c²) dI/dt + (R + R_d) I = 0.
 */
import { C2 } from './constants';
import { RK4, stableStep } from './rk4';
import type { EnergyBudget } from './energy';

export interface RLParams {
  emf: number; // статВ
  R: number;   // с/см
  Rd: number;  // с/см, розрядний резистор
  L: number;   // см
}

const I = 0, Q = 1, A = 2;

export class RLCircuit {
  t = 0;
  y = new Float64Array(3);
  closed = false;
  /** Момент останнього перемикання та струм у цей момент — для аналітичного розв'язку. */
  tSwitch = 0;
  iSwitch = 0;
  private rk = new RK4(3);

  constructor(public p: RLParams) {}

  reset(): void {
    this.t = 0;
    this.y.fill(0);
    this.closed = false;
    this.tSwitch = 0;
    this.iSwitch = 0;
  }

  setClosed(c: boolean): void {
    if (c === this.closed) return;
    this.closed = c;
    this.tSwitch = this.t;
    this.iSwitch = this.y[I];
  }

  /** Ефективний опір та ЕРС у поточному стані вимикача. */
  private circuit(): { R: number; E: number } {
    return this.closed ? { R: this.p.R, E: this.p.emf } : { R: this.p.R + this.p.Rd, E: 0 };
  }

  /** T = L/(c²R) поточного кола. */
  get T(): number {
    return this.p.L / (C2 * this.circuit().R);
  }

  private deriv = (_t: number, y: Float64Array, d: Float64Array): void => {
    const { R, E } = this.circuit();
    d[I] = (C2 / this.p.L) * (E - R * y[I]);
    d[Q] = R * y[I] * y[I];
    d[A] = E * y[I];
  };

  step(dt: number): void {
    this.t = this.rk.advance(this.deriv, this.t, this.y, dt, stableStep(this.T, 1e-3) * 0.2);
  }

  /** Аналітичний розв'язок через τ(t) = exp((t − t_s)/T): I = ε/R + (I_s − ε/R)/τ. */
  analytic(t = this.t): number {
    const { R, E } = this.circuit();
    const tau = Math.exp((t - this.tSwitch) / this.T);
    return E / R + (this.iSwitch - E / R) / tau;
  }

  /** ЕРС самоіндукції ε_L = −(L/c²) dI/dt = R I − ε. */
  selfEmf(): number {
    const { R, E } = this.circuit();
    return R * this.y[I] - E;
  }

  energies(): EnergyBudget {
    return {
      mech: 0,
      mag: (this.p.L * this.y[I] ** 2) / (2 * C2),
      heat: this.y[Q],
      ext: this.y[A],
    };
  }
}
