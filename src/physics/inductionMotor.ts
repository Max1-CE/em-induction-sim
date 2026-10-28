/**
 * Розділ 3b. Асинхронний двигун: обертове поле трьох котушок і ротор «білкова клітка».
 *
 * Обертове поле: три котушки під кутами 0, 2π/3, 4π/3 зі струмами I_m cos(ω_s t − 2πj/3):
 *   B = Σ_j B_m cos(ω_s t − 2πj/3)·ê_j = (3/2)B_m (cos ω_s t, sin ω_s t) ≡ B₀(cos ω_s t, sin ω_s t).
 * Ротор: N незалежних замкнених рамок (пари стрижнів клітки) площі S, нормалі під кутами θ_r + πk/N.
 *   Φ_k = B₀ S cos(ω_s t − θ_r − α_k),   ε_k = −(1/c)dΦ_k/dt = (B₀S/c)(ω_s − ω_r) sin(ω_s t − θ_r − α_k);
 *   (L/c²) dI_k/dt = ε_k − R I_k;
 *   M = Σ_k (I_k S/c) B₀ sin(ω_s t − θ_r − α_k)   (= Σ 𝔪_k × B);
 *   J dω_r/dt = M − M_нав − bω_r.
 * Баланс: Σ ε_k I_k = M(ω_s − ω_r), тож потужність поля P = Mω_s = Q̇ + Ẇ + Mω_r:
 *   втрати в роторі = s·P,  s = (ω_s − ω_r)/ω_s — ковзання. При s = 0 струмів і моменту немає.
 * Усталений момент (синусоїдальний режим з частотою sω_s):
 *   M(s) = N (B₀S/c)² sω_s R / (2[R² + (sω_s L/c²)²]) = 2M_max/(s/s_k + s_k/s),
 *   s_k = c²R/(ω_s L),  M_max = N(B₀S)²/(4L)          (СІ: s_k = R/(ω_s L), M_max = N(B₀S)²/(4L)).
 */
import { C, C2 } from './constants';
import { RK4 } from './rk4';
import type { EnergyBudget } from './energy';

export interface InductionParams {
  B0: number;   // Гс — амплітуда обертового поля
  fs: number;   // Гц — частота мережі (поля)
  S: number;    // см² — площа рамки ротора
  R: number;    // с/см
  L: number;    // см
  N: number;    // кількість рамок (N/2 пар стрижнів… для N ≥ 2 момент рівномірний)
  J: number;    // г·см²
  b: number;    // дин·см·с
  Mload: number; // дин·см
}

const W = 0, TH = 1, Q = 2, A = 3, NF = 4;

export class InductionMotor {
  t = 0;
  y: Float64Array;
  private rk: RK4;

  constructor(public p: InductionParams) {
    this.y = new Float64Array(NF + p.N);
    this.rk = new RK4(this.y.length);
  }

  reset(): void {
    this.t = 0;
    this.y.fill(0);
  }

  get ws(): number {
    return 2 * Math.PI * this.p.fs;
  }

  /** Кут вектора поля в момент t. */
  fieldAngle(t = this.t): number {
    return this.ws * t;
  }

  slip(): number {
    return (this.ws - this.y[W]) / this.ws;
  }

  private alpha(k: number): number {
    return (Math.PI * k) / this.p.N;
  }

  torqueOf(t: number, y: Float64Array): number {
    const p = this.p;
    let M = 0;
    for (let k = 0; k < p.N; k++) M += ((y[NF + k] * p.S) / C) * p.B0 * Math.sin(this.ws * t - y[TH] - this.alpha(k));
    return M;
  }

  torque(): number {
    return this.torqueOf(this.t, this.y);
  }

  private deriv = (t: number, y: Float64Array, d: Float64Array): void => {
    const p = this.p;
    const slipW = this.ws - y[W];
    let M = 0, P = 0;
    for (let k = 0; k < p.N; k++) {
      const s = Math.sin(this.ws * t - y[TH] - this.alpha(k));
      const eps = ((p.B0 * p.S) / C) * slipW * s;
      const I = y[NF + k];
      d[NF + k] = (C2 / p.L) * (eps - p.R * I);
      M += ((I * p.S) / C) * p.B0 * s;
      P += I * I * p.R;
    }
    d[W] = (M - p.Mload - p.b * y[W]) / p.J;
    d[TH] = y[W];
    d[Q] = P + p.b * y[W] * y[W];
    d[A] = M * this.ws - p.Mload * y[W];
  };

  get T(): number {
    return this.p.L / (C2 * this.p.R);
  }

  step(dt: number): void {
    const h = Math.min(0.5 * this.T, 0.02 / this.ws, 2e-3);
    this.t = this.rk.advance(this.deriv, this.t, this.y, dt, h);
  }

  energies(): EnergyBudget {
    let W2 = 0;
    for (let k = 0; k < this.p.N; k++) W2 += this.y[NF + k] ** 2;
    return {
      mech: 0.5 * this.p.J * this.y[W] ** 2,
      mag: (this.p.L * W2) / (2 * C2),
      heat: this.y[Q],
      ext: this.y[A],
    };
  }

  rotorCurrent(k: number): number {
    return this.y[NF + k];
  }

  /** Аналітичний усталений момент M(s). */
  steadyTorque(s: number): number {
    const p = this.p;
    const x = (s * this.ws * p.L) / C2;
    return (p.N * ((p.B0 * p.S) / C) ** 2 * s * this.ws * p.R) / (2 * (p.R * p.R + x * x));
  }

  /** Критичне ковзання s_k = c²R/(ω_s L). */
  get sCrit(): number {
    return (C2 * this.p.R) / (this.ws * this.p.L);
  }

  get Mmax(): number {
    return (this.p.N * (this.p.B0 * this.p.S) ** 2) / (4 * this.p.L);
  }
}
