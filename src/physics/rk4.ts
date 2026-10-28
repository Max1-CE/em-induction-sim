/**
 * Класичний метод Рунге–Кутти 4-го порядку з фіксованим кроком:
 *   k₁ = f(t, y), k₂ = f(t+h/2, y+h k₁/2), k₃ = f(t+h/2, y+h k₂/2), k₄ = f(t+h, y+h k₃),
 *   y(t+h) = y + h(k₁ + 2k₂ + 2k₃ + k₄)/6.
 * Якщо крок анімації dt більший за допустимий h_max, він розбивається на n = ⌈dt/h_max⌉ підкроків.
 */
export type Deriv = (t: number, y: Float64Array, dydt: Float64Array) => void;

export class RK4 {
  private k1: Float64Array;
  private k2: Float64Array;
  private k3: Float64Array;
  private k4: Float64Array;
  private tmp: Float64Array;

  constructor(public readonly n: number) {
    this.k1 = new Float64Array(n);
    this.k2 = new Float64Array(n);
    this.k3 = new Float64Array(n);
    this.k4 = new Float64Array(n);
    this.tmp = new Float64Array(n);
  }

  /** Один крок h; y змінюється на місці. */
  step(f: Deriv, t: number, y: Float64Array, h: number): void {
    const { k1, k2, k3, k4, tmp, n } = this;
    f(t, y, k1);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k1[i];
    f(t + 0.5 * h, tmp, k2);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k2[i];
    f(t + 0.5 * h, tmp, k3);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
    f(t + h, tmp, k4);
    for (let i = 0; i < n; i++) y[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }

  /** Інтегрування на інтервалі dt рівними підкроками ≤ hMax. Повертає новий час. */
  advance(f: Deriv, t: number, y: Float64Array, dt: number, hMax: number, maxSub = 200000): number {
    if (dt <= 0) return t;
    const nSub = Math.min(maxSub, Math.max(1, Math.ceil(dt / hMax)));
    const h = dt / nSub;
    for (let s = 0; s < nSub; s++) {
      this.step(f, t, y, h);
      t += h;
    }
    return t;
  }
}

/**
 * Безпечний крок для RL-кола: RK4 стійкий при h·(1/T) < 2.78; беремо h ≤ T/2,
 * а також не більше h_cap для точності механічної частини.
 */
/**
 * Мінімальна стала часу, яку ще інтегруємо явно. Якщо T = L/(c²R) менша, індуктивністю нехтуємо
 * (квазістатика I = ε/R) — похибка відносно O(T/t_мех), а явний RK4 був би надто дорогим.
 */
export const T_MIN = 2e-5;

/** Ефективна індуктивність: L, якщо T ≥ T_MIN, інакше 0. */
export function effectiveL(L: number, T: number): number {
  return T >= T_MIN ? L : 0;
}

export function stableStep(T: number, hCap: number): number {
  return Math.min(hCap, T > 0 ? 0.5 * T : hCap);
}
