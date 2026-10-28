/**
 * Фізичні константи та властивості матеріалів.
 * УСІ величини — у гаусовій системі СГС (см, г, с, статА, Гс, Мкс, ерг…).
 * Переведення в СІ виконується лише на виводі (див. units.ts).
 */

/** Швидкість світла, см/с (точне значення). */
export const C = 2.99792458e10;
/** C², см²/с² — зустрічається у кожній формулі з L/c² та c²R. */
export const C2 = C * C;
/** Прискорення вільного падіння, см/с². */
export const G = 980.665;
/** Магнітна стала СІ, Гн/м (потрібна лише для показу формул СІ та тестів). */
export const MU0_SI = 4e-7 * Math.PI;

/**
 * Переведення провідності: σ[с⁻¹] = σ[См/м] · c²·10⁻¹¹.
 * Виводиться з 1 Ом = 10⁹/c² с/см і 1 м = 100 см.
 */
export const SIEMENS_PER_M_TO_CGS = C2 * 1e-11;

export interface Material {
  id: string;
  name: string;
  /** Питома провідність, с⁻¹ (СГС). */
  sigma: number;
  /** Густина, г/см³. */
  rho: number;
  /** Питома теплоємність, ерг/(г·К). */
  cp: number;
}

const mat = (id: string, name: string, sigmaSI: number, rho: number, cpSI: number): Material => ({
  id,
  name,
  sigma: sigmaSI * SIEMENS_PER_M_TO_CGS,
  rho,
  cp: cpSI * 1e4, // Дж/(кг·К) → ерг/(г·К): 10⁷ ерг / 10³ г
});

/** Таблиця провідних матеріалів (σ при 20 °C). */
export const MATERIALS: Material[] = [
  mat('cu', 'Мідь', 5.96e7, 8.96, 385),
  mat('al', 'Алюміній', 3.77e7, 2.70, 897),
  mat('brass', 'Латунь', 1.5e7, 8.5, 380),
  mat('steel', 'Нержавіюча сталь', 1.45e6, 7.9, 500),
  mat('graphite', 'Графіт', 1.0e5, 2.2, 710),
  mat('plastic', 'Пластик (ізолятор)', 0, 1.2, 1500),
];

export const materialById = (id: string): Material =>
  MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];

/** Густина магніту NdFeB, г/см³. */
export const RHO_NDFEB = 7.5;
/** Типова намагніченість NdFeB, ерг/(Гс·см³): M = B_r/4π ≈ 12.5 кГс / 4π. */
export const MAGNETIZATION_NDFEB = 1.0e3;
