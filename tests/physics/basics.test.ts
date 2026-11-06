// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import { CoilMagnet } from '../../src/physics/coilMagnet';
import { Generator } from '../../src/physics/generator';
import { Rails } from '../../src/physics/rails';
import { RLCircuit } from '../../src/physics/rlCircuit';
import { energyError, energyTotal } from '../../src/physics/energy';
import { fromSys } from '../../src/physics/units';
import { loopFlux, loopFluxDz, solenoidFlux, solenoidFluxDz, mutualCoaxial, dipoleField } from '../../src/physics/dipole';

const ohm = (x: number) => fromSys(x, 'resistance', 'SI');
const henry = (x: number) => fromSys(x, 'inductance', 'SI');
const volt = (x: number) => fromSys(x, 'voltage', 'SI');

const coilParams = () => ({ m: 1000, mass: 7.5, a: 2, N: 300, len: 5, R: ohm(0.3), selfInduction: true });

describe('Поле диполя та потоки', () => {
  it('dΦ/dz збігається з чисельною похідною', () => {
    const h = 1e-4;
    for (const z of [-5, -1, 0.3, 2, 7]) {
      const num = (loopFlux(100, 2, z + h) - loopFlux(100, 2, z - h)) / (2 * h);
      expect(loopFluxDz(100, 2, z) / num).toBeCloseTo(1, 5);
      const nums = (solenoidFlux(100, 2, 50, 4, z + h) - solenoidFlux(100, 2, 50, 4, z - h)) / (2 * h);
      expect(solenoidFluxDz(100, 2, 50, 4, z) / nums).toBeCloseTo(1, 5);
    }
  });

  it('потік через кільце = інтеграл B_z по диску', () => {
    const m = 50, a = 1.5, z = 0.7, n = 4000;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const r = ((i + 0.5) / n) * a;
      s += dipoleField(m, r, z)[1] * 2 * Math.PI * r * (a / n);
    }
    expect(s / loopFlux(m, a, z)).toBeCloseTo(1, 4);
  });

  it('взаємна індуктивність далеких кілець → диполь-дипольна межа 2π²a²b²/d³', () => {
    const a = 1, b = 1.3, d = 200;
    expect(mutualCoaxial(a, b, d) / ((2 * Math.PI ** 2 * a * a * b * b) / d ** 3)).toBeCloseTo(1, 3);
  });
});

describe('Правило Ленца: магніт і котушка', () => {
  it('ЕРС протилежна за знаком до dΦ/dt, а сила гальмує магніт', () => {
    for (const v of [100, -80]) {
      for (const z of [-6, -2, 1.5, 4]) {
        const s = new CoilMagnet({ ...coilParams(), selfInduction: false }, z, v);
        const dPhiDt = s.fluxDz() * v;
        expect(Math.sign(s.emf())).toBe(-Math.sign(dPhiDt));
        // індукований струм створює потік, що протидіє зміні: I·dΦ/dt < 0
        expect(s.current() * dPhiDt).toBeLessThan(0);
        // сила на магніт протилежна швидкості
        expect(s.force() * v).toBeLessThan(0);
      }
    }
  });

  it('вільний проліт: енергія зберігається (< 1% за 10 с)', () => {
    const s = new CoilMagnet(coilParams(), -40, 60);
    const e0 = s.energies();
    for (let i = 0; i < 600; i++) s.step(1 / 60);
    expect(s.y[0]).toBeGreaterThan(0);
    expect(s.energies().heat).toBeGreaterThan(0);
    expect(energyError(e0, s.energies())).toBeLessThan(0.01);
  });

  it('примусовий рух: робота приводу = тепло + магнітна енергія', () => {
    const s = new CoilMagnet(coilParams(), -20, 0);
    s.motion = (t) => ({ z: -20 + 40 * Math.sin(t), v: 40 * Math.cos(t) });
    const e0 = s.energies();
    for (let i = 0; i < 600; i++) s.step(1 / 60);
    const e = s.energies();
    expect(e.ext).toBeGreaterThan(0);
    expect(Math.abs(energyTotal(e) - energyTotal(e0)) / e.ext).toBeLessThan(1e-3);
  });
});

describe('Генератор і рейки', () => {
  it('рамка вільно обертається: ½Jω² + Q + W = const', () => {
    const g = new Generator({ B: 1000, S: 100, N: 50, R: ohm(2), L: henry(0.01), J: 2e4, driven: false, omegaDrive: 0 }, 30);
    const e0 = g.energies();
    for (let i = 0; i < 600; i++) g.step(1 / 60);
    expect(g.y[1]).toBeLessThan(30);
    expect(energyError(e0, g.energies())).toBeLessThan(0.01);
  });

  it('рейки: стрижень гальмується, енергія зберігається; «анти-Ленц» розганяє', () => {
    const p = { B: 5000, l: 20, m: 50, R: ohm(0.05), L: 0, Fext: 0, antiLenz: false };
    const r = new Rails(p, 50);
    const e0 = r.energies();
    for (let i = 0; i < 600; i++) r.step(1 / 60);
    expect(r.y[1]).toBeLessThan(50);
    expect(energyError(e0, r.energies())).toBeLessThan(0.01);

    const bad = new Rails({ ...p, antiLenz: true }, 1);
    const b0 = bad.energies();
    for (let i = 0; i < 60; i++) bad.step(1 / 60);
    expect(bad.y[1]).toBeGreaterThan(1);
    expect(energyTotal(bad.energies())).toBeGreaterThan(energyTotal(b0)); // енергія з нічого
  });
});

describe('RL-коло', () => {
  it('чисельний I(t) збігається з аналітичним розв’язком через τ(t) = e^{t/T}', () => {
    const rl = new RLCircuit({ emf: volt(12), R: ohm(10), Rd: ohm(30), L: henry(5) });
    rl.setClosed(true);
    let maxErr = 0;
    const Imax = volt(12) / ohm(10);
    for (let i = 0; i < 120; i++) {
      rl.step(1 / 60);
      maxErr = Math.max(maxErr, Math.abs(rl.y[0] - rl.analytic()) / Imax);
    }
    expect(rl.T).toBeCloseTo(0.5, 9); // T = L/R = 5 Гн / 10 Ом
    rl.setClosed(false);
    for (let i = 0; i < 120; i++) {
      rl.step(1 / 60);
      maxErr = Math.max(maxErr, Math.abs(rl.y[0] - rl.analytic()) / Imax);
    }
    expect(maxErr).toBeLessThan(1e-6);
  });

  it('робота батареї = тепло + LI²/2c²', () => {
    const rl = new RLCircuit({ emf: volt(12), R: ohm(10), Rd: ohm(30), L: henry(5) });
    rl.setClosed(true);
    for (let i = 0; i < 600; i++) rl.step(1 / 60);
    const e = rl.energies();
    expect(Math.abs(energyTotal(e)) / e.ext).toBeLessThan(1e-6);
  });
});
