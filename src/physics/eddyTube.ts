// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Розділ 2a. Магніт (точковий диполь 𝔪 ∥ +z, маса M) падає в провідній трубі.
 * Труба — набір тонких кілець радіуса a, висоти h, товщини стінки w, центри z_k = (k + ½)h.
 *
 * Для кожного кільця (СГС):
 *   Φ_k(z)  = 2π𝔪a²/(a² + (z − z_k)²)^{3/2}              (потік диполя через кільце);
 *   ε_k     = −(1/c) Φ_k′(z) v                              (закон Фарадея);
 *   R_k     = 2πa/(σ h w)                                   (опір кільця);
 *   без самоіндукції:  I_k = ε_k / R_k;
 *   з самоіндукцією:   (1/c²) Σ_l L_kl dI_l/dt = ε_k − R I_k  (L_kk — власна, L_kl — взаємна індуктивність);
 *   сила на магніт F = Σ (I_k/c) Φ_k′(z);   M dv/dt = −Mg + F.
 * Енергія: ½Mv² + Mgz + Q + (1/2c²) IᵀLI = const.
 *
 * Аналітична гранична швидкість (тонка стінка, неперервна межа h ≪ a, без самоіндукції):
 *   F = −v (σw/(2πa c²)) ∫(Φ′)²dz,  ∫(Φ′)²dz = 45π³𝔪²/(32a³)
 *   ⇒ v_гр = 64 M g c² a⁴ / (45 π² σ w 𝔪²)                (СІ: 1024 M g a⁴ / (45 μ₀² σ w 𝔪²)).
 */
import { C, C2, G } from './constants';
import { RK4 } from './rk4';
import { loopFlux, loopFluxDz, mutualCoaxial, ringSelfInductance } from './dipole';
import type { EnergyBudget } from './energy';

export interface TubeParams {
  sigma: number;   // с⁻¹
  w: number;       // товщина стінки, см
  a: number;       // середній радіус стінки, см
  m: number;       // магнітний момент, ерг/Гс
  mass: number;    // г
  h: number;       // висота кільця (крок дискретизації), см
  length: number;  // довжина труби, см
  selfInduction: boolean;
}

/** Аналітична гранична швидкість (СГС), див. коментар до модуля. */
export function terminalVelocity(p: Pick<TubeParams, 'sigma' | 'w' | 'a' | 'm' | 'mass'>): number {
  return (64 * p.mass * G * C2 * p.a ** 4) / (45 * Math.PI ** 2 * p.sigma * p.w * p.m ** 2);
}

/** Коефіцієнт в'язкого тертя k (F = −k v) у неперервній межі. */
export function dragCoefficient(p: Pick<TubeParams, 'sigma' | 'w' | 'a' | 'm'>): number {
  return (45 * Math.PI ** 2 * p.sigma * p.w * p.m ** 2) / (64 * C2 * p.a ** 4);
}

const Z = 0, V = 1, Q = 2, NFIX = 3;

/** Розв'язання Холецького: повертає обернену матрицю (n×n, по рядках) або null, якщо не додатно визначена. */
function invertSPD(A: Float64Array, n: number): Float64Array | null {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      if (i === j) {
        if (s <= 0) return null;
        L[i * n + i] = Math.sqrt(s);
      } else L[i * n + j] = s / L[j * n + j];
    }
  }
  const inv = new Float64Array(n * n);
  const col = new Float64Array(n);
  for (let c = 0; c < n; c++) {
    // L y = e_c, Lᵀ x = y
    for (let i = 0; i < n; i++) {
      let s = i === c ? 1 : 0;
      for (let k = 0; k < i; k++) s -= L[i * n + k] * col[k];
      col[i] = s / L[i * n + i];
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = col[i];
      for (let k = i + 1; k < n; k++) s -= L[k * n + i] * col[k];
      col[i] = s / L[i * n + i];
    }
    for (let i = 0; i < n; i++) inv[i * n + c] = col[i];
  }
  return inv;
}

export class EddyTube {
  t = 0;
  y: Float64Array;
  /** Магніт вилетів із нижнього кінця й зупинився на «підлозі» — моделювання заморожене. */
  landed = false;
  /** Кількість кілець у ковзному вікні навколо магніту. */
  readonly nW: number;
  /** Індекс першого кільця вікна. */
  k0 = 0;
  readonly nRings: number;
  readonly Rring: number;
  /** Рядок Тепліцевої матриці індуктивностей: L(|j−l|). */
  private Lrow: Float64Array;
  /** Чи вдалося обернути матрицю L (вона має бути додатно визначеною). */
  lMatrixOk = true;
  private invCache = new Map<number, Float64Array | null>();
  private rk: RK4;
  /** Найменша стала часу системи кілець (для вибору кроку RK4). */
  Tmin = 0;
  readonly floorZ: number;

