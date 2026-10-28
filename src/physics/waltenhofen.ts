/**
 * Розділ 2b. Маятник Вальтенгофена: провідна пластина гойдається між полюсами електромагніта.
 *
 * Геометрія (система пластини, вісь підвісу в початку координат, пластина нижче осі):
 *   пластина: u ∈ [−b/2, b/2], v ∈ [−ℓ − c/2, −ℓ + c/2], товщина d; «гребінка» — вертикальні прорізи знизу.
 * Поле полюсів нерухоме в лабораторії: квадрат зі стороною 2s, центр у (0, −ℓ), м'які краї (tanh).
 *
 * Твердотільне обертання: v = θ̇ ẑ × r  ⇒  f = (1/c) v×B = (θ̇/c) B(r)·r  (радіальна!).
 *   ∇²ψ = −σ (rot f)_z,   (rot f)_z = (θ̇/c)(v ∂B/∂u − u ∂B/∂v)   (у координатах пластини).
 * Ключове спрощення: j лінійне за θ̇, тож ψ = θ̇·Ψ(θ). Для набору кутів θ один раз розв'язуємо Пуассона
 * і зберігаємо K(θ) = P/θ̇² = (d/σ)∫|∇Ψ|²dA. Тоді динаміка маятника
 *   J θ̈ = −M g l sin θ − K(θ) θ̇,   Q̇ = K(θ) θ̇²,
 * і енергія ½Jθ̇² + Mgl(1 − cos θ) + Q зберігається з точністю RK4.
 * Нехтуємо: самоіндукцією вихрових струмів (мале магнітне число Рейнольдса), полем поза зазором.
 */
import { C, G } from './constants';
import { RK4 } from './rk4';
import { solvePoisson, dirichletEnergy, type Grid } from './streamSolver';
import type { EnergyBudget } from './energy';

export interface PendulumParams {
  sigma: number;   // с⁻¹
  rho: number;     // г/см³
  d: number;       // товщина, см
  b: number;       // ширина пластини, см
  c: number;       // висота пластини, см
  arm: number;     // ℓ — відстань від осі до центру пластини, см
  B0: number;      // Гс
  pole: number;    // половина сторони полюса s, см
  slots: number;   // кількість прорізів (0 — суцільна)
  slotWidth: number; // см
  slotDepth: number; // частка висоти
}

/** Поле в лабораторії: B0·S(x)·S(y + ℓ), S — «сходинка» з м'якими краями ширини δ. */
export function poleField(p: PendulumParams, x: number, y: number): number {
  const del = 0.25;
  const S = (s: number) => 0.5 * (Math.tanh((s + p.pole) / del) - Math.tanh((s - p.pole) / del));
  return p.B0 * S(x) * S(y + p.arm);
}

export class PlateModel {
  grid: Grid;
  /** Координати центрів комірок у системі пластини. */
  u0: number;
  v0: number;
  mass = 0;
  /** Момент інерції відносно осі, г·см². */
  J = 0;
  /** Відстань від осі до центру мас, см. */
  lcm = 0;
  /** Таблиця кутів і коефіцієнтів K(θ), г·см²/с. */
  thetas: Float64Array;
  K: Float64Array;
  /** Ψ(θ) для візуалізації (при θ̇ = 1). */
  psis: Float64Array[] = [];

