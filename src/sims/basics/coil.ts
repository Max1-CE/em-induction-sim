// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/** 1a. Магніт рухається крізь котушку; гальванометр показує ЕРС. */
import { CoilMagnet } from '../../physics/coilMagnet';
import { fromSys } from '../../physics/units';
import { C, MAGNETIZATION_NDFEB } from '../../physics/constants';
import { SimPage } from '../../ui/simpage';
import { slider, select, checkbox } from '../../ui/controls';
import { LiveChart, EnergyChart } from '../../ui/chart';
import { arrow, COL, currentColor, galvanometer, magnet, text, AutoScale } from '../../ui/draw';
import { units } from '../../ui/units-store';
import { coilTheory, coilQuiz } from './theory';

type Mode = 'auto' | 'mouse' | 'free';

export function createCoilSim(): SimPage {
  const page = new SimPage(
    '1a. Магніт і котушка: закон Фарадея та правило Ленца',
    'Магніт рухається вздовж осі котушки. Змінюється потік Φ → виникає ЕРС → у замкненому колі тече струм, ' +
      'поле якого <b>протидіє зміні потоку</b>. Режим «мишка»: перетягуйте магніт.',
    0.5,
  );
  const ohm = (x: number) => fromSys(x, 'resistance', 'SI');
  const sim = new CoilMagnet({ m: MAGNETIZATION_NDFEB * 2, mass: 15, a: 2.5, N: 400, len: 6, R: ohm(0.5), selfInduction: true }, -25, 0);
  let mode: Mode = 'auto';
  let v0 = 80;
  let flip = false;
  const ZMAX = 25;
  let mouseTarget = -ZMAX;
  let dragging = false;
  const mBase = { value: sim.p.m };

  const triangle = (t: number) => {
    const P = 4 * ZMAX;
    const s = (((t * v0) % P) + P) % P;
    return s < 2 * ZMAX ? { z: -ZMAX + s, v: v0 } : { z: 3 * ZMAX - s, v: -v0 };
  };

  const applyMode = () => {
    sim.p.m = flip ? -mBase.value : mBase.value;
    if (mode === 'auto') {
      sim.motion = triangle;
      sim.reset(-ZMAX, v0);
    } else if (mode === 'mouse') {
      sim.reset(mouseTarget, 0);
      sim.motion = (t) => ({ z: sim.y[0], v: 0 * t });
    } else {
      sim.motion = null;
      sim.reset(-ZMAX, v0);
    }
    eChart.clear();
    charts.forEach((c) => c.clear());
  };

  // ── Параметри ──────────────────────────────────────────────────────────────
  const P = page.params;
  P.append(
    select<Mode>('Режим руху', [
      { value: 'auto', text: 'Привід: туди-назад зі сталою швидкістю' },
      { value: 'free', text: 'Вільний проліт (поштовх, без тертя)' },
      { value: 'mouse', text: 'Мишка: перетягуйте магніт' },
    ], mode, (v) => { mode = v; applyMode(); }).el,
    slider({ label: 'Швидкість v₀', dim: 'velocity', min: 10, max: 400, value: v0, log: true, onChange: (v) => { v0 = v; if (mode !== 'mouse') applyMode(); } }).el,
    slider({ label: 'Магнітний момент 𝔪', dim: 'moment', min: 100, max: 2e4, value: mBase.value, log: true, onChange: (v) => { mBase.value = v; sim.p.m = flip ? -v : v; } }).el,
    slider({ label: 'Маса магніту m', dim: 'mass', min: 2, max: 100, value: sim.p.mass, log: true, onChange: (v) => (sim.p.mass = v) }).el,
    slider({ label: 'Кількість витків N', dim: 'none', min: 10, max: 2000, value: sim.p.N, log: true, integer: true, onChange: (v) => (sim.p.N = v) }).el,
    slider({ label: 'Радіус котушки a', dim: 'length', min: 1, max: 6, value: sim.p.a, onChange: (v) => (sim.p.a = v) }).el,
    slider({ label: 'Довжина котушки ℓ', dim: 'length', min: 1, max: 20, value: sim.p.len, onChange: (v) => (sim.p.len = v) }).el,
    slider({ label: 'Опір кола R', dim: 'resistance', min: ohm(0.01), max: ohm(100), value: sim.p.R, log: true, onChange: (v) => (sim.p.R = v) }).el,
    checkbox('Враховувати самоіндукцію L', true, (v) => { sim.p.selfInduction = v; sim.y[2] = 0; }),
    checkbox('Перевернути магніт (N ↔ S)', false, (v) => { flip = v; sim.p.m = v ? -mBase.value : mBase.value; }),
  );

  // ── Графіки ────────────────────────────────────────────────────────────────
  const fluxChart = page.addChart(new LiveChart(page.chartsEl, { title: 'Потік через котушку Φ(t)', yDim: 'flux', series: [{ label: 'Φ', color: COL.bExt }] }));
  const emfChart = page.addChart(new LiveChart(page.chartsEl, { title: 'ЕРС індукції ε(t)', yDim: 'voltage', series: [{ label: 'ε', color: COL.bInd }] }));
  const curChart = page.addChart(new LiveChart(page.chartsEl, { title: 'Струм I(t) та сила на магніт', yDim: 'current', series: [{ label: 'I', color: COL.cur }] }));
  const eChart = page.addChart(new EnergyChart(page.chartsEl));
  const charts = [fluxChart, emfChart, curChart];

  // ── Мишка ─────────────────────────────────────────────────────────────────
  let scale = 16; // пікс/см
  let cx = 400;
  page.canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'mouse') return;
    dragging = true;
    page.canvas.setPointerCapture(e.pointerId);
    mouseTarget = (page.mouse(e)[0] - cx) / scale;
  });
  page.canvas.addEventListener('pointermove', (e) => {
    if (dragging) mouseTarget = Math.max(-ZMAX - 5, Math.min(ZMAX + 5, (page.mouse(e)[0] - cx) / scale));
  });
  page.canvas.addEventListener('pointerup', () => (dragging = false));

  const emfScale = new AutoScale(0.998);
  const iScale = new AutoScale(0.998);
  const fScale = new AutoScale(0.998);

  page.hooks = {
    step(dt) {
      if (mode === 'mouse') {
        // Рух за мишкою: лінійний відрізок z(t) протягом кадру (обмежуємо швидкість)
        const z0 = sim.y[0];
        const vMax = 600;
        const z1 = z0 + Math.max(-vMax * dt, Math.min(vMax * dt, mouseTarget - z0));
        const t0 = sim.t;
        sim.motion = (t) => ({ z: z0 + ((z1 - z0) * (t - t0)) / dt, v: (z1 - z0) / dt });
        sim.step(dt);
        sim.motion = (t) => ({ z: z1, v: 0 * t });
        sim.y[1] = (z1 - z0) / dt;
      } else {
        sim.step(dt);
        if (mode === 'free' && Math.abs(sim.y[0]) > ZMAX + 3) {
          // пружне відбиття від «стінок» — кінетична енергія зберігається
          sim.y[0] = Math.sign(sim.y[0]) * (ZMAX + 3);
          sim.y[1] = -sim.y[1];
        }
      }
    },
    sample() {
      const t = sim.t;
      fluxChart.push(t, [sim.flux()]);
      emfChart.push(t, [sim.emf()]);
      curChart.push(t, [sim.current()]);
      eChart.push(t, sim.energies());
    },
    reset() {
      applyMode();
    },
    draw(ctx, W, H) {
      scale = W / (2 * ZMAX + 14);
      cx = W / 2;
      const cy = H * 0.56;
      const z = sim.y[0];
      const mx = cx + z * scale;
      const a = sim.p.a * scale;
      const halfLen = (sim.p.len * scale) / 2;
      const I = sim.current();
      const iS = iScale.update(I);
      const F = sim.force();
      const fS = fScale.update(F);
      const eps = sim.emf();
      const eS = emfScale.update(eps);
      const dir = Math.sign(sim.p.m) || 1;

      // силові лінії диполя: r = r₀ sin²θ
      if (page.showLines) {
        ctx.lineWidth = 1;
        for (const r0 of [3, 5, 8, 12, 18, 28, 45]) {
          ctx.strokeStyle = 'rgba(78,168,255,0.35)';
          for (const sgn of [1, -1]) {
            ctx.beginPath();
            for (let k = 0; k <= 120; k++) {
              const th = 0.02 + (k / 120) * (Math.PI - 0.04);
              const r = r0 * Math.sin(th) ** 2;
              const px = mx + dir * r * Math.cos(th) * scale;
              const py = cy - sgn * r * Math.sin(th) * scale;
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
            // стрілка в найвіддаленішій точці (θ = π/2): поле напрямлене до S
            const py = cy - sgn * r0 * scale;
            arrow(ctx, mx + 4 * dir, py, mx - 4 * dir, py, 'rgba(78,168,255,0.7)', 1.2, 6);
          }
        }
      }

      // задні половинки витків
      const nDraw = Math.max(3, Math.min(28, Math.round(sim.p.N / 15)));
      const turnX = (k: number) => cx - halfLen + (nDraw === 1 ? halfLen : (2 * halfLen * k) / (nDraw - 1));
      ctx.lineWidth = 2;
      for (let k = 0; k < nDraw; k++) {
        ctx.strokeStyle = 'rgba(200,121,74,0.35)';
        ctx.beginPath();
        ctx.ellipse(turnX(k), cy, a * 0.25, a, 0, Math.PI / 2, (3 * Math.PI) / 2);
        ctx.stroke();
      }

      // індуковане поле на осі котушки (помаранчеве) — для I>0 напрямлене вздовж +z
      if (Math.abs(I) > 1e-3 * iS) {
        const len = 70 * Math.min(1, Math.abs(I) / iS);
        const s = Math.sign(I);
        arrow(ctx, cx - (s * len) / 2, cy - a - 26, cx + (s * len) / 2, cy - a - 26, COL.bInd, 3, 11);
        text(ctx, 'B інд', cx, cy - a - 34, COL.bInd, 'center', 12, 'bold');
        if (page.showLines) {
          ctx.strokeStyle = `rgba(255,166,61,${0.15 + 0.6 * Math.min(1, Math.abs(I) / iS)})`;
          ctx.lineWidth = 1.2;
          for (const k of [0.35, 0.7]) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, halfLen + a * 1.6 * k + 18, a * (1 + 1.4 * k), 0, 0, 2 * Math.PI);
            ctx.stroke();
          }
          for (const yy of [-0.45, 0, 0.45]) arrow(ctx, cx - s * 14, cy + yy * a, cx + s * 14, cy + yy * a, COL.bInd, 1.5, 6);
        }
      }

      // магніт (вісь S→N уздовж ±z)
      magnet(ctx, mx, cy, 3.2 * scale, 1.3 * scale, dir > 0 ? 0 : Math.PI);

      // передні половинки витків — колір і стрілки струму
      const frac = Math.abs(I) / iS;
      ctx.lineWidth = 2.5;
      for (let k = 0; k < nDraw; k++) {
        ctx.strokeStyle = COL.copper;
        ctx.beginPath();
        ctx.ellipse(turnX(k), cy, a * 0.25, a, 0, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.strokeStyle = currentColor(frac, 0.9);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      // стрілки струму на передній стороні: I>0 (проти год. стрілки, якщо дивитись з +z) → вгору
      if (frac > 0.02) {
        const s = Math.sign(I);
        for (const k of [0, Math.floor(nDraw / 2), nDraw - 1]) {
          const x = turnX(k) + a * 0.25;
          arrow(ctx, x + 6, cy + s * 10, x + 6, cy - s * 10, COL.cur, 2, 7);
        }
        text(ctx, 'I', turnX(nDraw - 1) + a * 0.25 + 14, cy + 4, COL.cur, 'left', 13, 'bold');
      }

      // сила на магніт (червона) — завжди проти швидкості
      if (Math.abs(F) > 1e-3 * fS) {
        const L = 80 * Math.min(1, Math.abs(F) / fS);
        arrow(ctx, mx, cy + 1.3 * scale, mx + Math.sign(F) * L, cy + 1.3 * scale, COL.force, 3.5, 12);
        text(ctx, 'F (Ленц)', mx + Math.sign(F) * (L + 6), cy + 1.3 * scale + 4, COL.force, F > 0 ? 'left' : 'right', 12, 'bold');
      }
      // швидкість
      const v = sim.y[1];
      if (Math.abs(v) > 0.5) {
        const L = 25 + 35 * Math.min(1, Math.abs(v) / 300);
        arrow(ctx, mx, cy - 1.1 * scale, mx + Math.sign(v) * L, cy - 1.1 * scale, '#d6dde8', 2, 8);
        text(ctx, 'v', mx + Math.sign(v) * (L + 6), cy - 1.1 * scale + 4, '#d6dde8', v > 0 ? 'left' : 'right', 12);
      }

      // проводи до гальванометра
      const gx = W - 85, gy = 70;
      ctx.strokeStyle = currentColor(frac, 0.8);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + halfLen, cy + a);
      ctx.lineTo(cx + halfLen, H - 14);
      ctx.lineTo(W - 20, H - 14);
      ctx.lineTo(W - 20, gy + 8);
      ctx.lineTo(gx + 55, gy + 8);
      ctx.moveTo(cx - halfLen, cy + a);
      ctx.lineTo(cx - halfLen, H - 6);
      ctx.lineTo(W - 10, H - 6);
      ctx.lineTo(W - 10, gy + 18);
      ctx.stroke();
      galvanometer(ctx, gx, gy, 55, eps / eS, 'ε, гальванометр');

      text(ctx, 'синє — поле магніту, помаранчеве — поле індукованого струму, червоне — сила протидії', 10, 18, COL.muted, 'left', 11.5);
      if (mode === 'mouse') text(ctx, 'Перетягуйте магніт мишкою ↔', 10, 34, COL.text, 'left', 12);
    },
    updateNow(now) {
      const fmt = units.fmt;
      const dPhidt = sim.fluxDz() * sim.y[1];
      now.set('Положення магніту z', fmt(sim.y[0], 'length'));
      now.set('Швидкість v', fmt(sim.y[1], 'velocity'));
      now.set('Потік Φ', fmt(sim.flux(), 'flux'));
      now.set(units.sys === 'SI' ? 'dΦ/dt' : '(1/c)·dΦ/dt', fmt(dPhidt / C, 'voltage'));
      now.set('ЕРС ε', fmt(sim.emf(), 'voltage'));
      now.set('Струм I', fmt(sim.current(), 'current'));
      now.set('Сила на магніт F', fmt(sim.force(), 'force'));
      now.set('Стала часу T', fmt(sim.T, 'time'));
      now.set('Індуктивність L', fmt(sim.L, 'inductance'));
      const e = sim.energies();
      now.set('Джоулеве тепло Q', fmt(e.heat, 'energy'));
      let note: string;
      if (Math.abs(dPhidt) < 1e-6 * Math.abs(sim.p.m)) {
        note = 'Потік не змінюється → ЕРС і струм відсутні (окрім затухання через самоіндукцію).';
      } else if (dPhidt * Math.sign(sim.p.m) > 0) {
        note = 'Потік через котушку <b>зростає</b> → індукований струм створює поле, <b>протилежне</b> полю магніту ' +
          '(помаранчева стрілка проти синіх ліній). Котушка відштовхує магніт — сила F проти руху.';
      } else {
        note = 'Потік через котушку <b>спадає</b> → індуковане поле <b>підтримує</b> зовнішнє (того ж напрямку). ' +
          'Котушка притягує магніт назад — знову гальмування. Це і є правило Ленца.';
      }
      now.setNote(note);
    },
  };

  applyMode();
  page.setTheory(coilTheory());
  page.setQuiz(coilQuiz);
  return page;
}