  constructor(public p: TubeParams, z0?: number, v0 = 0) {
    this.nRings = Math.max(1, Math.round(p.length / p.h));
    this.Rring = (2 * Math.PI * p.a) / (p.sigma * p.h * p.w);
    const half = Math.ceil((p.selfInduction ? 6 : 10) * p.a / p.h);
    this.nW = 2 * half + 1;
    this.y = new Float64Array(NFIX + (p.selfInduction ? this.nW : 0));
    this.rk = new RK4(this.y.length);
    this.Lrow = new Float64Array(this.nW);
    this.floorZ = -3 * p.a;
    if (p.selfInduction) {
      const g2 = (0.2235 * (p.h + p.w)) ** 2;
      this.Lrow[0] = ringSelfInductance(p.a, p.h, p.w);
      // взаємна індуктивність ниткових кілець; відстань «згладжена» d_eff = √(d² + g²),
      // щоб сусідні кільця скінченного перерізу не давали M > L (див. припущення у теорії)
      for (let d = 1; d < this.nW; d++) this.Lrow[d] = mutualCoaxial(p.a, p.a, Math.sqrt((d * p.h) ** 2 + g2));
      const inv = this.inverse(this.nW);
      this.lMatrixOk = inv !== null;
      if (inv) this.Tmin = this.minTimeConstant(inv, this.nW);
    }
    this.reset(z0 ?? p.length + 2 * p.a, v0);
  }

  reset(z0: number, v0: number): void {
    this.t = 0;
    this.y.fill(0);
    this.y[Z] = z0;
    this.y[V] = v0;
    this.landed = false;
    this.k0 = this.windowStart(z0);
  }

  zRing(k: number): number {
    return (k + 0.5) * this.p.h;
  }

  private windowStart(z: number): number {
    return Math.round(z / this.p.h - 0.5) - (this.nW - 1) / 2;
  }