  constructor(public p: PendulumParams, nTheta = 61, thetaMax = 1.0) {
    const h = Math.min(p.b, p.c) / 40;
    const nx = Math.round(p.b / h), ny = Math.round(p.c / h);
    const mask = new Uint8Array(nx * ny).fill(1);
    this.u0 = -p.b / 2 + h / 2;
    this.v0 = -p.arm - p.c / 2 + h / 2;
    // прорізи: рівномірно по ширині, від нижнього краю
    if (p.slots > 0) {
      const sw = Math.max(1, Math.round(p.slotWidth / h));
      const depth = Math.round(p.slotDepth * ny);
      for (let s = 0; s < p.slots; s++) {
        const ic = Math.round(((s + 1) / (p.slots + 1)) * nx);
        for (let i = ic - Math.floor(sw / 2); i < ic - Math.floor(sw / 2) + sw; i++)
          for (let j = 0; j < depth; j++) if (i >= 0 && i < nx) mask[j * nx + i] = 0;
      }
    }
    this.grid = { nx, ny, h, mask };
    // маса, момент інерції, центр мас
    const dm = p.rho * p.d * h * h;
    let sv = 0;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        if (!mask[j * nx + i]) continue;
        const u = this.u0 + i * h, v = this.v0 + j * h;
        this.mass += dm;
        this.J += dm * (u * u + v * v);
        sv += dm * v;
      }
    this.lcm = -sv / this.mass;
    // таблиця K(θ)
    this.thetas = new Float64Array(nTheta);
    this.K = new Float64Array(nTheta);
    for (let t = 0; t < nTheta; t++) {
      const th = -thetaMax + (2 * thetaMax * t) / (nTheta - 1);
      this.thetas[t] = th;
      const psi = this.solve(th);
      this.psis.push(psi);
      this.K[t] = (p.d / p.sigma) * dirichletEnergy(this.grid, psi);
    }
  }

  /** Поле в точці пластини (u, v) при куті θ: B_lab(Rot(θ)(u, v)). */
  fieldAt(th: number, u: number, v: number): number {
    const cs = Math.cos(th), sn = Math.sin(th);
    return poleField(this.p, u * cs - v * sn, u * sn + v * cs);
  }

  /** Ψ при θ̇ = 1: −ΔΨ = σ(rot f)_z, (rot f)_z = (1/c)(v ∂B/∂u − u ∂B/∂v). */
  private solve(th: number): Float64Array {
    const { nx, ny, h } = this.grid;
    const rhs = new Float64Array(nx * ny);
    const e = h * 0.5;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const u = this.u0 + i * h, v = this.v0 + j * h;
        const dBu = (this.fieldAt(th, u + e, v) - this.fieldAt(th, u - e, v)) / (2 * e);
        const dBv = (this.fieldAt(th, u, v + e) - this.fieldAt(th, u, v - e)) / (2 * e);
        rhs[j * nx + i] = (this.p.sigma / C) * (v * dBu - u * dBv);
      }
    return solvePoisson(this.grid, rhs);
  }

  /** Лінійна інтерполяція K(θ); поза таблицею — крайове значення (пластина вже поза полем). */
  Kat(th: number): number {
    const n = this.thetas.length;
    const t0 = this.thetas[0], t1 = this.thetas[n - 1];
    if (th <= t0) return this.K[0];
    if (th >= t1) return this.K[n - 1];
    const x = ((th - t0) / (t1 - t0)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(x));
    const f = x - i;
    return this.K[i] * (1 - f) + this.K[i + 1] * f;
  }

  /** Найближче Ψ(θ) з таблиці. */
  psiAt(th: number): Float64Array {
    const n = this.thetas.length;
    const t0 = this.thetas[0], t1 = this.thetas[n - 1];
    const i = Math.max(0, Math.min(n - 1, Math.round(((th - t0) / (t1 - t0)) * (n - 1))));
    return this.psis[i];
  }
}

const TH = 0, W = 1, Q = 2;

export class Pendulum {
  t = 0;
  y = new Float64Array(3);
  private rk = new RK4(3);

  constructor(public plate: PlateModel, public theta0 = 0.6) {
    this.reset();
  }

  reset(): void {
    this.t = 0;
    this.y.fill(0);
    this.y[TH] = this.theta0;
  }

  private deriv = (_t: number, y: Float64Array, d: Float64Array): void => {
    const pl = this.plate;
    const K = pl.Kat(y[TH]);
    d[TH] = y[W];
    d[W] = (-pl.mass * G * pl.lcm * Math.sin(y[TH]) - K * y[W]) / pl.J;
    d[Q] = K * y[W] * y[W];
  };

  step(dt: number): void {
    this.t = this.rk.advance(this.deriv, this.t, this.y, dt, 1e-3);
  }

  /** Гальмівний момент −K(θ)θ̇. */
  torque(): number {
    return -this.plate.Kat(this.y[TH]) * this.y[W];
  }

  heatPower(): number {
    return this.plate.Kat(this.y[TH]) * this.y[W] ** 2;
  }

  energies(): EnergyBudget {
    const pl = this.plate;
    return {
      mech: 0.5 * pl.J * this.y[W] ** 2 + pl.mass * G * pl.lcm * (1 - Math.cos(this.y[TH])),
      mag: 0,
      heat: this.y[Q],
      ext: 0,
    };
  }
}
