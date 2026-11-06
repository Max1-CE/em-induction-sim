// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

import { describe, it, expect } from 'vitest';
import { DCMotor, commutator, type DCMotorParams } from '../../src/physics/dcMotor';
import { InductionMotor, type InductionParams } from '../../src/physics/inductionMotor';
import { energyError } from '../../src/physics/energy';
import { fromSys } from '../../src/physics/units';

const ohm = (x: number) => fromSys(x, 'resistance', 'SI');
const henry = (x: number) => fromSys(x, 'inductance', 'SI');
const volt = (x: number) => fromSys(x, 'voltage', 'SI');
const wb = (x: number) => fromSys(x, 'flux', 'SI');
const nm = (x: number) => fromSys(x, 'torque', 'SI');
const kgm2 = (x: number) => fromSys(x, 'inertia', 'SI');

// Невеликий двигун 12 В: k = 0.02 Вб, R = 1 Ом, L = 1 мГн
const dc = (o: Partial<DCMotorParams> = {}): DCMotorParams => ({
  U: volt(12), R: ohm(1), Rload: 0, L: henry(1e-3), k: wb(0.02), J: kgm2(2e-5), b: nm(1e-6),
  Mload: nm(0.02), coils: 0, ...o,
});

describe('3a. Двигун постійного струму', () => {
  it('енергія зберігається (< 1% за 10 с): ідеальний колектор і 1 котушка', () => {
    for (const coils of [0, 1, 3]) {
      const m = new DCMotor(dc({ coils }));
      const e0 = m.energies();
      for (let i = 0; i < 600; i++) m.step(1 / 60);
      expect(energyError(e0, m.energies())).toBeLessThan(0.01);
    }
  });

  it('виходить на усталену ω(M) з механічної характеристики; пусковий струм ≫ робочого', () => {
    const m = new DCMotor(dc());
    const I0 = m.current();
    for (let i = 0; i < 600; i++) m.step(1 / 60);
    expect(m.y[0] / m.steadyOmega(m.p.Mload)).toBeCloseTo(1, 4);
    expect(Math.abs(m.current() / m.steadyCurrent(m.p.Mload) - 1)).toBeLessThan(1e-3);
    // при t=0 струм ще 0 через L, але квазістатичний пусковий U/R
    expect(I0).toBe(0);
    expect(m.p.U / m.p.R / m.current()).toBeGreaterThan(5);
  });

  it('СГС/СІ: ε = k_Φω/c ↔ k_Φω, M = k_ΦI/c ↔ k_ΦI', () => {
    const m = new DCMotor(dc());
    m.y[0] = 100;
    // СІ: ε = 0.02 Вб · 100 рад/с = 2 В
    expect(m.backEmf() / volt(2)).toBeCloseTo(1, 9);
  });

  it('генератор: зовнішній привід, струм і гальмівний момент (Ленц), баланс енергії', () => {
    const g = new DCMotor(dc({ U: 0, Rload: ohm(5), Mload: -nm(0.03) }));
    const e0 = g.energies();
    for (let i = 0; i < 600; i++) g.step(1 / 60);
    expect(g.y[0]).toBeGreaterThan(0);
    expect(g.current()).toBeLessThan(0);   // струм проти «моторного» напряму
    expect(g.torque()).toBeLessThan(0);    // момент гальмує обертання
    expect(energyError(e0, g.energies())).toBeLessThan(0.01);
  });

  it('середнє колекторної функції ≈ 1', () => {
    for (const n of [1, 2, 3]) {
      let s = 0;
      for (let i = 0; i < 1000; i++) s += commutator((Math.PI * i) / 1000, n);
      expect(s / 1000).toBeCloseTo(1, 2);
    }
  });
});

const im = (o: Partial<InductionParams> = {}): InductionParams => ({
  B0: 3000, fs: 2, S: 80, R: ohm(0.05), L: henry(0.02), N: 4, J: 300, b: 0, Mload: 0, ...o,
});

describe('3b. Асинхронний двигун', () => {
  it('енергія зберігається (< 1% за 10 с)', () => {
    const m = new InductionMotor(im({ Mload: 500 }));
    const e0 = m.energies();
    for (let i = 0; i < 600; i++) m.step(1 / 60);
    expect(energyError(e0, m.energies())).toBeLessThan(0.01);
  });

  it('ротор розганяється, але ковзання s > 0 (синхронізм недосяжний)', () => {
    // M_max = N(B₀S)²/(4L) ≈ 2.9·10³ дин·см, пусковий ≈ 1.1·10³ — навантаження має бути меншим
    const m = new InductionMotor(im({ Mload: 500, b: 10 }));
    for (let i = 0; i < 900; i++) m.step(1 / 60);
    expect(m.y[0]).toBeGreaterThan(0.5 * m.ws);
    expect(m.slip()).toBeGreaterThan(0);
  });

  it('усталений чисельний момент збігається з M(s) при фіксованій ω_r', () => {
    const m = new InductionMotor(im({ J: 1e30 })); // дуже інертний ротор — ω_r = const
    m.y[0] = 0.8 * m.ws;
    for (let i = 0; i < 600; i++) m.step(1 / 60);
    let avg = 0;
    const n = 400;
    for (let i = 0; i < n; i++) { m.step(1 / (m.p.fs * n)); avg += m.torque(); }
    expect(avg / n / m.steadyTorque(0.2)).toBeCloseTo(1, 2);
  });

  it('максимум M(s) при s_k = c²R/(ω_s L) дорівнює N(B₀S)²/(4L)', () => {
    const m = new InductionMotor(im());
    expect(m.steadyTorque(m.sCrit) / m.Mmax).toBeCloseTo(1, 10);
    expect(m.steadyTorque(0)).toBe(0);
  });
});
