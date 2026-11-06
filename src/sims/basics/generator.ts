// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/** 1b. Рамка, що обертається в однорідному полі — генератор змінного струму (вигляд згори). */
import { Generator } from '../../physics/generator';
import { fromSys } from '../../physics/units';
import { SimPage } from '../../ui/simpage';
import { slider, select, checkbox } from '../../ui/controls';
import { LiveChart, EnergyChart } from '../../ui/chart';
import { arrow, COL, currentColor, fieldSymbol, galvanometer, text, AutoScale } from '../../ui/draw';
import { units } from '../../ui/units-store';
import { generatorTheory, generatorQuiz } from './theory';

/** Дугова стрілка навколо (cx, cy) радіуса r; dir = ±1 (проти/за год. стрілкою на екрані). */
export function arcArrow(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, span: number,
  dir: number, color: string, width = 3,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  // на екрані y вниз: «проти год. стрілки» = зменшення екранного кута
  const s = -dir;
  ctx.arc(cx, cy, r, a0, a0 + s * span, s < 0);
  ctx.stroke();
  const ae = a0 + s * span;
  const ex = cx + r * Math.cos(ae), ey = cy + r * Math.sin(ae);
  const tx = -Math.sin(ae) * s, ty = Math.cos(ae) * s;
  arrow(ctx, ex - tx * 2, ey - ty * 2, ex + tx * 6, ey + ty * 6, color, width, 11);
}

