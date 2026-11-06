// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Формули KaTeX. Теорія пишеться як HTML з $…$ (рядкові) та $$…$$ (виносні) формулами.
 * fp(cgs, si) — пара формул: основною показується формула вибраної системи, інша — дрібніше під нею.
 */
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

export function renderMath(el: HTMLElement): void {
  renderMathInElement(el, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
    ],
    throwOnError: false,
    // кириличні індекси (v_гр, T_м, ε_проти) — свідомо в математичному режимі
    strict: 'ignore',
  });
}

/** Пара формул СГС / СІ (порядок і розмір перемикаються CSS-класом на body). */
export function fp(cgs: string, si?: string): string {
  if (si === undefined) return `<div class="fp"><div class="row f-cgs f-both">$$${cgs}$$</div></div>`;
  return `<div class="fp"><div class="row f-cgs"><span class="tag">СГС</span>$$${cgs}$$</div><div class="row f-si"><span class="tag">СІ</span>$$${si}$$</div></div>`;
}

/** Рядковий фрагмент, що залежить від системи одиниць. */
export function ip(cgs: string, si: string): string {
  return `<span class="only-cgs">${cgs}</span><span class="only-si">${si}</span>`;
}
