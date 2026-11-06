// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/** 4. Довідник: одиниці СІ ↔ СГС, правила переведення формул, провідності, глосарій. */
import { MATERIALS, C } from '../physics/constants';
import { fmtNum } from '../physics/units';
import { h } from '../ui/dom';
import { renderMath } from '../ui/tex';
import type { Page } from '../ui/simpage';

const R = String.raw;

export function createReference(): Page {
  const c = C;
  const units: [string, string, string, string, string][] = [
    ['Магнітна індукція $B$', 'Тл', 'Гс', R`$1\ \text{Тл} = 10^4\ \text{Гс}$`, 'точно'],
    ['Магнітний потік $\Phi$', 'Вб', 'Мкс (Гс·см²)', R`$1\ \text{Вб} = 10^8\ \text{Мкс}$`, 'точно'],
    ['Струм $I$', 'А', 'статА', R`$1\ \text{А} = c/10\ \text{статА}$`, `≈ ${fmtNum(c / 10, 4)} ≈ 3·10⁹`],
    ['Заряд $q$', 'Кл', 'статКл', R`$1\ \text{Кл} = c/10\ \text{статКл}$`, '≈ 3·10⁹'],
    ['Напруга, ЕРС $U,\ \varepsilon$', 'В', 'статВ', R`$1\ \text{В} = 10^8/c\ \text{статВ}$`, `≈ 1/${fmtNum(c * 1e-8, 4)} ≈ 1/300`],
    ['Опір $R$', 'Ом', 'с/см', R`$1\ \text{Ом} = 10^9/c^2\ \text{с/см}$`, '≈ 1/(9·10¹¹)'],
    ['Провідність $\sigma$', 'См/м', 'с⁻¹', R`$1\ \text{См/м} = c^2\cdot10^{-11}\ \text{с}^{-1}$`, '≈ 9·10⁹'],
    ['Індуктивність $L$', 'Гн', 'см', R`$1\ \text{Гн} = 10^9\ \text{см}$`, R`точно (у конвенції $\varepsilon = -\frac{L}{c^2}\dot I$)`],
    ['Магнітний момент $\mathfrak m$', 'А·м²', 'ерг/Гс', R`$1\ \text{А·м}^2 = 10^3\ \text{ерг/Гс}$`, 'точно'],
    ['Сила $F$', 'Н', 'дин', R`$1\ \text{Н} = 10^5\ \text{дин}$`, 'точно'],
    ['Енергія $W$', 'Дж', 'ерг', R`$1\ \text{Дж} = 10^7\ \text{ерг}$`, 'точно'],
    ['Потужність $P$', 'Вт', 'ерг/с', R`$1\ \text{Вт} = 10^7\ \text{ерг/с}$`, 'точно'],
    ['Момент сил $M$', 'Н·м', 'дин·см', R`$1\ \text{Н·м} = 10^7\ \text{дин·см}$`, 'точно'],
    ['Напруженість $E$', 'В/м', 'статВ/см', R`$1\ \text{В/м} = 10^6/c\ \text{статВ/см}$`, '≈ 1/(3·10⁴)'],
    ['Густина струму $j$', 'А/м²', 'статА/см²', R`$1\ \text{А/м}^2 = c\cdot10^{-5}\ \text{статА/см}^2$`, '≈ 3·10⁵'],
  ];

  const formulas: [string, string, string][] = [
    ['Закон Фарадея', R`\varepsilon = -\frac1c\frac{d\Phi}{dt}`, R`\varepsilon = -\frac{d\Phi}{dt}`],
    ['Диференціальна форма', R`\operatorname{rot}\mathbf E = -\frac1c\frac{\partial\mathbf B}{\partial t}`, R`\operatorname{rot}\mathbf E = -\frac{\partial\mathbf B}{\partial t}`],
    ['Сила Лоренца', R`\mathbf F = q\left(\mathbf E + \frac1c\mathbf v\times\mathbf B\right)`, R`\mathbf F = q(\mathbf E + \mathbf v\times\mathbf B)`],
    ['ЕРС руху', R`\varepsilon = \frac1c\oint(\mathbf v\times\mathbf B)\cdot d\mathbf l`, R`\varepsilon = \oint(\mathbf v\times\mathbf B)\cdot d\mathbf l`],
    ['Сила Ампера', R`d\mathbf F = \frac Ic\,d\mathbf l\times\mathbf B`, R`d\mathbf F = I\,d\mathbf l\times\mathbf B`],
    ['Магнітний момент контуру', R`\mathfrak m = \frac{IS}{c}`, R`\mathfrak m = IS`],
    ['Самоіндукція', R`\Phi = \frac{LI}{c},\ \varepsilon = -\frac{L}{c^2}\dot I,\ W = \frac{LI^2}{2c^2}`, R`\Phi = LI,\ \varepsilon = -L\dot I,\ W = \frac{LI^2}{2}`],
    ['Стала часу RL', R`T = \frac{L}{c^2R}`, R`T = \frac LR`],
    ['Поле диполя', R`\mathbf B = \frac{3(\boldsymbol{\mathfrak m}\cdot\hat{\mathbf r})\hat{\mathbf r} - \boldsymbol{\mathfrak m}}{r^3}`, R`\mathbf B = \frac{\mu_0}{4\pi}\frac{3(\boldsymbol{\mathfrak m}\cdot\hat{\mathbf r})\hat{\mathbf r} - \boldsymbol{\mathfrak m}}{r^3}`],
    ['Закон Ампера', R`\operatorname{rot}\mathbf B = \frac{4\pi}{c}\mathbf j`, R`\operatorname{rot}\mathbf B = \mu_0\mathbf j`],
    ['Густина енергії поля', R`w = \frac{B^2}{8\pi}`, R`w = \frac{B^2}{2\mu_0}`],
    ['Скін-шар', R`\delta = \frac{c}{\sqrt{2\pi\sigma\omega}}`, R`\delta = \sqrt{\frac{2}{\mu_0\sigma\omega}}`],
    ['Втрати в тонкій пластині', R`\frac PV = \frac{\pi^2f^2B_0^2d^2\sigma}{6c^2}`, R`\frac PV = \frac{\pi^2f^2B_0^2d^2\sigma}{6}`],
    ['Проти-ЕРС, момент двигуна', R`\varepsilon = \frac{k_\Phi\omega}{c},\ M = \frac{k_\Phi I}{c}`, R`\varepsilon = k_\Phi\omega,\ M = k_\Phi I`],
  ];

  const glossary: [string, string][] = [
    ['Магнітний потік', R`$\Phi = \int\mathbf B\cdot d\mathbf S$ — «кількість ліній поля» через поверхню, натягнуту на контур. Для котушки — потокозчеплення (сума по витках).`],
    ['ЕРС', 'Електрорушійна сила — робота сторонніх (непотенціальних) сил на одиничний заряд по замкненому контуру. При індукції ці сили — вихрове електричне поле або магнітна частина сили Лоренца.'],
    ['Правило Ленца', 'Індукований струм напрямлений так, щоб протидіяти зміні потоку, що його викликала. Наслідок закону збереження енергії.'],
    ['Індуктивність', R`Коефіцієнт між струмом контуру і створеним ним потоком: ${'$\\Phi = LI/c$'} (СГС), ${'$\\Phi = LI$'} (СІ). Визначає «інерцію» струму та енергію магнітного поля.`],
    ['Проти-ЕРС', 'ЕРС, що індукується в обмотці двигуна під час обертання і напрямлена проти напруги живлення. Обмежує робочий струм; при пуску відсутня.'],
    ['Струми Фуко (вихрові)', 'Замкнені індуковані струми в масивних провідниках. Гальмують рух (магнітні гальма, демпфери) і нагрівають провідник (індукційний нагрів, втрати в осердях).'],
    ['Ковзання', R`$s = (\omega_п - \omega_р)/\omega_п$ — відносне відставання ротора асинхронного двигуна від обертового поля. Робоче $s\sim0.02$–$0.05$.`],
    ['Скін-ефект', R`Витіснення змінного струму (і поля) до поверхні провідника. Глибина $\delta\propto1/\sqrt{\sigma\omega}$.`],
    ['Шихтування', R`Набирання осердя з тонких ізольованих пластин. Втрати на вихрові струми $\propto d^2$, тож $n$ пластин зменшують їх у $n^2$ разів.`],
    ['Магнітне число Рейнольдса', R`$\mathrm{Rm} = 4\pi\sigma vl/c^2$ (СГС), $\mu_0\sigma vl$ (СІ) — відношення поля індукованих струмів до зовнішнього. При $\mathrm{Rm}\ll1$ індукованим полем можна нехтувати.`],
    ['Колектор', 'Розрізне кільце на валу з щітками, що перемикає напрям струму в обмотках ротора двигуна постійного струму щопівоберту.'],
    ['Інтегрувальний множник τ(t)', R`Для $I' + I/T = g(t)$ множник $\tau = e^{t/T}$ перетворює ліву частину на $(\tau I)'$.`],
  ];

  const el = h('div', {},
    h('h2', { class: 'sim-title' }, '4. Довідник'),
    h('div', { class: 'card theory', html: R`
<h3>Переведення одиниць СІ ↔ СГС (гаусова система)</h3>
<p>Значення $c = 2{,}99792458\cdot10^{10}$ см/с. Усередині симулятора фізика рахується лише в СГС, а перемикач у шапці змінює тільки відображення.</p>
<table class="ref"><tr><th>Величина</th><th>СІ</th><th>СГС</th><th>Точне співвідношення</th><th>Наближено</th></tr>
${units.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}
</table>
<h3>Формули: СГС → СІ</h3>
<table class="ref"><tr><th>Закон</th><th>СГС (гаусова)</th><th>СІ</th></tr>
${formulas.map((r) => `<tr><td>${r[0]}</td><td>$${r[1]}$</td><td>$${r[2]}$</td></tr>`).join('')}
</table>
<h4>Правила заміни при переході СГС → СІ</h4>
<table class="ref"><tr><th>СГС</th><th>→ СІ</th><th>Коментар</th></tr>
<tr><td>$B/c$ (у силі, ЕРС)</td><td>$B$</td><td>Сила Лоренца, закон Фарадея, ЕРС руху</td></tr>
<tr><td>$I/c$ (у силі Ампера, моменті)</td><td>$I$</td><td>$d\mathbf F$, $\mathfrak m = IS/c$</td></tr>
<tr><td>$\Phi/c$ (у законі Фарадея)</td><td>$\Phi$</td><td>$\varepsilon = -\frac1c\dot\Phi$</td></tr>
<tr><td>$L/c^2$</td><td>$L$</td><td>Самоіндукція, енергія, стала часу</td></tr>
<tr><td>$4\pi/c$ (у законі Ампера)</td><td>$\mu_0$</td><td>$\operatorname{rot}\mathbf B = \frac{4\pi}{c}\mathbf j$</td></tr>
<tr><td>$1$ (у полі диполя)</td><td>$\mu_0/4\pi$</td><td>$\mathbf B$ диполя, Біо–Савар</td></tr>
<tr><td>$1/(8\pi)$</td><td>$1/(2\mu_0)$</td><td>Густина енергії $B^2/8\pi$</td></tr>
<tr><td>$c^2/(4\pi\sigma)$</td><td>$1/(\mu_0\sigma)$</td><td>Коефіцієнт дифузії поля</td></tr>
</table>
<div class="callout"><b>Звідки береться $c$.</b> У гаусовій системі заряд визначено законом Кулона без коефіцієнта, $F = q_1q_2/r^2$, а $\mathbf E$ і $\mathbf B$ мають однакову розмірність. Тоді в будь-якому співвідношенні між магнітними та електричними величинами з'являється швидкість, і єдина фундаментальна швидкість електродинаміки — $c$. Добуток $v B/c$ має розмірність $E$. У СІ натомість $c$ «захована» в $\mu_0\varepsilon_0 = 1/c^2$, а $B$ має розмірність $E/v$.</div>
<h3>Провідності матеріалів (20 °C)</h3>
<table class="ref"><tr><th>Матеріал</th><th>$\sigma$, См/м</th><th>$\sigma$, с⁻¹ (СГС)</th><th>Густина, г/см³</th></tr>
${MATERIALS.filter((m) => m.sigma > 0).map((m) => `<tr><td>${m.name}</td><td>${fmtNum((m.sigma * 1e11) / (c * c), 3)}</td><td>${fmtNum(m.sigma, 3)}</td><td>${m.rho}</td></tr>`).join('')}
</table>
<h3>Глосарій</h3>
<table class="ref">${glossary.map((g) => `<tr><th style="width:220px">${g[0]}</th><td>${g[1]}</td></tr>`).join('')}</table>
<h3>Позначення в симуляторі</h3>
<p>$\tau(t)$ — інтегрувальний множник; $T$ — стала часу RL-кола (${'$L/c^2R$'} у СГС, $L/R$ у СІ); $\boldsymbol{\mathfrak m}$ — магнітний момент; $m, M$ — маси; $M$ у розділі 3 — момент сил; $J$ — момент інерції; $k_\Phi = NBS$ — потокозчеплення обмотки.</p>
` }),
  );
  renderMath(el);
  return { el, activate() {}, deactivate() {} };
}