  /** Обернена до лівого верхнього блоку n×n Тепліцевої матриці L (кешується за n). */
  private inverse(n: number): Float64Array | null {
    if (!this.invCache.has(n)) {
      const A = new Float64Array(n * n);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) A[i * n + j] = this.Lrow[Math.abs(i - j)];
      this.invCache.set(n, invertSPD(A, n));
    }
    return this.invCache.get(n)!;
  }

  /** λ_max(L⁻¹) степеневим методом ⇒ T_min = λ_min(L)/(c²R). */
  private minTimeConstant(inv: Float64Array, n: number): number {
    let x = new Float64Array(n).map((_, i) => (i % 2 ? -1 : 1));
    let mu = 0;
    for (let it = 0; it < 200; it++) {
      const yv = new Float64Array(n);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) yv[i] += inv[i * n + j] * x[j];
      const nrm = Math.hypot(...yv);
      mu = nrm / Math.hypot(...x);
      x = yv.map((v) => v / nrm);
    }
    return 1 / mu / (C2 * this.Rring);
  }

  /** Діапазон дійсних (існуючих у трубі) індексів вікна [j0, j1). */
  private validRange(): [number, number] {
    const j0 = Math.max(0, -this.k0);
    const j1 = Math.min(this.nW, this.nRings - this.k0);
    return [j0, Math.max(j0, j1)];
  }

  private eps = new Float64Array(0);
  private cur = new Float64Array(0);

  private deriv = (_t: number, y: Float64Array, d: Float64Array): void => {
    const p = this.p;
    const z = y[Z], v = y[V];
    const n = this.nW;
    if (this.eps.length !== n) {
      this.eps = new Float64Array(n);
      this.cur = new Float64Array(n);
    }
    const [j0, j1] = this.validRange();
    let F = 0, P = 0;
    const R = this.Rring;
    for (let j = j0; j < j1; j++) {
      const dPhi = loopFluxDz(p.m, p.a, z - this.zRing(this.k0 + j));
      this.eps[j] = (-dPhi * v) / C;
      const I = p.selfInduction ? y[NFIX + j] : this.eps[j] / R;
      this.cur[j] = I;
      F += (I * dPhi) / C;
      P += I * I * R;
    }
    d[Z] = v;
    d[V] = -G + F / p.mass;
    d[Q] = P;
    if (p.selfInduction) {
      for (let j = 0; j < n; j++) d[NFIX + j] = 0;
      const m = j1 - j0;
      const inv = this.inverse(m);
      if (inv) {
        for (let i = 0; i < m; i++) {
          let s = 0;
          for (let k = 0; k < m; k++) {
            const jj = j0 + k;
            s += inv[i * m + k] * (this.eps[jj] - R * this.cur[jj]);
          }
          d[NFIX + j0 + i] = C2 * s;
        }
      }
    }
  };

  /** Зсув вікна кілець, коли магніт переміщується більш ніж на одне кільце. */
  private shiftWindow(): void {
    const target = this.windowStart(this.y[Z]);
    if (target === this.k0) return;
    if (this.p.selfInduction) {
      const W0 = this.magEnergy();
      const n = this.nW;
      const s = target - this.k0;
      const old = this.y.slice(NFIX);
      for (let j = 0; j < n; j++) {
        const src = j + s;
        this.y[NFIX + j] = src >= 0 && src < n ? old[src] : 0;
      }
      this.k0 = target;
      // струми кілець, що вийшли з вікна, далеко від магніту й малі; їхню енергію зараховуємо в тепло
      this.y[Q] += W0 - this.magEnergy();
    } else this.k0 = target;
  }

  /** Крок RK4 з урахуванням стійкості (T_min) і зсуву вікна. */
  step(dt: number): void {
    if (this.landed || dt <= 0) return;
    let left = dt;
    while (left > 0) {
      const vabs = Math.abs(this.y[V]) + 1e-9;
      const chunk = Math.min(left, (0.5 * this.p.h) / vabs);
      let hMax = Math.min(1e-3, (0.1 * this.p.a) / vabs);
      if (this.p.selfInduction && this.Tmin > 0) hMax = Math.min(hMax, 0.5 * this.Tmin);
      this.t = this.rk.advance(this.deriv, this.t, this.y, chunk, hMax);
      left -= chunk;
      this.shiftWindow();
      if (this.y[Z] < this.floorZ) {
        this.landed = true;
        break;
      }
    }
  }

  /** Струм кільця з індексом k (0, якщо поза вікном). */
  ringCurrent(k: number): number {
    const j = k - this.k0;
    if (j < 0 || j >= this.nW || k < 0 || k >= this.nRings) return 0;
    if (this.p.selfInduction) return this.y[NFIX + j];
    const dPhi = loopFluxDz(this.p.m, this.p.a, this.y[Z] - this.zRing(k));
    return (-dPhi * this.y[V]) / C / this.Rring;
  }

  /** Сумарна сила кілець на магніт. */
  force(): number {
    let F = 0;
    for (let j = 0; j < this.nW; j++) {
      const k = this.k0 + j;
      if (k < 0 || k >= this.nRings) continue;
      F += (this.ringCurrent(k) * loopFluxDz(this.p.m, this.p.a, this.y[Z] - this.zRing(k))) / C;
    }
    return F;
  }

  heatPower(): number {
    let P = 0;
    for (let j = 0; j < this.nW; j++) P += this.ringCurrent(this.k0 + j) ** 2 * this.Rring;
    return P;
  }

  magEnergy(): number {
    if (!this.p.selfInduction) return 0;
    const n = this.nW;
    let W = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) W += this.y[NFIX + i] * this.Lrow[Math.abs(i - j)] * this.y[NFIX + j];
    return W / (2 * C2);
  }

  /** Потік через кільце k (для візуалізації). */
  ringFlux(k: number): number {
    return loopFlux(this.p.m, this.p.a, this.y[Z] - this.zRing(k));
  }

  energies(): EnergyBudget {
    return {
      mech: 0.5 * this.p.mass * this.y[V] ** 2 + this.p.mass * G * this.y[Z],
      mag: this.magEnergy(),
      heat: this.y[Q],
      ext: 0,
    };
  }
}

/** Вільне падіння в пластиковій трубі (σ = 0) — для порівняння. */
export class FreeFall {
  t = 0;
  z = 0;
  v = 0;
  landed = false;
  constructor(public z0: number, public floorZ: number) {
    this.reset();
  }
  reset(): void {
    this.t = 0;
    this.z = this.z0;
    this.v = 0;
    this.landed = false;
  }
  step(dt: number): void {
    if (this.landed) return;
    this.t += dt;
    this.z -= this.v * dt + 0.5 * G * dt * dt;
    this.v += G * dt;
    if (this.z < this.floorZ) this.landed = true;
  }
}
