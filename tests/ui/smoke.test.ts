// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

// @vitest-environment happy-dom
/**
 * Smoke-тест інтерфейсу: кожна сторінка створюється, крокує, записує графіки, оновлює панель
 * і малює кадр на фіктивному canvas у СГС і СІ — без винятків.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Фіктивний 2D-контекст: будь-який метод — no-op, measureText/createImageData — правдоподібні значення.
const fakeCtx = (): CanvasRenderingContext2D =>
  new Proxy({} as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

const katexErrors: string[] = [];

beforeAll(() => {
  // KaTeX відмовляється працювати в quirks mode — додаємо doctype у тестовий документ
  Object.defineProperty(document, 'compatMode', { value: 'CSS1Compat', configurable: true });
  const orig = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const s = args.map(String).join(' ');
    if (s.includes('KaTeX')) katexErrors.push(s.slice(0, 300));
    else orig(...args);
  });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => fakeCtx()) as unknown as HTMLCanvasElement['getContext'];
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };
  }
  window.matchMedia = window.matchMedia ?? (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});

describe('UI smoke', () => {
  it('усі сторінки створюються, симулюються і малюються в обох системах одиниць', async () => {
    vi.mock('uplot', () => ({
      default: class {
        constructor() {}
        setData() {}
        setSize() {}
        destroy() {}
      },
    }));
    const { SECTIONS } = await import('../../src/sections');
    const { units } = await import('../../src/ui/units-store');
    const { SimPage } = await import('../../src/ui/simpage');
    let n = 0;
    for (const sec of SECTIONS)
      for (const sub of sec.subs) {
        const page = sub.make();
        document.body.append(page.el);
        if (page instanceof SimPage) {
          for (const sys of ['CGS', 'SI'] as const) {
            units.set(sys);
            for (let i = 0; i < 20; i++) {
              page.hooks.step(1 / 60);
              page.hooks.sample?.();
            }
            page.hooks.updateNow?.(page.now);
            page.hooks.draw(page.ctx, 800, 420);
          }
          page.reset();
          page.hooks.draw(page.ctx, 800, 420);
        }
        page.el.remove();
        n++;
      }
    expect(n).toBe(12);
    units.set('CGS');
    // усі формули в теорії, квізах і довіднику мають розбиратися KaTeX без помилок
    expect(katexErrors).toEqual([]);
  });
});
