// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import { solvePoisson, dirichletEnergy, type Grid } from '../../src/physics/streamSolver';
import { PlateModel, Pendulum, type PendulumParams } from '../../src/physics/waltenhofen';
import { energyError } from '../../src/physics/energy';
import { materialById } from '../../src/physics/constants';

describe('Розв’язувач Пуассона для ψ', () => {
  it('квадрат з ψ=0 на межі: −Δψ = 2π² sin(πx)sin(πy) ⇒ ψ = sin(πx)sin(πy)', () => {
    const n = 64, h = 1 / n;
    const g: Grid = { nx: n, ny: n, h, mask: new Uint8Array(n * n).fill(1) };
    // межа клітинкова: центри комірок у (i+½)h, ψ = 0 на півкроці за межею ≈ на межі квадрата [0,1]
    const rhs = new Float64Array(n * n);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * h, y = (j + 0.5) * h;
        rhs[j * n + i] = 2 * Math.PI ** 2 * Math.sin(Math.PI * x) * Math.sin(Math.PI * y);
      }
    const psi = solvePoisson(g, rhs);
    const c = (n / 2) * n + n / 2;
    const exact = Math.sin(Math.PI * (n / 2 + 0.5) * h) ** 2;
    expect(Math.abs(psi[c] / exact - 1)).toBeLessThan(0.02);
    expect(dirichletEnergy(g, psi)).toBeGreaterThan(0);
  });
});

const params = (slots: number): PendulumParams => ({
  sigma: materialById('al').sigma, rho: 2.7, d: 0.3, b: 8, c: 6, arm: 25, B0: 3000, pole: 2.5,
  slots, slotWidth: 0.4, slotDepth: 0.8,
});

describe('2b. Маятник Вальтенгофена', () => {
  const solid = new PlateModel(params(0), 41, 1.0);
  const comb = new PlateModel(params(7), 41, 1.0);

  it('енергія зберігається (< 1% за 10 с) для обох пластин', () => {
    for (const pl of [solid, comb]) {
      const pd = new Pendulum(pl, 0.6);
      const e0 = pd.energies();
      for (let i = 0; i < 600; i++) pd.step(1 / 60);
      expect(pd.energies().heat).toBeGreaterThan(0);
      expect(energyError(e0, pd.energies())).toBeLessThan(0.01);
    }
  });

  it('гребінка гальмується значно слабше за суцільну пластину', () => {
    const k0 = solid.Kat(0) / solid.J;
    const k1 = comb.Kat(0) / comb.J;
    expect(k1).toBeLessThan(0.5 * k0);
  });

  it('гальмування лише поблизу полюсів: K(θ) мале, коли пластина далеко', () => {
    expect(solid.Kat(0.9)).toBeLessThan(0.01 * Math.max(...solid.K));
  });
});
