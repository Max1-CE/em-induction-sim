/** 2d. Нагрів провідної пластини змінним полем: суцільне vs шихтоване осердя, скін-ефект. */
import { Slab, SlabHeating, thinPlatePower } from '../../physics/heating';
import { materialById, C } from '../../physics/constants';
import { SimPage } from '../../ui/simpage';
import { slider, select } from '../../ui/controls';
import { LiveChart, EnergyChart, XYPlot } from '../../ui/chart';
import { arrow, COL, fieldSymbol, text } from '../../ui/draw';
import { units } from '../../ui/units-store';
import { heatingTheory, heatingQuiz } from './theory';

/** Візуальна частота коливань поля в анімації, Гц (модельний час сповільнено). */
const F_VIS = 0.4;

export function createHeatingSim(): SimPage {
  const page = new SimPage(
    '2d. Індукційний нагрів і втрати в осерді: шихтування та скін-ефект',
    'Переріз осердя: поле B ∥ осі (на нас/від нас) змінюється за синусом. Ліворуч суцільне осердя, праворуч — з n ізольованих пластин. ' +
      'Контури — лінії вихрових струмів, яскравість ∝ |j|. Час сповільнено.',
    0.5,
  );
  let mat = 'steel';
  let f = 50, B0 = 1e4, d = 2, n = 8;
  let slab: Slab, lam: Slab, heat: SlabHeating;

  const rebuild = () => {
    const sg = materialById(mat).sigma;
    slab = new Slab(sg, f, B0, d);
    lam = new Slab(sg, f, B0, d / n);
    heat = new SlabHeating(slab);
    pChart.clear();
    eChart.clear();
    updatePlots();
  };

  page.params.append(
    select('Матеріал', [
      { value: 'steel', text: 'Нержавіюча сталь' }, { value: 'cu', text: 'Мідь' }, { value: 'al', text: 'Алюміній' }, { value: 'brass', text: 'Латунь' }, { value: 'graphite', text: 'Графіт' },
    ], mat, (v) => { mat = v; rebuild(); }).el,
    slider({ label: 'Частота f', dim: 'freq', min: 10, max: 1e6, value: f, log: true, onChange: (v) => { f = v; rebuild(); } }).el,
    slider({ label: 'Амплітуда поля B₀', dim: 'B', min: 10, max: 2e4, value: B0, log: true, onChange: (v) => { B0 = v; rebuild(); } }).el,
    slider({ label: 'Товщина осердя d', dim: 'length', min: 0.01, max: 5, value: d, log: true, onChange: (v) => { d = v; rebuild(); } }).el,
    slider({ label: 'Кількість пластин n (шихтоване)', dim: 'none', min: 1, max: 20, value: n, integer: true, onChange: (v) => { n = v; rebuild(); } }).el,
  );

  const profile = page.addChart(new XYPlot(page.chartsEl, {
    title: 'Амплітуда |j(x)| по товщині суцільної пластини: точно (ch((1+i)x/δ)) і наближення тонкої пластини',
    xDim: 'length', yDim: 'jdensity', xName: 'x', yName: '|j|',
  }));
  const ratio = page.addChart(new XYPlot(page.chartsEl, {
    title: 'Точні втрати / формула тонкої пластини vs частота (для суцільної)',
    xDim: 'none', yDim: 'none', xName: 'lg(f / Гц)', yName: 'P_точн / P_тонк',
  }));
  const pChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'Миттєва потужність втрат на одиницю об\'єму', yDim: 'powerDensity',
    series: [{ label: 'суцільне', color: '#ff7a59', width: 2 }, { label: 'шихтоване', color: '#6aa9ff', width: 2 }],
  }));
  const eChart = page.addChart(new EnergyChart(page.chartsEl, 'Теорема Пойнтінга (на 1 см² пластини): A_джерела = Q + ΔW_маг'));

  const updatePlots = () => {
    const exact: [number, number][] = [], thin: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const x = -d / 2 + (d * i) / 120;
      const jj = slab.j(x);
      exact.push([x, Math.hypot(jj[0], jj[1])]);
      thin.push([x, (slab.sigma * slab.omega * B0 * Math.abs(x)) / C]);
    }
    profile.curves = [
      { pts: exact, color: '#ff7a59', label: 'точно' },
      { pts: thin, color: '#9ca3af', label: 'тонка пластина', dash: [5, 4] },
    ];
    profile.yRange = [0, 1.1 * Math.max(...exact.map((q) => q[1]))];
    const dl = Math.min(slab.delta, d / 2);
    profile.markers = [{ x: d / 2 - dl, y: 0, color: COL.bInd, label: slab.delta < d / 2 ? 'δ від поверхні' : 'δ > d/2' }];
    profile.render();
    const r: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const lf = 1 + (5 * i) / 120;
      const s = new Slab(slab.sigma, 10 ** lf, B0, d);
      r.push([lf, s.avgPowerDensity(200) / thinPlatePower(10 ** lf, B0, d, slab.sigma)]);
    }
    ratio.curves = [{ pts: r, color: '#c084fc', label: 'P_точн/P_тонк' }];
    ratio.yRange = [0, 1.05];
    ratio.markers = [{ x: Math.log10(f), y: slab.avgPowerDensity() / thinPlatePower(f, B0, d, slab.sigma), color: '#fff', label: `f = ${f.toPrecision(3)} Гц` }];
    ratio.render();
  };

  /** Миттєва потужність на одиницю об'єму (точно), фаза φ = ωt. */
  const pNow = (s: Slab, ph: number) => s.heatRate(ph, 40) / s.d;

  const drawCore = (ctx: CanvasRenderingContext2D, x0: number, y0: number, size: number, nl: number, s: Slab, label: string) => {
    const ph = s.omega * heat.t;
    const Bnow = Math.sin(ph);
    const dB = Math.cos(ph); // ∝ Ḃ
    // поле
    ctx.fillStyle = `rgba(78,168,255,${(0.08 + 0.18 * Math.abs(Bnow)).toFixed(2)})`;
    ctx.fillRect(x0, y0, size, size);
    const gap = nl > 1 ? 3 : 0;
    const lw = (size - gap * (nl - 1)) / nl;
    for (let k = 0; k < nl; k++) {
      const lx = x0 + k * (lw + gap);
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1;
      ctx.strokeRect(lx, y0, lw, size);
      // контури вихрового струму: вкладені прямокутники, |j| ∝ відстані від середньої площини
      const nLoops = Math.max(1, Math.min(5, Math.floor(lw / 7)));
      for (let q = 1; q <= nLoops; q++) {
        const fr = q / (nLoops + 0.5);
        const hw = (lw / 2) * fr;
        // |j| ∝ |Ḃ|·x, а x у пластині шихтованого осердя в n разів менше
        const amp = Math.min(1, (Math.abs(dB) * fr) / nl);
        ctx.strokeStyle = `rgba(94,234,212,${(0.1 + 0.85 * amp).toFixed(2)})`;
        ctx.lineWidth = 1.5;
        const m = 6 + (1 - fr) * 10;
        ctx.strokeRect(lx + lw / 2 - hw, y0 + m, 2 * hw, size - 2 * m);
      }
      // напрям: Ḃ > 0 (B на нас зростає) → струм за год. стрілкою (поле струму від нас)
      if (Math.abs(dB) > 0.15 && lw > 10) {
        const s2 = Math.sign(dB);
        const xr = lx + lw / 2 + (lw / 2) * 0.6, xl = lx + lw / 2 - (lw / 2) * 0.6;
        arrow(ctx, xr, y0 + size / 2 - 10 * s2, xr, y0 + size / 2 + 10 * s2, COL.cur, 1.8, 6);
        arrow(ctx, xl, y0 + size / 2 + 10 * s2, xl, y0 + size / 2 - 10 * s2, COL.cur, 1.8, 6);
      }
    }
    if (page.showLines) {
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) fieldSymbol(ctx, x0 + size * (0.2 + 0.3 * i), y0 + size * (0.2 + 0.3 * j), 6, Bnow > 0, `rgba(78,168,255,${(0.3 + 0.7 * Math.abs(Bnow)).toFixed(2)})`);
      if (Math.abs(dB) > 0.15) {
        fieldSymbol(ctx, x0 + size + 18, y0 + 16, 9, dB < 0, COL.bInd);
        text(ctx, 'B інд', x0 + size + 30, y0 + 20, COL.bInd, 'left', 11, 'bold');
      }
    }
    text(ctx, label, x0 + size / 2, y0 + size + 18, COL.text, 'center', 13, 'bold');
    text(ctx, `P/V ≈ ${units.fmt(s.avgPowerDensity(), 'powerDensity')}`, x0 + size / 2, y0 + size + 34, COL.muted, 'center', 12);
  };

  page.hooks = {
    step(dt) { heat.step((dt * F_VIS) / f); },
    sample() {
      const ph = slab.omega * heat.t;
      pChart.push(heat.t, [pNow(slab, ph), pNow(lam, ph)]);
      eChart.push(heat.t, heat.energies());
    },
    reset: rebuild,
    draw(ctx, W, H) {
      const size = Math.min(H * 0.62, W * 0.3);
      drawCore(ctx, W * 0.08, 30, size, 1, slab, 'Суцільне осердя');
      drawCore(ctx, W * 0.55, 30, size, n, lam, `Шихтоване: ${n} пластин`);
      const ph = slab.omega * heat.t;
      // фазовий індикатор B(t)
      const gx = W * 0.44, gy = 30 + size / 2;
      ctx.strokeStyle = '#3a4456';
      ctx.beginPath(); ctx.arc(gx, gy, 26, 0, 2 * Math.PI); ctx.stroke();
      // фазор: вертикальна проєкція = sin ωt ∝ B(t)
      arrow(ctx, gx, gy, gx + 24 * Math.cos(ph), gy - 24 * Math.sin(ph), COL.bExt, 2, 7);
      text(ctx, `B = ${(Math.sin(ph)).toFixed(2)}·B₀`, gx, gy + 44, COL.bExt, 'center', 12);
      text(ctx, `час ×${(f / F_VIS).toPrecision(3)} повільніше`, gx, gy + 60, COL.muted, 'center', 11);
    },
    updateNow(now) {
      const fm = units.fmt;
      const thinP = thinPlatePower(f, B0, d, slab.sigma);
      const m = materialById(mat);
      now.set('Глибина скін-шару δ', fm(slab.delta, 'length'));
      now.set('d / δ', (d / slab.delta).toPrecision(3));
      now.set('P/V формула тонкої', fm(thinP, 'powerDensity'));
      now.set('P/V точно (суцільне)', fm(slab.avgPowerDensity(), 'powerDensity'));
      now.set('P/V шихтоване (точно)', fm(lam.avgPowerDensity(), 'powerDensity'));
      now.set('Виграш від шихтування', `×${(slab.avgPowerDensity() / lam.avgPowerDensity()).toPrecision(3)} (n² = ${n * n})`);
      now.set('Швидкість нагріву dT/dt (суц.)', fm(slab.avgPowerDensity() / (m.rho * m.cp), 'none') + ' К/с');
      now.setNote(d < slab.delta
        ? `Пластина <b>тонка</b> порівняно з δ: поле проникає повністю, і формула π²f²B₀²d²σ/(6c²) точна. Шихтування зменшує втрати майже рівно в n² = ${n * n} разів.`
        : `Пластина <b>товща</b> за δ: струм зосереджений біля поверхонь (див. профіль |j|), формула тонкої пластини <b>завищує</b> втрати. Шихтування, поки d/n < δ, усе ще допомагає.`);
    },
  };

  rebuild();
  page.setTheory(heatingTheory());
  page.setQuiz(heatingQuiz);
  return page;
}
