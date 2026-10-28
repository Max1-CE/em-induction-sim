/** 2b. Маятник Вальтенгофена: суцільна пластина vs гребінка. */
import { PlateModel, Pendulum, type PendulumParams } from '../../physics/waltenhofen';
import { materialById, G } from '../../physics/constants';
import { SimPage } from '../../ui/simpage';
import { slider, select } from '../../ui/controls';
import { LiveChart, EnergyChart } from '../../ui/chart';
import { arrow, COL, fieldSymbol, text } from '../../ui/draw';
import { units } from '../../ui/units-store';
import { arcArrow } from '../basics/generator';
import { plateImage, drawStreamlines } from './plateView';
import { pendulumTheory, pendulumQuiz } from './theory';

/** Максимальний перепад ψ між сусідніми комірками в усій таблиці (для нормування яскравості). */
function gradMax(pl: PlateModel): number {
  const { nx, ny, mask } = pl.grid;
  let m = 0;
  for (const psi of pl.psis)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i;
        if (!mask[k]) continue;
        m = Math.max(m, Math.hypot(psi[k + 1] - psi[k - 1], psi[k + nx] - psi[k - nx]) / 2);
      }
  return m || 1;
}

export function createPendulumSim(): SimPage {
  const page = new SimPage(
    '2b. Маятник Вальтенгофена: суцільна пластина і гребінка',
    'Дві однакові за розміром пластини гойдаються між полюсами (поле B ⊗ у квадраті). Карта показує |j|, ' +
      'бірюзові лінії — лінії струму. Прорізи «розрізають» вихори, тому гребінка гальмується значно слабше.',
    0.55,
  );
  const p: PendulumParams = {
    sigma: materialById('al').sigma, rho: materialById('al').rho, d: 0.3, b: 8, c: 6, arm: 25,
    B0: 700, pole: 2.5, slots: 7, slotWidth: 0.4, slotDepth: 0.8,
  };
  let mat = 'al';
  let theta0 = 0.6;
  let solid: PlateModel, comb: PlateModel, ps: Pendulum, pc: Pendulum, jRef = 1;

  const rebuild = () => {
    p.sigma = materialById(mat).sigma;
    p.rho = materialById(mat).rho;
    solid = new PlateModel({ ...p, slots: 0 });
    comb = new PlateModel({ ...p });
    ps = new Pendulum(solid, theta0);
    pc = new Pendulum(comb, theta0);
    const wMax = Math.sqrt((2 * solid.mass * G * solid.lcm * (1 - Math.cos(theta0))) / solid.J);
    jRef = gradMax(solid) * wMax * 0.6;
    thChart.clear(); aChart.clear(); eS.clear(); eC.clear();
  };
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = window.setTimeout(rebuild, 150); };

  page.params.append(
    select('Матеріал', [
      { value: 'al', text: 'Алюміній' }, { value: 'cu', text: 'Мідь' }, { value: 'brass', text: 'Латунь' }, { value: 'steel', text: 'Нержавіюча сталь' },
    ], mat, (v) => { mat = v; later(); }).el,
    slider({ label: 'Поле в зазорі B₀', dim: 'B', min: 50, max: 5000, value: p.B0, log: true, onChange: (v) => { p.B0 = v; later(); } }).el,
    slider({ label: 'Початковий кут θ₀', dim: 'none', min: 0.1, max: 0.9, value: theta0, format: (v) => `${((v * 180) / Math.PI).toFixed(0)}°`, onChange: (v) => { theta0 = v; later(); } }).el,
    slider({ label: 'Кількість прорізів гребінки', dim: 'none', min: 1, max: 12, value: p.slots, integer: true, onChange: (v) => { p.slots = v; later(); } }).el,
    slider({ label: 'Ширина прорізу', dim: 'length', min: 0.2, max: 0.8, value: p.slotWidth, onChange: (v) => { p.slotWidth = v; later(); } }).el,
    slider({ label: 'Глибина прорізів (частка висоти)', dim: 'none', min: 0.3, max: 0.95, value: p.slotDepth, onChange: (v) => { p.slotDepth = v; later(); } }).el,
    slider({ label: 'Довжина підвісу ℓ', dim: 'length', min: 10, max: 60, value: p.arm, onChange: (v) => { p.arm = v; later(); } }).el,
    slider({ label: 'Товщина пластини d', dim: 'length', min: 0.05, max: 1, value: p.d, onChange: (v) => { p.d = v; later(); } }).el,
  );

  const thChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'Кут θ(t)', yDim: 'angle',
    series: [{ label: 'суцільна', color: '#ff7a59', width: 2 }, { label: 'гребінка', color: '#6aa9ff', width: 2 }],
  }));
  const aChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'Амплітуда θ_max(t) = arccos(1 − E_мех/(Mgl)) — огинаюча затухання', yDim: 'angle',
    series: [{ label: 'суцільна', color: '#ff7a59', width: 2 }, { label: 'гребінка', color: '#6aa9ff', width: 2 }],
  }));
  const eS = page.addChart(new EnergyChart(page.chartsEl, 'Баланс енергії — суцільна пластина'));
  const eC = page.addChart(new EnergyChart(page.chartsEl, 'Баланс енергії — гребінка'));

  const amp = (pd: Pendulum) => {
    const pl = pd.plate;
    const x = 1 - pd.energies().mech / (pl.mass * G * pl.lcm);
    return Math.acos(Math.max(-1, Math.min(1, x)));
  };

  const drawOne = (ctx: CanvasRenderingContext2D, pd: Pendulum, ox: number, oy: number, sc: number, label: string) => {
    const pl = pd.plate;
    const th = pd.y[0];
    // полюс (поле ⊗ у квадраті) — за пластиною
    const pole = p.pole;
    ctx.fillStyle = 'rgba(62,123,250,0.18)';
    ctx.fillRect(ox - pole * sc, oy + (p.arm - pole) * sc, 2 * pole * sc, 2 * pole * sc);
    if (page.showLines)
      for (let x = -pole + 0.6; x < pole; x += 1.2)
        for (let y = -pole + 0.6; y < pole; y += 1.2) fieldSymbol(ctx, ox + x * sc, oy + (p.arm + y) * sc, 4, false, 'rgba(78,168,255,0.6)');
    // підвіс
    const cs = Math.cos(th), sn = Math.sin(th);
    const toS = (u: number, v: number): [number, number] => [ox + (u * cs - v * sn) * sc, oy - (u * sn + v * cs) * sc];
    const top = toS(0, -p.arm + p.c / 2);
    ctx.strokeStyle = '#9aa4b2';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(top[0], top[1]); ctx.stroke();
    ctx.fillStyle = '#ddd';
    ctx.beginPath(); ctx.arc(ox, oy, 5, 0, 2 * Math.PI); ctx.fill();
    // пластина з картою |j|
    const psi = pl.psiAt(th);
    const w = pd.y[1];
    const img = plateImage(pl.grid, psi, w, jRef, [150, 160, 175]);
    const g = pl.grid;
    ctx.save();
    // зображення: (0,0) — верхній лівий кут = (u0 − h/2, v0 + (ny − ½)h)
    const [x0, y0] = toS(pl.u0 - g.h / 2, pl.v0 + (g.ny - 0.5) * g.h);
    ctx.translate(x0, y0);
    ctx.rotate(-th);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, g.nx * g.h * sc, g.ny * g.h * sc);
    ctx.restore();
    const toScreen = (i: number, j: number) => toS(pl.u0 + i * g.h, pl.v0 + j * g.h);
    drawStreamlines(ctx, g, psi, w, { toScreen, jRef, showLines: page.showLines, metal: [150, 160, 175] });
    // гальмівна сила (Ленц) — протилежна швидкості центру пластини
    const M = pd.torque();
    const cen = toS(0, -p.arm);
    if (Math.abs(M) > 1e-4 * pl.mass * G * pl.lcm) {
      const F = M / p.arm;
      const L = 70 * Math.min(1, Math.abs(F) / (0.5 * pl.mass * G));
      const s = Math.sign(F);
      // дотичний напрям руху центру пластини при θ̇ > 0 на екрані: (cos θ, −sin θ)
      arrow(ctx, cen[0], cen[1] + p.c * sc * 0.65, cen[0] + s * L * cs, cen[1] + p.c * sc * 0.65 - s * L * sn, COL.force, 3.5, 11);
      text(ctx, 'F гальм.', cen[0] + s * (L + 6), cen[1] + p.c * sc * 0.65 + 4, COL.force, s > 0 ? 'left' : 'right', 12, 'bold');
    }
    if (Math.abs(w) > 0.05) arcArrow(ctx, ox, oy, 26, Math.PI / 2 - 0.5, 1.0, Math.sign(w), '#d6dde8', 2);
    text(ctx, label, ox, oy - 12, COL.text, 'center', 13, 'bold');
  };

  page.hooks = {
    step(dt) { ps.step(dt); pc.step(dt); },
    sample() {
      thChart.push(ps.t, [ps.y[0], pc.y[0]]);
      aChart.push(ps.t, [amp(ps), amp(pc)]);
      eS.push(ps.t, ps.energies());
      eC.push(pc.t, pc.energies());
    },
    reset: rebuild,
    draw(ctx, W, H) {
      const total = p.arm + p.c / 2 + 1.5;
      const sc = Math.min((H - 40) / total, W / 4 / (p.b * 0.8 + 6));
      drawOne(ctx, ps, W * 0.27, 30, sc, `Суцільна (${units.fmt(solid.mass, 'mass')})`);
      drawOne(ctx, pc, W * 0.73, 30, sc, `Гребінка, ${p.slots} прорізів (${units.fmt(comb.mass, 'mass')})`);
      text(ctx, 'синій квадрат — полюс, B ⊗; ⊙/⊗ помаранчеві — поле вихорів', 10, H - 8, COL.muted, 'left', 11);
    },
    updateNow(now) {
      const f = units.fmt;
      const deg = (x: number) => `${((x * 180) / Math.PI).toFixed(1)}°`;
      now.set('Кут (суцільна / гребінка)', `${deg(ps.y[0])} / ${deg(pc.y[0])}`);
      now.set('Амплітуда (суцільна)', deg(amp(ps)));
      now.set('Амплітуда (гребінка)', deg(amp(pc)));
      now.set('Момент гальм. (суцільна)', f(ps.torque(), 'torque'));
      now.set('Момент гальм. (гребінка)', f(pc.torque(), 'torque'));
      now.set('K(0)/J суцільна', f(solid.Kat(0) / solid.J, 'freq'));
      now.set('K(0)/J гребінка', f(comb.Kat(0) / comb.J, 'freq'));
      now.set('Потужність нагріву (суц.)', f(ps.heatPower(), 'power'));
      now.set('Період малих коливань', f(2 * Math.PI * Math.sqrt(solid.J / (solid.mass * G * solid.lcm)), 'time'));
      now.setNote(
        'Частина пластини, що <b>входить</b> у поле, і частина, що <b>виходить</b>, мають протилежні вихори (⊙ і ⊗): ' +
          'вхідний відштовхується, вихідний притягується назад — обидва гальмують. У гребінці прорізи не дають струму замкнутися ' +
          'великими контурами, тому K(θ) у кілька разів менший.',
      );
    },
  };

  rebuild();
  page.setTheory(pendulumTheory());
  page.setQuiz(pendulumQuiz);
  return page;
}
