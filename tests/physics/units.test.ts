import { describe, it, expect } from 'vitest';
import { DIMS, toSys, fromSys, fmtNum, type Dim } from '../../src/physics/units';
import { C, SIEMENS_PER_M_TO_CGS, MU0_SI } from '../../src/physics/constants';

describe('Переведення одиниць СГС ↔ СІ', () => {
  it('туди-назад дає тотожність для всіх розмірностей', () => {
    for (const d of Object.keys(DIMS) as Dim[]) {
      for (const x of [1, -3.7e-5, 2.5e12, 0.123456789]) {
        expect(fromSys(toSys(x, d, 'SI'), d, 'SI')).toBeCloseTo(x, 12 - Math.log10(Math.abs(x) + 1));
        expect(fromSys(toSys(x, d, 'SI'), d, 'SI') / x).toBeCloseTo(1, 13);
        expect(toSys(x, d, 'CGS')).toBe(x);
      }
    }
  });

  it('контрольні значення', () => {
    expect(fromSys(1, 'B', 'SI')).toBeCloseTo(1e4, 9);              // 1 Тл = 10⁴ Гс
    expect(fromSys(1, 'flux', 'SI')).toBeCloseTo(1e8, 4);           // 1 Вб = 10⁸ Мкс
    expect(fromSys(1, 'current', 'SI') / 2.998e9).toBeCloseTo(1, 3); // 1 А ≈ 3·10⁹ статА
    expect(fromSys(1, 'voltage', 'SI') * 299.79).toBeCloseTo(1, 4); // 1 В ≈ 1/300 статВ
    expect(fromSys(1, 'resistance', 'SI') * 8.988e11).toBeCloseTo(1, 3);
    expect(fromSys(1, 'inductance', 'SI')).toBeCloseTo(1e9, 3);     // 1 Гн = 10⁹ см
    expect(fromSys(1, 'force', 'SI')).toBeCloseTo(1e5, 6);
    expect(fromSys(1, 'energy', 'SI')).toBeCloseTo(1e7, 4);
    expect(fromSys(1, 'conductivity', 'SI')).toBeCloseTo(SIEMENS_PER_M_TO_CGS, 0);
  });

  it('узгодженість: напруга = струм × опір і потужність = U·I в обох системах', () => {
    const k = DIMS;
    expect((k.current.factor * k.resistance.factor) / k.voltage.factor).toBeCloseTo(1, 12);
    expect((k.current.factor * k.voltage.factor) / k.power.factor).toBeCloseTo(1, 12);
    // L/c² у СГС ↔ L у СІ: ε = L dI/dt ⇒ [L_СІ] = [U]/[I/с]
    // (f_L·L)(f_I·İ) = f_U·(L/c²)İ ⇒ f_L f_I c² / f_U = 1
    expect((k.inductance.factor * k.current.factor * C * C) / k.voltage.factor).toBeCloseTo(1, 9);
    // Потік: ε_СІ = −dΦ_СІ/dt, ε_СГС = −(1/c)dΦ_СГС/dt ⇒ factor_flux = factor_U / c
    expect(k.flux.factor / (k.voltage.factor / C)).toBeCloseTo(1, 12);
    // μ₀ у СГС-еквіваленті: B_СІ = μ₀ H_СІ, 4π/c ↔ μ₀
    expect(MU0_SI).toBeCloseTo(1.2566370614e-6, 15);
  });

  it('форматування чисел', () => {
    expect(fmtNum(1234.5)).toBe('1230');
    expect(fmtNum(2.5e-7)).toBe('2.5·10⁻⁷');
    expect(fmtNum(0)).toBe('0');
  });
});
