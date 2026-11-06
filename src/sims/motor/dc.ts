// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/** 3a. Колекторний двигун постійного струму / генератор. */
import { DCMotor, type DCMotorParams } from '../../physics/dcMotor';
import { fromSys } from '../../physics/units';
import { SimPage } from '../../ui/simpage';
import { slider, select } from '../../ui/controls';
import { LiveChart, EnergyChart, XYPlot } from '../../ui/chart';
import { arrow, COL, currentColor, fieldSymbol, text, AutoScale } from '../../ui/draw';
import { units } from '../../ui/units-store';
import { arcArrow } from '../basics/generator';
import { dcTheory, dcQuiz } from './theory';

export function createDCSim(): SimPage {
  const page = new SimPage(
    '3a. Двигун постійного струму з колектором (і режим генератора)',
    'Вигляд уздовж осі. Колектор (розрізне кільце в центрі) перемикає струм у котушці щопівоберту, тому момент не змінює знака. ' +
      'Помаранчевий стовпчик праворуч — <b>проти-ЕРС</b>: прояв правила Ленца в двигуні.',
    0.52,
  );
  const ohm = (x: number) => fromSys(x, 'resistance', 'SI');
  const henry = (x: number) => fromSys(x, 'inductance', 'SI');
  const volt = (x: number) => fromSys(x, 'voltage', 'SI');
  const wb = (x: number) => fromSys(x, 'flux', 'SI');
  const nm = (x: number) => fromSys(x, 'torque', 'SI');
  const kgm2 = (x: number) => fromSys(x, 'inertia', 'SI');
  const p: DCMotorParams = {
    U: volt(12), R: ohm(1), Rload: 0, L: henry(2e-3), k: wb(0.02), J: kgm2(2e-5), b: nm(1e-6), Mload: nm(0.02), coils: 1,
  };
  const m = new DCMotor(p);
  let mode: 'motor' | 'gen' = 'motor';
  let Uset = p.U, Mset = p.Mload, Mdrive = nm(0.03), Rl = ohm(5);

  const applyMode = () => {
    if (mode === 'motor') { p.U = Uset; p.Rload = 0; p.Mload = Mset; }
    else { p.U = 0; p.Rload = Rl; p.Mload = -Mdrive; }
  };
  const restart = () => {
    applyMode();
    m.reset();
    [wChart, iChart, mChart, pChart].forEach((c) => c.clear());
    eChart.clear();
    updateChar();
  };

  const motorBox = document.createElement('div');
  const genBox = document.createElement('div');
  genBox.style.display = 'none';
  motorBox.append(
    slider({ label: 'Напруга живлення U', dim: 'voltage', min: 0, max: volt(24), value: Uset, onChange: (v) => { Uset = v; applyMode(); updateChar(); } }).el,
    slider({ label: 'Момент навантаження M_нав', dim: 'torque', min: 0, max: nm(0.2), value: Mset, onChange: (v) => { Mset = v; applyMode(); updateChar(); } }).el,
  );
  genBox.append(
    slider({ label: 'Момент приводу (турбіна)', dim: 'torque', min: 0, max: nm(0.1), value: Mdrive, onChange: (v) => { Mdrive = v; applyMode(); } }).el,
    slider({ label: 'Опір навантаження R_н', dim: 'resistance', min: ohm(0.5), max: ohm(200), value: Rl, log: true, onChange: (v) => { Rl = v; applyMode(); } }).el,
  );
  page.params.append(
    select<'motor' | 'gen'>('Режим', [{ value: 'motor', text: 'Двигун (живлення U)' }, { value: 'gen', text: 'Генератор (вал крутить зовнішній момент)' }], mode, (v) => {
      mode = v;
      motorBox.style.display = v === 'motor' ? '' : 'none';
      genBox.style.display = v === 'gen' ? '' : 'none';
      restart();
    }).el,
    motorBox,
    genBox,
    select('Обмотка якоря', [
      { value: '1', text: '1 котушка (2 пластини колектора)' },
      { value: '2', text: '2 котушки' },
      { value: '3', text: '3 котушки' },
      { value: '0', text: 'Ідеальний колектор (багато котушок)' },
    ], '1', (v) => { p.coils = Number(v); }).el,
    slider({ label: 'Потокозчеплення k_Φ = NBS', dim: 'flux', min: wb(0.005), max: wb(0.1), value: p.k, log: true, onChange: (v) => { p.k = v; updateChar(); } }).el,
    slider({ label: 'Опір якоря R', dim: 'resistance', min: ohm(0.1), max: ohm(10), value: p.R, log: true, onChange: (v) => { p.R = v; updateChar(); } }).el,
    slider({ label: 'Індуктивність якоря L', dim: 'inductance', min: 0, max: henry(0.02), value: p.L, onChange: (v) => { p.L = v; m.y[2] = m.current(); } }).el,
    slider({ label: 'Момент інерції J', dim: 'inertia', min: kgm2(2e-6), max: kgm2(5e-4), value: p.J, log: true, onChange: (v) => (p.J = v) }).el,
    slider({ label: 'В\'язке тертя b', dim: 'angDamping', min: 0, max: nm(1e-4), value: p.b, onChange: (v) => { p.b = v; updateChar(); } }).el,
  );

  const wChart = page.addChart(new LiveChart(page.chartsEl, { title: 'Кутова швидкість ω(t)', yDim: 'omega', series: [{ label: 'ω', color: '#d6dde8', width: 2 }] }));
  const iChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'Струм I(t): пусковий ≫ робочий через проти-ЕРС', yDim: 'current', series: [{ label: 'I', color: COL.cur, width: 2 }],
  }));
  const mChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'Моменти M(t)', yDim: 'torque',
    series: [{ label: 'M_ел', color: COL.force, width: 2 }, { label: 'M_нав', color: '#9ca3af', dash: [5, 4] }],
  }));
  const pChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'Баланс потужностей: UI = I²R + bω² + M_нав·ω + d/dt(Jω²/2 + LI²/2c²)', yDim: 'power',
    series: [
      { label: 'UI', color: '#ffffff', width: 2 },
      { label: 'I²R + bω²', color: '#ff7a59' },
      { label: 'M_нав·ω', color: '#6aa9ff' },
      { label: 'dE/dt', color: '#c084fc', dash: [4, 4] },
    ],
  }));
  const charPlot = page.addChart(new XYPlot(page.chartsEl, { title: 'Механічна характеристика ω(M) (усталений режим)', xDim: 'torque', yDim: 'omega', xName: 'M', yName: 'ω' }));
  const etaPlot = page.addChart(new XYPlot(page.chartsEl, { title: 'ККД η(M) = Mω/(UI)', xDim: 'torque', yDim: 'percent', xName: 'M', yName: 'η' }));
  const eChart = page.addChart(new EnergyChart(page.chartsEl, 'Баланс енергії: ½Jω² + W_L + Q − (A_джерела − A_нав) = const'));

  const updateChar = () => {
    if (mode !== 'motor') return;
    const Ms = m.stallTorque;
    const pts: [number, number][] = [], eta: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const M = (Ms * i) / 100;
      pts.push([M, Math.max(0, m.steadyOmega(M))]);
      eta.push([M, 100 * m.efficiency(M)]);
    }
    charPlot.curves = [{ pts, color: '#d6dde8', label: 'ω(M)' }];
    etaPlot.curves = [{ pts: eta, color: COL.good, label: 'η(M)' }];
    etaPlot.yRange = [0, 100];
  };

  let lastE = 0, lastT = 0;
  const iS = new AutoScale(0.999);

  page.hooks = {
    step: (dt) => m.step(dt),
    sample() {
      const I = m.current(), w = m.y[0];
      wChart.push(m.t, [w]);
      iChart.push(m.t, [I]);
      mChart.push(m.t, [m.torque(), p.Mload]);
      const e = m.energies();
      const E = e.mech + e.mag;
      const dE = m.t > lastT ? (E - lastE) / (m.t - lastT) : 0;
      lastE = E; lastT = m.t;
      pChart.push(m.t, [p.U * I, I * I * m.Rtot + p.b * w * w, p.Mload * w, dE]);
      eChart.push(m.t, e);
      if (mode === 'motor') {
        charPlot.markers = [{ x: m.torque(), y: w, color: COL.force, label: 'зараз' }];
        etaPlot.markers = p.U * I > 0 ? [{ x: p.Mload, y: (100 * p.Mload * w) / (p.U * I), color: COL.force }] : [];
      }
    },
    reset: restart,
    draw(ctx, W, H) {
      const cx = W * 0.4, cy = H / 2, rw = H * 0.3;
      // полюси статора
      ctx.fillStyle = COL.north;
      ctx.fillRect(cx - rw - 100, cy - H * 0.36, 48, H * 0.72);
      ctx.fillStyle = COL.south;
      ctx.fillRect(cx + rw + 52, cy - H * 0.36, 48, H * 0.72);
      text(ctx, 'N', cx - rw - 76, cy + 6, '#fff', 'center', 20, 'bold');
      text(ctx, 'S', cx + rw + 76, cy + 6, '#fff', 'center', 20, 'bold');
      if (page.showLines)
        for (let k = -4; k <= 4; k++) {
          const y = cy + k * H * 0.08;
          ctx.strokeStyle = 'rgba(78,168,255,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx - rw - 52, y); ctx.lineTo(cx + rw + 52, y); ctx.stroke();
          arrow(ctx, cx + rw + 26, y, cx + rw + 42, y, 'rgba(78,168,255,0.7)', 1.2, 6);
        }
      const phi = m.y[1];
      const I = m.current();
      const frac = Math.abs(I) / iS.update(I);
      const n = Math.max(1, p.coils || 6);
      for (let j = 0; j < n; j++) {
        const pj = phi + (Math.PI * j) / n;
        const tx = -Math.sin(pj), ty = Math.cos(pj);
        const a = [cx + rw * tx, cy - rw * ty], b = [cx - rw * tx, cy + rw * ty];
        // струм котушки після комутації: s_j = −sign(sin φ_j)·sign(I)
        const sj = -Math.sign(Math.sin(pj)) * Math.sign(I);
        const fj = frac;
        ctx.strokeStyle = COL.copper;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        for (const [pt, out] of [[a, sj > 0], [b, sj < 0]] as const) {
          ctx.fillStyle = '#0a0d12';
          ctx.beginPath(); ctx.arc(pt[0], pt[1], 10, 0, 2 * Math.PI); ctx.fill();
          fieldSymbol(ctx, pt[0], pt[1], 9, out, fj > 0.03 ? currentColor(fj) : COL.muted);
        }
        // сили Ампера: на +t провід при s_j>0 — вгору
        // сила на провід ∝ I (не залежить від кута), але момент ∝ |sin φ_j| — плече сили
        if (frac > 0.03 && n <= 3) {
          const L = 60 * Math.min(1, frac);
          arrow(ctx, a[0], a[1] - 12 * sj, a[0], a[1] - (12 + L) * sj, COL.force, 2.5, 9);
          arrow(ctx, b[0], b[1] + 12 * sj, b[0], b[1] + (12 + L) * sj, COL.force, 2.5, 9);
        }
      }
      // колектор: розрізне кільце, проміжки вздовж площини котушки 0
      const rc = 22;
      const t0 = Math.atan2(-Math.cos(phi), -Math.sin(phi)); // екранний кут вектора t
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#e0a060';
      ctx.beginPath(); ctx.arc(cx, cy, rc, t0 + 0.15, t0 + Math.PI - 0.15); ctx.stroke();
      ctx.strokeStyle = '#a07040';
      ctx.beginPath(); ctx.arc(cx, cy, rc, t0 + Math.PI + 0.15, t0 + 2 * Math.PI - 0.15); ctx.stroke();
      // щітки (зверху та знизу), полярність
      ctx.fillStyle = '#555';
      ctx.fillRect(cx - 6, cy - rc - 18, 12, 14);
      ctx.fillRect(cx - 6, cy + rc + 4, 12, 14);
      text(ctx, mode === 'motor' ? '+' : '', cx + 12, cy - rc - 6, COL.north, 'left', 14, 'bold');
      text(ctx, mode === 'motor' ? '−' : '', cx + 12, cy + rc + 16, COL.south, 'left', 14, 'bold');
      // моменти
      const w = m.y[0];
      if (Math.abs(w) > 0.5) {
        arcArrow(ctx, cx, cy, rw + 24, -Math.PI / 2 - 0.5, 1.0, Math.sign(w), '#d6dde8', 2);
        text(ctx, 'ω', cx + 6, cy - rw - 32, '#d6dde8', 'left', 14, 'bold');
      }
      const M = m.torque();
      if (Math.abs(M) > 0) {
        arcArrow(ctx, cx, cy, rw + 24, Math.PI / 2 - 0.5, 1.0, Math.sign(M), M * w < 0 ? COL.force : '#4ade80', 3);
        text(ctx, M * w < 0 ? 'M_ел гальмує (Ленц)' : 'M_ел', cx + 8, cy + rw + 44, M * w < 0 ? COL.force : '#4ade80', 'left', 12, 'bold');
      }
      // стовпчик напруг: U = IR + ε_проти
      const bx = W - 120, by0 = 40, bh = H - 90;
      const eps = m.backEmf();
      const Uref = Math.max(p.U, Math.abs(eps) + Math.abs(I * m.Rtot), 1e-12);
      const hIR = (bh * Math.abs(I * m.Rtot)) / Uref, hE = (bh * Math.abs(eps)) / Uref;
      ctx.strokeStyle = '#3a4456';
      ctx.strokeRect(bx, by0, 40, bh);
      ctx.fillStyle = COL.bInd;
      ctx.fillRect(bx, by0 + bh - hE, 40, hE);
      ctx.fillStyle = '#ff7a59';
      ctx.fillRect(bx, by0 + bh - hE - hIR, 40, hIR);
      text(ctx, mode === 'motor' ? 'U' : 'ε', bx + 20, by0 - 8, COL.text, 'center', 13, 'bold');
      text(ctx, 'IR', bx + 46, by0 + bh - hE - hIR / 2 + 4, '#ff7a59', 'left', 12, 'bold');
      text(ctx, 'ε проти', bx + 46, by0 + bh - hE / 2 + 4, COL.bInd, 'left', 12, 'bold');
      text(ctx, `I/I_пуск = ${(I / (p.U / m.Rtot || 1)).toFixed(2)}`, bx + 20, H - 26, COL.muted, 'center', 11);
    },
    updateNow(now) {
      const f = units.fmt;
      const I = m.current(), w = m.y[0];
      now.set('Кутова швидкість ω', `${f(w, 'omega')} (${((w * 60) / (2 * Math.PI)).toFixed(0)} об/хв)`);
      now.set('Струм I', f(I, 'current'));
      if (mode === 'motor') now.set('Пусковий струм U/R', f(p.U / m.Rtot, 'current'));
      now.set('Проти-ЕРС ε = k_Φω f/c', f(m.backEmf(), 'voltage'));
      now.set('Електромагнітний момент', f(m.torque(), 'torque'));
      if (mode === 'motor') {
        now.set('Пусковий момент k_ΦU/(cR)', f(m.stallTorque, 'torque'));
        now.set('ω холостого ходу cU/k_Φ', f(m.steadyOmega(0), 'omega'));
        const Pin = p.U * I;
        now.set('ККД зараз', Pin > 0 ? `${((100 * p.Mload * w) / Pin).toFixed(1)} %` : '—');
      } else {
        now.set('Потужність у навантаженні', f(I * I * p.Rload, 'power'));
        now.set('Потужність приводу', f(-p.Mload * w, 'power'));
      }
      now.set('Тепло Q', f(m.energies().heat, 'energy'));
      now.setNote(mode === 'motor'
        ? 'Обертаючись у полі, котушка сама стає генератором: її ЕРС ε = k_Φω/c напрямлена <b>проти</b> струму (Ленц). Тому струм I = (U − ε)/R ' +
          'максимальний при пуску (ω = 0) і спадає з розгоном. Без навантаження двигун розганяється майже до ω = cU/k_Φ, коли ε ≈ U.'
        : 'Зовнішній момент крутить вал, ЕРС обмотки створює струм у навантаженні. Цей струм у полі дає момент сил Ампера, <b>протилежний</b> ' +
          'обертанню (червона дуга) — привід мусить виконувати роботу. Менше R_н → більший струм → важче крутити.');
    },
  };

  restart();
  const iS3 = new AutoScale(0.999);
  page.enable3D(() => import('../../sims3d/dc').then((mod) => mod.dcScene(() => ({ m, mode, iRef: iS3.update(m.current()) }))));
  page.setTheory(dcTheory());
  page.setQuiz(dcQuiz);
  return page;
}