export function createGeneratorSim(): SimPage {
  const page = new SimPage(
    '1b. Генератор змінного струму: рамка в однорідному полі',
    'Вигляд згори вздовж осі обертання. Сторони рамки (⊙/⊗ — напрям струму) перетинають лінії поля, ' +
      'на них діють сили Ампера, що створюють <b>гальмівний момент</b>.',
    0.52,
  );
  const ohm = (x: number) => fromSys(x, 'resistance', 'SI');
  const henry = (x: number) => fromSys(x, 'inductance', 'SI');
  const g = new Generator({ B: 2000, S: 100, N: 100, R: ohm(1), L: henry(0.01), J: 6e5, driven: false, omegaDrive: 20 }, 20);
  let omega0 = 20;
  let rSet = g.p.R;
  let open = false;

  const restart = () => {
    g.reset(omega0);
    eChart.clear();
    charts.forEach((c) => c.clear());
  };

  page.params.append(
    select<'free' | 'drive'>('Режим', [
      { value: 'free', text: 'Вільне обертання (поштовх)' },
      { value: 'drive', text: 'Привід: ω = const' },
    ], 'free', (v) => { g.p.driven = v === 'drive'; restart(); }).el,
    slider({ label: 'Початкова / задана ω', dim: 'omega', min: 1, max: 100, value: omega0, log: true, onChange: (v) => { omega0 = v; g.p.omegaDrive = v; if (g.p.driven) g.y[1] = v; } }).el,
    slider({ label: 'Індукція поля B', dim: 'B', min: 100, max: 15000, value: g.p.B, log: true, onChange: (v) => (g.p.B = v) }).el,
    slider({ label: 'Кількість витків N', dim: 'none', min: 1, max: 500, value: g.p.N, log: true, integer: true, onChange: (v) => (g.p.N = v) }).el,
    slider({ label: 'Площа рамки S', dim: 'area', min: 10, max: 500, value: g.p.S, log: true, onChange: (v) => (g.p.S = v) }).el,
    slider({ label: 'Опір кола R', dim: 'resistance', min: ohm(0.05), max: ohm(100), value: g.p.R, log: true, onChange: (v) => { rSet = v; if (!open) g.p.R = v; } }).el,
    slider({ label: 'Індуктивність L', dim: 'inductance', min: 0, max: henry(0.2), value: g.p.L, onChange: (v) => { g.p.L = v; g.y[2] = 0; } }).el,
    slider({ label: 'Момент інерції J', dim: 'inertia', min: 5e4, max: 1e7, value: g.p.J, log: true, onChange: (v) => (g.p.J = v) }).el,
    checkbox('Розімкнути коло (R → ∞)', false, (v) => { open = v; g.p.R = v ? ohm(1e9) : rSet; }),
  );

  const fluxChart = page.addChart(new LiveChart(page.chartsEl, { title: 'Потік Φ(t) = NBS cos φ', yDim: 'flux', series: [{ label: 'Φ', color: COL.bExt }] }));
  const emfChart = page.addChart(new LiveChart(page.chartsEl, { title: 'ЕРС ε(t)', yDim: 'voltage', series: [{ label: 'ε', color: COL.bInd }] }));
  const curChart = page.addChart(new LiveChart(page.chartsEl, { title: 'Струм I(t)', yDim: 'current', series: [{ label: 'I', color: COL.cur }] }));
  const eChart = page.addChart(new EnergyChart(page.chartsEl));
  const charts = [fluxChart, emfChart, curChart];

  const iS = new AutoScale(0.998), eS = new AutoScale(0.998);

  page.hooks = {
    step: (dt) => g.step(dt),
    sample() {
      fluxChart.push(g.t, [g.flux()]);
      emfChart.push(g.t, [g.emf()]);
      curChart.push(g.t, [g.current()]);
      eChart.push(g.t, g.energies());
    },
    reset: restart,
    draw(ctx, W, H) {
      const cx = W * 0.42, cy = H / 2;
      const rw = H * 0.32;
      // полюси
      ctx.fillStyle = COL.north;
      ctx.fillRect(cx - rw - 110, cy - H * 0.38, 50, H * 0.76);
      ctx.fillStyle = COL.south;
      ctx.fillRect(cx + rw + 60, cy - H * 0.38, 50, H * 0.76);
      text(ctx, 'N', cx - rw - 85, cy + 6, '#fff', 'center', 20, 'bold');
      text(ctx, 'S', cx + rw + 85, cy + 6, '#fff', 'center', 20, 'bold');
      if (page.showLines) {
        for (let k = -4; k <= 4; k++) {
          const y = cy + k * H * 0.085;
          ctx.strokeStyle = 'rgba(78,168,255,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx - rw - 60, y); ctx.lineTo(cx + rw + 60, y); ctx.stroke();
          arrow(ctx, cx - rw - 30, y, cx - rw - 14, y, 'rgba(78,168,255,0.7)', 1.2, 6);
          arrow(ctx, cx + rw + 20, y, cx + rw + 36, y, 'rgba(78,168,255,0.7)', 1.2, 6);
        }
        text(ctx, 'B', cx + rw + 40, cy - H * 0.36 - 4, COL.bExt, 'left', 13, 'bold');
      }

      const phi = g.y[0];
      const I = g.current();
      const frac = Math.abs(I) / iS.update(I);
      // t = (−sin φ, cos φ) у математичних координатах (y вгору)
      const tx = -Math.sin(phi), ty = Math.cos(phi);
      const p1 = [cx + rw * tx, cy - rw * ty], p2 = [cx - rw * tx, cy + rw * ty];
      ctx.strokeStyle = COL.copper;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      ctx.strokeStyle = currentColor(frac, 0.7);
      ctx.lineWidth = 3;
      ctx.stroke();
      // нормаль n
      const nx = Math.cos(phi), ny = Math.sin(phi);
      ctx.setLineDash([5, 4]);
      arrow(ctx, cx, cy, cx + nx * rw * 0.7, cy - ny * rw * 0.7, '#d6dde8', 1.5, 8);
      ctx.setLineDash([]);
      text(ctx, 'n', cx + nx * rw * 0.78, cy - ny * rw * 0.78, '#d6dde8', 'center', 13);
      // індуковане поле (магнітний момент рамки 𝔪 = NIS/c уздовж ±n)
      if (frac > 0.03) {
        const s = Math.sign(I) * Math.min(1, frac);
        arrow(ctx, cx, cy, cx + nx * rw * 0.55 * s, cy - ny * rw * 0.55 * s, COL.bInd, 4, 12);
        text(ctx, 'B інд', cx + nx * rw * 0.55 * s + 8, cy - ny * rw * 0.55 * s - 8, COL.bInd, 'left', 12, 'bold');
      }
      // сторони рамки: I>0 → у точці +t струм «на нас» (⊙)
      const out1 = I >= 0;
      for (const [p, out] of [[p1, out1], [p2, !out1]] as const) {
        ctx.fillStyle = '#0a0d12';
        ctx.beginPath(); ctx.arc(p[0], p[1], 11, 0, 2 * Math.PI); ctx.fill();
        fieldSymbol(ctx, p[0], p[1], 10, out, frac > 0.03 ? COL.cur : COL.muted);
      }
      // сили Ампера: на +t сторону F = (I l B / c) ŷ
      if (frac > 0.03) {
        const L = 70 * Math.min(1, frac);
        const s = Math.sign(I);
        arrow(ctx, p1[0], p1[1] - 14 * s, p1[0], p1[1] - (14 + L) * s, COL.force, 3, 10);
        arrow(ctx, p2[0], p2[1] + 14 * s, p2[0], p2[1] + (14 + L) * s, COL.force, 3, 10);
        text(ctx, 'F', p1[0] + 8, p1[1] - (14 + L) * s, COL.force, 'left', 13, 'bold');
      }
      // момент і ω (дугові стрілки)
      const M = g.torque();
      const w = g.y[1];
      arcArrow(ctx, cx, cy, rw + 26, -Math.PI / 2 - 0.5, 1.0, Math.sign(w) || 1, '#d6dde8', 2);
      text(ctx, 'ω', cx + 6, cy - rw - 34, '#d6dde8', 'left', 14, 'bold');
      if (Math.abs(M) > 0 && frac > 0.03) {
        arcArrow(ctx, cx, cy, rw + 26, Math.PI / 2 - 0.5, 1.0, Math.sign(M), COL.force, 3);
        text(ctx, 'M (Ленц)', cx + 8, cy + rw + 46, COL.force, 'left', 13, 'bold');
      }
      galvanometer(ctx, W - 80, 75, 58, g.emf() / eS.update(g.emf()), 'ε');
      text(ctx, `φ = ${((((phi * 180) / Math.PI) % 360) + 360) % 360 | 0}°`, W - 80, 115, COL.muted, 'center', 12);
    },
    updateNow(now) {
      const f = units.fmt;
      now.set('Кут φ (між n і B)', `${(((((g.y[0] * 180) / Math.PI) % 360) + 360) % 360).toFixed(0)}°`);
      now.set('Кутова швидкість ω', f(g.y[1], 'omega'));
      now.set('Потік Φ', f(g.flux(), 'flux'));
      now.set('ЕРС ε', f(g.emf(), 'voltage'));
      now.set('Амплітуда ЕРС NBSω/c', f((g.p.N * g.p.B * g.p.S * Math.abs(g.y[1])) / 2.99792458e10, 'voltage'));
      now.set('Струм I', f(g.current(), 'current'));
      now.set('Момент сил M', f(g.torque(), 'torque'));
      now.set('Електрична потужність εI', f(g.emf() * g.current(), 'power'));
      now.set('Стала часу T', f(g.T, 'time'));
      const e = g.energies();
      now.set('Тепло Q', f(e.heat, 'energy'));
      now.setNote(
        'Момент сил Ампера завжди напрямлений <b>проти обертання</b> (червона дуга проти білої): механічна потужність ' +
          'Mω = −εI переходить в електричну. Розімкніть коло — струму немає, і рамка крутиться без гальмування.',
      );
    },
  };

  restart();
  const iS3 = new AutoScale(0.999), eS3 = new AutoScale(0.999);
  page.enable3D(() => import('../../sims3d/generator').then((mod) => mod.generatorScene(() => ({ g, iRef: iS3.update(g.current()), eRef: eS3.update(g.emf()) }))));
  page.setTheory(generatorTheory());
  page.setQuiz(generatorQuiz);
  return page;
}
