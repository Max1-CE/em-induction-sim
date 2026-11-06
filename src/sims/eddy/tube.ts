// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/** 2a. Магніт падає в провідній трубі (порівняння з пластиковою). */
import { EddyTube, FreeFall, terminalVelocity, type TubeParams } from '../../physics/eddyTube';
import { MATERIALS, SIEMENS_PER_M_TO_CGS, materialById, G } from '../../physics/constants';
import { SimPage } from '../../ui/simpage';
import { slider, select, checkbox } from '../../ui/controls';
import { LiveChart, EnergyChart } from '../../ui/chart';
import { arrow, COL, fieldSymbol, magnet, text, AutoScale } from '../../ui/draw';
import { units } from '../../ui/units-store';
import { tubeTheory, tubeQuiz } from './theory';

export function createTubeSim(): SimPage {
  const page = new SimPage(
    '2a. Магніт у мідній трубі: струми Фуко гальмують падіння',
    'Ліворуч — обидві труби повністю (пластикова й металева). Праворуч — збільшений вигляд металевої труби біля магніту: ' +
      'перерізи кілець-струмів (⊙ — на нас, ⊗ — від нас), яскравість ∝ |I|.',
    0.62,
  );
  const p: TubeParams = {
    sigma: materialById('cu').sigma, w: 0.15, a: 0.8, m: 1600, mass: 12, h: 0.1, length: 60, selfInduction: false,
  };
  let matId = 'cu';
  let customSigma = 1e7 * SIEMENS_PER_M_TO_CGS;
  let flip = false;
  let sim = new EddyTube(p);
  let free = new FreeFall(sim.y[0], sim.floorZ);

  const rebuild = () => {
    p.sigma = matId === 'custom' ? customSigma : materialById(matId).sigma;
    if (p.sigma <= 0) p.sigma = 1; // «пластик»: майже нуль провідності
    p.h = p.selfInduction ? Math.max(p.h, 0.2) : p.h;
    sim = new EddyTube({ ...p });
    free = new FreeFall(sim.y[0], sim.floorZ);
    [vChart, zChart, pChart].forEach((c) => c.clear());
    eChart.clear();
    iS.reset();
  };

  const mats = MATERIALS.filter((m) => m.id !== 'plastic').map((m) => ({ value: m.id, text: m.name }));
  const customSl = slider({
    label: 'Довільна σ', dim: 'conductivity', min: 1e5 * SIEMENS_PER_M_TO_CGS, max: 1e8 * SIEMENS_PER_M_TO_CGS, value: customSigma, log: true,
    onChange: (v) => { customSigma = v; if (matId === 'custom') rebuild(); },
  });
  customSl.el.style.display = 'none';
  page.params.append(
    select('Матеріал труби', [...mats, { value: 'custom', text: 'Довільна σ…' }], matId, (v) => {
      matId = v;
      customSl.el.style.display = v === 'custom' ? '' : 'none';
      rebuild();
    }).el,
    customSl.el,
    slider({ label: 'Товщина стінки w', dim: 'length', min: 0.05, max: 0.5, value: p.w, onChange: (v) => { p.w = v; rebuild(); } }).el,
    slider({ label: 'Радіус труби a', dim: 'length', min: 0.6, max: 3, value: p.a, onChange: (v) => { p.a = v; rebuild(); } }).el,
    slider({ label: 'Магнітний момент 𝔪', dim: 'moment', min: 200, max: 1e4, value: p.m, log: true, onChange: (v) => { p.m = v; rebuild(); } }).el,
    slider({ label: 'Маса магніту M', dim: 'mass', min: 2, max: 100, value: p.mass, log: true, onChange: (v) => { p.mass = v; rebuild(); } }).el,
    slider({ label: 'Висота кільця h (дискретизація)', dim: 'length', min: 0.05, max: 1, value: p.h, log: true, onChange: (v) => { p.h = v; rebuild(); } }).el,
    checkbox('Самоіндукція + взаємна індукція кілець (повільніше)', false, (v) => { p.selfInduction = v; rebuild(); }),
    checkbox('Перевернути магніт', false, (v) => (flip = v)),
  );

  const vChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'Швидкість падіння |v|(t) і аналітична v_гр',
    yDim: 'velocity',
    series: [{ label: '|v| метал', color: '#d6dde8', width: 2.2 }, { label: 'v_гр (формула)', color: COL.force, dash: [6, 4] }],
  }));
  const zChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'Висота z(t): металева та пластикова труби',
    yDim: 'length',
    series: [{ label: 'метал', color: COL.copper, width: 2.2 }, { label: 'пластик', color: '#9ca3af' }],
  }));
  const pChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'Потужність нагріву труби P = Σ I²R та Mg|v|',
    yDim: 'power',
    series: [{ label: 'P нагріву', color: '#ff7a59', width: 2.2 }, { label: 'Mg|v|', color: '#6aa9ff', dash: [5, 4] }],
  }));
  const eChart = page.addChart(new EnergyChart(page.chartsEl, 'Баланс: ½Mv² + Mgz + Q + W_маг = const'));
  const iS = new AutoScale(0.999);

  page.hooks = {
    step(dt) {
      sim.step(dt);
      free.step(dt);
    },
    sample() {
      if (sim.landed) return;
      vChart.push(sim.t, [Math.abs(sim.y[1]), terminalVelocity(p)]);
      zChart.push(sim.t, [sim.y[0], free.landed ? free.floorZ : free.z]);
      pChart.push(sim.t, [sim.heatPower(), p.mass * G * Math.abs(sim.y[1])]);
      eChart.push(sim.t, sim.energies());
    },
    reset: rebuild,
    draw(ctx, W, H) {
      const top = 26, bot = H - 20;
      // ── огляд: дві труби повністю ──
      const ovW = W * 0.28;
      const zs = (z: number) => bot - ((z - sim.floorZ) / (p.length + 4 * p.a - sim.floorZ)) * (bot - top);
      const drawTube = (x: number, col: string, label: string, zMag: number, landed: boolean) => {
        ctx.fillStyle = col;
        ctx.fillRect(x - 13, zs(p.length), 4, zs(0) - zs(p.length));
        ctx.fillRect(x + 9, zs(p.length), 4, zs(0) - zs(p.length));
        text(ctx, label, x, H - 4, COL.muted, 'center', 11);
        magnet(ctx, x, zs(Math.max(zMag, sim.floorZ)), 12, 14, flip ? Math.PI / 2 : -Math.PI / 2);
        if (landed) text(ctx, 'на дні', x + 18, zs(sim.floorZ), COL.muted, 'left', 10);
      };
      drawTube(ovW * 0.3, '#6b7280', 'пластик', free.landed ? free.floorZ : free.z, free.landed);
      drawTube(ovW * 0.72, COL.copper, 'метал', sim.y[0], sim.landed);
      ctx.strokeStyle = '#2a3242';
      ctx.beginPath(); ctx.moveTo(ovW, 10); ctx.lineTo(ovW, H - 10); ctx.stroke();
      // рамка збільшення
      const zoomHalf = 4.2 * p.a;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeRect(ovW * 0.72 - 20, zs(sim.y[0] + zoomHalf), 40, zs(sim.y[0] - zoomHalf) - zs(sim.y[0] + zoomHalf));

      // ── збільшений вигляд ──
      const cx = ovW + (W - ovW) * 0.45;
      const cy = (top + bot) / 2;
      const sc = (bot - top) / (2 * zoomHalf);
      const zc = sim.y[0];
      const Y = (z: number) => cy - (z - zc) * sc;
      const dirM = flip ? -1 : 1;
      ctx.save();
      ctx.beginPath(); ctx.rect(ovW + 2, 0, W - ovW, H); ctx.clip();
      if (page.showLines) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(78,168,255,0.35)';
        for (const r0 of [0.5, 0.9, 1.5, 2.4, 3.8]) {
          for (const sgn of [1, -1]) {
            ctx.beginPath();
            for (let k = 0; k <= 100; k++) {
              const th = 0.03 + (k / 100) * (Math.PI - 0.06);
              const r = r0 * p.a * Math.sin(th) ** 2;
              const px = cx + sgn * r * Math.sin(th) * sc;
              const py = cy - dirM * r * Math.cos(th) * sc;
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
          }
        }
      }
      // кільця: у правій стінці I>0 → ⊗ (від нас), у лівій ⊙
      const kMin = Math.max(0, Math.floor((zc - zoomHalf) / p.h) - 1);
      const kMax = Math.min(sim.nRings - 1, Math.ceil((zc + zoomHalf) / p.h) + 1);
      let iMax = 0;
      for (let k = kMin; k <= kMax; k++) iMax = Math.max(iMax, Math.abs(sim.ringCurrent(k)));
      const Iref = iS.update(iMax);
      const wPx = Math.max(6, p.w * sc);
      const xr = cx + p.a * sc, xl = cx - p.a * sc;
      const hPx = p.h * sc;
      let kUp = -1, kDn = -1, iUp = 0, iDn = 0;
      for (let k = kMin; k <= kMax; k++) {
        const I = flip ? -sim.ringCurrent(k) : sim.ringCurrent(k);
        const f = Math.min(1, Math.abs(I) / Iref);
        const yk = Y(sim.zRing(k));
        const base = I >= 0 ? [94, 234, 212] : [244, 114, 182];
        ctx.fillStyle = `rgb(${(60 + (base[0] - 60) * f) | 0},${(45 + (base[1] - 45) * f) | 0},${(35 + (base[2] - 35) * f) | 0})`;
        ctx.fillRect(xl - wPx, yk - hPx / 2, wPx, Math.max(1, hPx - 0.6));
        ctx.fillRect(xr, yk - hPx / 2, wPx, Math.max(1, hPx - 0.6));
        if (sim.zRing(k) > zc && Math.abs(I) > iUp) { iUp = Math.abs(I); kUp = k; }
        if (sim.zRing(k) < zc && Math.abs(I) > iDn) { iDn = Math.abs(I); kDn = k; }
      }
      // символи напрямку струму на найбільш навантажених кільцях
      for (const k of [kUp, kDn]) {
        if (k < 0) continue;
        const I = flip ? -sim.ringCurrent(k) : sim.ringCurrent(k);
        const yk = Y(sim.zRing(k));
        fieldSymbol(ctx, xl - wPx - 14, yk, 8, I > 0, COL.cur);
        fieldSymbol(ctx, xr + wPx + 14, yk, 8, I < 0, COL.cur);
        // кільце в перспективі зі стрілкою (передня сторона: I>0 → зліва направо)
        ctx.strokeStyle = 'rgba(94,234,212,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, yk, p.a * sc, 9, 0, 0, Math.PI); ctx.stroke();
        const s = Math.sign(I);
        arrow(ctx, cx - 14 * s, yk + 9, cx + 14 * s, yk + 9, COL.cur, 2.2, 8);
        // поле цього кільця на осі
        const len = 0.9 * p.a * sc * Math.min(1, Math.abs(I) / Iref);
        arrow(ctx, cx + p.a * sc * 0.55, yk + (s * len) / 2, cx + p.a * sc * 0.55, yk - (s * len) / 2, COL.bInd, 3, 10);
        text(ctx, 'B інд', cx + p.a * sc * 0.55 + 8, yk - (s * len) / 2, COL.bInd, 'left', 11, 'bold');
      }
      ctx.restore();
      // магніт
      magnet(ctx, cx, cy, 1.27 * sc, 1.1 * p.a * sc * 0.8, flip ? Math.PI / 2 : -Math.PI / 2);
      // сили
      const F = sim.force();
      const Mg = p.mass * G;
      const fl = (x: number) => 90 * Math.min(1.3, x / Mg);
      arrow(ctx, cx - 26, cy, cx - 26, cy + fl(Mg), '#9ca3af', 3, 10);
      text(ctx, 'Mg', cx - 32, cy + fl(Mg), '#9ca3af', 'right', 12, 'bold');
      if (F > 0) {
        arrow(ctx, cx + 26, cy, cx + 26, cy - fl(F), COL.force, 3.5, 11);
        text(ctx, 'F Фуко', cx + 32, cy - fl(F) + 4, COL.force, 'left', 12, 'bold');
      }
      text(ctx, 'бірюзовий — I > 0, рожевий — I < 0 (проти год. стрілки, якщо дивитися згори)', ovW + 10, 16, COL.muted, 'left', 11);
      if (sim.landed) text(ctx, 'Магніт вийшов із труби. Натисніть «Скинути».', cx, H - 6, COL.text, 'center', 13, 'bold');
      if (p.selfInduction && !sim.lMatrixOk) text(ctx, '⚠ матриця L не додатно визначена — збільште h', cx, 40, COL.force, 'center', 12);
    },
    updateNow(now) {
      const f = units.fmt;
      const vt = terminalVelocity(p);
      now.set('Висота магніту z', f(sim.y[0], 'length'));
      now.set('Швидкість |v|', f(Math.abs(sim.y[1]), 'velocity'));
      now.set('v_гр (аналітика)', f(vt, 'velocity'));
      now.set('|v| / v_гр', (Math.abs(sim.y[1]) / vt).toFixed(4));
      now.set('Сила Фуко F', f(sim.force(), 'force'));
      now.set('Вага Mg', f(p.mass * G, 'force'));
      now.set('Потужність нагріву P', f(sim.heatPower(), 'power'));
      now.set('Опір одного кільця R', f(sim.Rring, 'resistance'));
      now.set('Час падіння (пластик)', free.landed ? f(free.t, 'time') : '…');
      if (p.selfInduction) {
        now.set('Мін. стала часу кілець', f(sim.Tmin, 'time'));
        now.set('Параметр T·v/a', ((sim.Tmin * Math.abs(sim.y[1])) / p.a).toExponential(2));
      }
      now.set('σ матеріалу', f(p.sigma, 'conductivity'));
      now.setNote(
        'Під магнітом потік через кільця <b>зростає</b> (магніт наближається), над ним — <b>спадає</b>. Тому струми під і над магнітом ' +
          '<b>протилежні</b>: нижні кільця відштовхують магніт, верхні притягують — обидва гальмують. ' +
          'Коли F = Mg, магніт падає рівномірно з v_гр, і вся робота сили тяжіння йде в тепло (P = Mgv).',
      );
    },
  };

  rebuild();
  page.enable3D(() => import('../../sims3d/tube').then((m) => m.tubeScene(() => ({ sim, free, p, flip, vt: terminalVelocity(p) }))));
  page.setTheory(tubeTheory());
  page.setQuiz(tubeQuiz);
  return page;
}
