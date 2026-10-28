import { describe, it, expect } from 'vitest';
import { EddyTube, terminalVelocity, type TubeParams } from '../../src/physics/eddyTube';
import { energyError } from '../../src/physics/energy';
import { materialById, MU0_SI, G } from '../../src/physics/constants';
import { toSys } from '../../src/physics/units';

// Магніт NdFeB Ø12.7 × 12.7 мм у мідній трубі
const base = (): TubeParams => ({
  sigma: materialById('cu').sigma, w: 0.15, a: 0.8, m: 1600, mass: 12, h: 0.1, length: 200, selfInduction: false,
});

describe('2a. Магніт у трубі', () => {
  it('енергія зберігається (< 1% за 10 с), без самоіндукції', () => {
    const s = new EddyTube(base());
    const e0 = s.energies();
    for (let i = 0; i < 600; i++) s.step(1 / 60);
    expect(s.landed).toBe(false);
    expect(s.energies().heat).toBeGreaterThan(0);
    expect(energyError(e0, s.energies())).toBeLessThan(0.01);
  });

  it('енергія зберігається з самоіндукцією та взаємною індукцією кілець', () => {
    const s = new EddyTube({ ...base(), h: 0.2, selfInduction: true });
    expect(s.lMatrixOk).toBe(true);
    const e0 = s.energies();
    for (let i = 0; i < 120; i++) s.step(1 / 60);
    expect(energyError(e0, s.energies())).toBeLessThan(0.01);
  });

  it('гранична швидкість не залежить від початкової', () => {
    const vt: number[] = [];
    for (const v0 of [0, -30, -150]) {
      const s = new EddyTube(base(), 150, v0);
      for (let i = 0; i < 300; i++) s.step(1 / 60);
      vt.push(-s.y[1]);
    }
    expect(Math.abs(vt[1] / vt[0] - 1)).toBeLessThan(0.005);
    expect(Math.abs(vt[2] / vt[0] - 1)).toBeLessThan(0.005);
  });

  it('чисельна v_гр збігається з аналітичною формулою при h ≪ a', () => {
    const p = base();
    const s = new EddyTube(p, 150, 0);
    for (let i = 0; i < 300; i++) s.step(1 / 60);
    expect(-s.y[1] / terminalVelocity(p)).toBeCloseTo(1, 2);
  });

  it('формула v_гр однакова в СГС і СІ', () => {
    const p = base();
    const vCgs = terminalVelocity(p);
    // СІ: v = 1024 M g a⁴ / (45 μ₀² σ w 𝔪²)
    const M = toSys(p.mass, 'mass', 'SI'), g = toSys(G, 'accel', 'SI'), a = toSys(p.a, 'length', 'SI');
    const sigma = toSys(p.sigma, 'conductivity', 'SI'), w = toSys(p.w, 'length', 'SI'), m = toSys(p.m, 'moment', 'SI');
    const vSi = (1024 * M * g * a ** 4) / (45 * MU0_SI ** 2 * sigma * w * m ** 2);
    expect(vSi / toSys(vCgs, 'velocity', 'SI')).toBeCloseTo(1, 6);
  });

  it('струми над і під магнітом протилежні (Ленц)', () => {
    const s = new EddyTube(base(), 100, -3);
    const k = Math.round(100 / 0.1);
    const above = s.ringCurrent(k + 8), below = s.ringCurrent(k - 8);
    expect(above * below).toBeLessThan(0);
    expect(s.force()).toBeGreaterThan(0); // магніт падає (v<0) — сила вгору
  });
});
