/**
 * Системи одиниць: гаусова СГС (внутрішня) ↔ СІ (лише для виводу).
 * Для кожної розмірності зберігаємо множник k: x_СІ = k · x_СГС.
 */
import { C } from './constants';

export type UnitSystem = 'CGS' | 'SI';

export type Dim =
  | 'none' | 'time' | 'freq' | 'angle' | 'omega' | 'length' | 'area' | 'mass'
  | 'velocity' | 'accel' | 'force' | 'energy' | 'power' | 'torque' | 'inertia'
  | 'B' | 'flux' | 'current' | 'charge' | 'voltage' | 'efield' | 'resistance'
  | 'inductance' | 'conductivity' | 'moment' | 'jdensity' | 'powerDensity'
  | 'temperature' | 'damping' | 'angDamping' | 'percent';

interface DimInfo {
  /** x_СІ = factor · x_СГС */
  factor: number;
  cgs: string;
  si: string;
}

/**
 * Множники переведення (точні, через c):
 *  1 А = c/10 статА, 1 В = 10⁸/c статВ, 1 Ом = 10⁹/c² с/см,
 *  1 Гн = 10⁹ см (конвенція ε = −(L/c²)dI/dt), 1 Тл = 10⁴ Гс, 1 Вб = 10⁸ Мкс.
 */
export const DIMS: Record<Dim, DimInfo> = {
  none: { factor: 1, cgs: '', si: '' },
  percent: { factor: 1, cgs: '%', si: '%' },
  time: { factor: 1, cgs: 'с', si: 'с' },
  freq: { factor: 1, cgs: 'Гц', si: 'Гц' },
  angle: { factor: 1, cgs: 'рад', si: 'рад' },
  omega: { factor: 1, cgs: 'рад/с', si: 'рад/с' },
  length: { factor: 1e-2, cgs: 'см', si: 'м' },
  area: { factor: 1e-4, cgs: 'см²', si: 'м²' },
  mass: { factor: 1e-3, cgs: 'г', si: 'кг' },
  velocity: { factor: 1e-2, cgs: 'см/с', si: 'м/с' },
  accel: { factor: 1e-2, cgs: 'см/с²', si: 'м/с²' },
  force: { factor: 1e-5, cgs: 'дин', si: 'Н' },
  energy: { factor: 1e-7, cgs: 'ерг', si: 'Дж' },
  power: { factor: 1e-7, cgs: 'ерг/с', si: 'Вт' },
  torque: { factor: 1e-7, cgs: 'дин·см', si: 'Н·м' },
  inertia: { factor: 1e-7, cgs: 'г·см²', si: 'кг·м²' },
  damping: { factor: 1e-3, cgs: 'г/с', si: 'кг/с' },
  angDamping: { factor: 1e-7, cgs: 'дин·см·с', si: 'Н·м·с' },
  B: { factor: 1e-4, cgs: 'Гс', si: 'Тл' },
  flux: { factor: 1e-8, cgs: 'Мкс', si: 'Вб' },
  current: { factor: 10 / C, cgs: 'статА', si: 'А' },
  charge: { factor: 10 / C, cgs: 'статКл', si: 'Кл' },
  voltage: { factor: C * 1e-8, cgs: 'статВ', si: 'В' },
  efield: { factor: C * 1e-6, cgs: 'статВ/см', si: 'В/м' },
  resistance: { factor: C * C * 1e-9, cgs: 'с/см', si: 'Ом' },
  inductance: { factor: 1e-9, cgs: 'см', si: 'Гн' },
  conductivity: { factor: 1e11 / (C * C), cgs: 'с⁻¹', si: 'См/м' },
  moment: { factor: 1e-3, cgs: 'ерг/Гс', si: 'А·м²' },
  jdensity: { factor: (10 / C) * 1e4, cgs: 'статА/см²', si: 'А/м²' },
  powerDensity: { factor: 1e-7 * 1e6, cgs: 'ерг/(с·см³)', si: 'Вт/м³' },
  temperature: { factor: 1, cgs: 'К', si: 'К' },
};

/** СГС → вибрана система. */
export function toSys(x: number, dim: Dim, sys: UnitSystem): number {
  return sys === 'SI' ? x * DIMS[dim].factor : x;
}

/** Вибрана система → СГС. */
export function fromSys(x: number, dim: Dim, sys: UnitSystem): number {
  return sys === 'SI' ? x / DIMS[dim].factor : x;
}

export function unitLabel(dim: Dim, sys: UnitSystem): string {
  return sys === 'SI' ? DIMS[dim].si : DIMS[dim].cgs;
}

const SUP: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

/** Число у вигляді «1.23·10⁻⁴» або «12.3», 3 значущі цифри за замовчуванням. */
export function fmtNum(x: number, digits = 3): string {
  if (!isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e5) return String(Number(x.toPrecision(digits)));
  const e = Math.floor(Math.log10(a));
  let m = x / 10 ** e;
  let ee = e;
  if (Math.abs(Number(m.toPrecision(digits))) >= 10) {
    m /= 10;
    ee += 1;
  }
  const exp = String(ee).split('').map((ch) => SUP[ch]).join('');
  return `${Number(m.toPrecision(digits))}·10${exp}`;
}

/** Повний рядок «значення одиниця» у вибраній системі. */
export function fmt(xCgs: number, dim: Dim, sys: UnitSystem, digits = 3): string {
  const u = unitLabel(dim, sys);
  const v = fmtNum(toSys(xCgs, dim, sys), digits);
  return u ? `${v} ${u}` : v;
}
