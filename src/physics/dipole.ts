// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Поле точкового магнітного диполя та потоки через кільця/котушки (СГС).
 * Диполь 𝔪 напрямлений уздовж +z; кільце радіуса a — співвісне, нормаль +z.
 */

/**
 * Поле диполя в меридіанній площині (ρ, z):
 *   B = [3(𝔪·r̂)r̂ − 𝔪]/r³   (СГС),   B = (μ₀/4π)[3(𝔪·r̂)r̂ − 𝔪]/r³ (СІ).
 * Повертає [B_ρ, B_z].
 */
export function dipoleField(m: number, rho: number, z: number): [number, number] {
  const r2 = rho * rho + z * z;
  if (r2 < 1e-12) return [0, 0];
  const r = Math.sqrt(r2);
  const r5 = r2 * r2 * r;
  return [(3 * m * rho * z) / r5, (m * (3 * z * z - r2)) / r5];
}

/**
 * Потік поля диполя через кільце радіуса a на осьовій відстані z:
 *   Φ(z) = 2π𝔪 a² / (a² + z²)^{3/2}.
 * (Виводиться через векторний потенціал A_φ = 𝔪 sinθ / r²: Φ = 2πa·A_φ.)
 */
export function loopFlux(m: number, a: number, z: number): number {
  const s = a * a + z * z;
  return (2 * Math.PI * m * a * a) / (s * Math.sqrt(s));
}

/** dΦ/dz = −6π𝔪 a² z / (a² + z²)^{5/2}. */
export function loopFluxDz(m: number, a: number, z: number): number {
  const s = a * a + z * z;
  return (-6 * Math.PI * m * a * a * z) / (s * s * Math.sqrt(s));
}

/**
 * Котушка з N витків, рівномірно намотаних на довжині ℓ (неперервна густина n = N/ℓ).
 * z — координата магніту відносно центру котушки.
 *   Φ = 2π𝔪 (N/ℓ) [ u/√(a²+u²) ]_{u = z−ℓ/2}^{u = z+ℓ/2},
 * бо ∫ a² du / (a²+u²)^{3/2} = u/√(a²+u²).
 */
export function solenoidFlux(m: number, a: number, N: number, len: number, z: number): number {
  const f = (u: number) => u / Math.sqrt(a * a + u * u);
  return ((2 * Math.PI * m * N) / len) * (f(z + len / 2) - f(z - len / 2));
}

/** dΦ/dz котушки: 2π𝔪 (N/ℓ) [g(z+ℓ/2) − g(z−ℓ/2)], g(u) = a²/(a²+u²)^{3/2}. */
export function solenoidFluxDz(m: number, a: number, N: number, len: number, z: number): number {
  const g = (u: number) => {
    const s = a * a + u * u;
    return (a * a) / (s * Math.sqrt(s));
  };
  return ((2 * Math.PI * m * N) / len) * (g(z + len / 2) - g(z - len / 2));
}

/**
 * Індуктивність котушки (СГС, см): L = 4π²N²a²/ℓ · K_N, де K_N ≈ 1/(1 + 0.9a/ℓ) —
 * наближення Віллера коефіцієнта Нагаоки для короткої котушки.
 */
export function solenoidInductance(a: number, N: number, len: number): number {
  return ((4 * Math.PI * Math.PI * N * N * a * a) / len) / (1 + (0.9 * a) / len);
}

/** Повні еліптичні інтеграли K(k), E(k) методом арифметико-геометричного середнього. */
export function ellipKE(k: number): [number, number] {
  let a = 1;
  let b = Math.sqrt(1 - k * k);
  let sum = (k * k) / 2;
  let pow = 0.5;
  for (let i = 0; i < 30; i++) {
    const an = (a + b) / 2;
    const bn = Math.sqrt(a * b);
    const cn = (a - b) / 2;
    pow *= 2;
    sum += pow * cn * cn;
    a = an;
    b = bn;
    if (Math.abs(cn) < 1e-15) break;
  }
  const K = Math.PI / (2 * a);
  return [K, K * (1 - sum)];
}

/**
 * Взаємна індуктивність двох співвісних кілець радіусів a, b на відстані d (СГС, см):
 *   M = 4π√(ab) [ (2/k − k) K(k) − (2/k) E(k) ],  k² = 4ab / ((a+b)² + d²).
 */
export function mutualCoaxial(a: number, b: number, d: number): number {
  const k = Math.sqrt((4 * a * b) / ((a + b) ** 2 + d * d));
  const [K, E] = ellipKE(Math.min(k, 1 - 1e-12));
  return 4 * Math.PI * Math.sqrt(a * b) * ((2 / k - k) * K - (2 / k) * E);
}

/**
 * Власна індуктивність кільця радіуса a з дроту/стрічки (СГС, см):
 *   L = 4πa [ ln(8a/g) − 2 ],
 * де g — середньогеометрична відстань перерізу від самого себе; для прямокутника h×w g ≈ 0.2235(h+w).
 * (Для круглого дроту радіуса b g = b·e^{−1/4}, і формула дає відоме L = 4πa[ln(8a/b) − 7/4].)
 */
export function ringSelfInductance(a: number, h: number, w: number): number {
  const g = 0.2235 * (h + w);
  return 4 * Math.PI * a * (Math.log((8 * a) / g) - 2);
}
