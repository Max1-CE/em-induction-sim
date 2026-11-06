// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import { Slab, SlabHeating, skinDepth, thinPlatePower } from '../../src/physics/heating';
import { DiskModel, DiskBrake, type DiskParams } from '../../src/physics/diskBrake';
import { energyError } from '../../src/physics/energy';
import { materialById, MU0_SI } from '../../src/physics/constants';
import { toSys } from '../../src/physics/units';

const cu = materialById('cu');

describe('2d. Індукційний нагрів', () => {
  it('тонка пластина: точний розв’язок → π²f²B₀²d²σ/(6c²)', () => {
    const s = new Slab(cu.sigma, 50, 1000, 0.01); // δ(50 Гц) ≈ 0.92 см ≫ 0.01 см
    expect(s.avgPowerDensity() / thinPlatePower(50, 1000, 0.01, cu.sigma)).toBeCloseTo(1, 4);
  });

  it('шихтування: n пластин зменшують втрати в n² разів', () => {
    const P1 = thinPlatePower(50, 1e4, 0.5, cu.sigma);
    const P5 = thinPlatePower(50, 1e4, 0.5 / 5, cu.sigma);
    expect(P1 / P5).toBeCloseTo(25, 10);
  });

  it('товста пластина: втрати менші за формулу тонкої (скін-ефект)', () => {
    const s = new Slab(cu.sigma, 5000, 1000, 1);
    expect(s.avgPowerDensity()).toBeLessThan(0.2 * thinPlatePower(5000, 1000, 1, cu.sigma));
  });

  it('δ однакова в СГС і СІ', () => {
    const w = 2 * Math.PI * 50;
    const dSi = Math.sqrt(2 / (MU0_SI * toSys(cu.sigma, 'conductivity', 'SI') * w));
    expect(toSys(skinDepth(cu.sigma, w), 'length', 'SI') / dSi).toBeCloseTo(1, 6);
  });

  it('теорема Пойнтінга: робота джерела = тепло + ΔW_маг (за 10 періодів)', () => {
    for (const d of [0.05, 2]) {
      const h = new SlabHeating(new Slab(cu.sigma, 50, 1000, d));
      const e0 = h.energies();
      for (let i = 0; i < 100; i++) h.step(0.2 / 100);
      const e = h.energies();
      expect(e.heat).toBeGreaterThan(0);
      expect(energyError(e0, e)).toBeLessThan(0.01);
    }
  });
});

const disk = (B0: number): DiskParams => ({
  sigma: materialById('al').sigma, rho: 2.7, d: 0.3, Rd: 12, r0: 8, pole: 2, B0, drive: 0, skin: true,
});

describe('2c. Електромагнітне гальмо', () => {
  it('K₀ ∝ B²', () => {
    expect(new DiskModel(disk(2000)).K0 / new DiskModel(disk(1000)).K0).toBeCloseTo(4, 6);
  });

  it('момент максимальний при ω = ω_c', () => {
    const m = new DiskModel(disk(2000));
    const wc = m.omegaC;
    expect(Math.abs(m.torque(wc))).toBeGreaterThan(Math.abs(m.torque(0.7 * wc)));
    expect(Math.abs(m.torque(wc))).toBeGreaterThan(Math.abs(m.torque(1.4 * wc)));
  });

  it('енергія зберігається (< 1% за 10 с)', () => {
    const b = new DiskBrake(new DiskModel({ ...disk(3000), drive: 2e6 }), 300);
    const e0 = b.energies();
    for (let i = 0; i < 600; i++) b.step(1 / 60);
    expect(energyError(e0, b.energies())).toBeLessThan(0.01);
  });
});
