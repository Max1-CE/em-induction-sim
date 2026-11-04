/** 2c. Електромагнітне гальмо: обертовий диск і нерухомий магніт. */
import { DiskModel, DiskBrake, type DiskParams } from '../../physics/diskBrake';
import { materialById } from '../../physics/constants';
import { SimPage } from '../../ui/simpage';
import { slider, select, checkbox } from '../../ui/controls';
import { LiveChart, EnergyChart, XYPlot } from '../../ui/chart';
import { arrow, COL, fieldSymbol, text } from '../../ui/draw';
import { units } from '../../ui/units-store';
import { arcArrow } from '../basics/generator';
import { plateImage, drawStreamlines } from './plateView';
import { diskTheory, diskQuiz } from './theory';

export function createDiskSim(): SimPage {
  const page = new SimPage(
    '2c. Електромагнітне гальмо: диск у полі магніту',
    'Диск обертається, магніт нерухомий. Картина вихрових струмів під полюсом стаціонарна в лабораторії. ' +
      'Гальмівний момент ∝ σB²ω при малих ω, далі досягає максимуму і спадає.',
    0.55,
  );
  const p: DiskParams = { sigma: materialById('al').sigma, rho: 2.7, d: 0.3, Rd: 12, r0: 8, pole: 2, B0: 3000, drive: 0, skin: true };
  let mat = 'al';
  let omega0 = 300;
  let model = new DiskModel(p);
  let br = new DiskBrake(model, omega0);
  let jRef = 1;

  const rebuild = () => {
    p.sigma = materialById(mat).sigma;
    p.rho = materialById(mat).rho;
    model = new DiskModel({ ...p });
    br = new DiskBrake(model, omega0);
    let g = 0;
    const { nx, mask } = model.grid;
    for (let k = nx + 1; k < model.psi.length - nx - 1; k++)
      if (mask[k]) g = Math.max(g, Math.hypot(model.psi[k + 1] - model.psi[k - 1], model.psi[k + nx] - model.psi[k - nx]) / 2);
    jRef = g * effScale(model.omegaC) * 0.7;
    wChart.clear(); pChart.clear(); eChart.clear();
    updateCurve();
  };
  /** Множник амплітуди ψ: тепло ∝ ψ², тож ψ ∝ ω/√(1 + (ω/ω_c)²). */
  const effScale = (w: number) => {
    const x = p.skin ? w / model.omegaC : 0;
    return w / Math.sqrt(1 + x * x);
  };
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = window.setTimeout(rebuild, 120); };

  page.params.append(
    select('Матеріал диска', [
      { value: 'al', text: 'Алюміній' }, { value: 'cu', text: 'Мідь' }, { value: 'brass', text: 'Латунь' }, { value: 'steel', text: 'Нержавіюча сталь' },
    ], mat, (v) => { mat = v; later(); }).el,
    slider({ label: 'Початкова ω₀', dim: 'omega', min: 10, max: 3000, value: omega0, log: true, onChange: (v) => { omega0 = v; later(); } }).el,
    slider({ label: 'Поле магніту B₀', dim: 'B', min: 200, max: 10000, value: p.B0, log: true, onChange: (v) => { p.B0 = v; later(); } }).el,
    slider({ label: 'Товщина диска d', dim: 'length', min: 0.05, max: 1.5, value: p.d, log: true, onChange: (v) => { p.d = v; later(); } }).el,
    slider({ label: 'Відстань магніту від осі r₀', dim: 'length', min: 3, max: 9.5, value: p.r0, onChange: (v) => { p.r0 = v; later(); } }).el,
    slider({ label: 'Момент приводу M_пр', dim: 'torque', min: 0, max: 5e7, value: 0, onChange: (v) => { p.drive = v; model.p.drive = v; } }).el,
    checkbox('Враховувати спадання моменту при великих ω (скін-ефект)', true, (v) => { p.skin = v; later(); }),
  );

  const wChart = page.addChart(new LiveChart(page.chartsEl, { title: 'Кутова швидкість ω(t)', yDim: 'omega', series: [{ label: 'ω', color: '#d6dde8', width: 2 }] }));
  const mPlot = page.addChart(new XYPlot(page.chartsEl, { title: 'Гальмівний момент |M|(ω) і робоча точка', xDim: 'omega', yDim: 'torque', xName: 'ω', yName: '|M|' }));
  const pChart = page.addChart(new LiveChart(page.chartsEl, { title: 'Потужність нагріву диска P = |M|ω', yDim: 'power', series: [{ label: 'P', color: '#ff7a59', width: 2 }] }));
  const eChart = page.addChart(new EnergyChart(page.chartsEl, 'Баланс: ½Jω² + Q − A_приводу = const'));

  const updateCurve = () => {
    const wMax = Math.max(4 * model.omegaC, 1.2 * omega0);
    const pts: [number, number][] = [];
    const lin: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const w = (wMax * i) / 200;
      pts.push([w, Math.abs(model.torque(w))]);
      lin.push([w, model.K0 * w]);
    }
    mPlot.curves = [
      { pts, color: COL.force, label: 'M(ω)' },
      { pts: lin, color: '#9ca3af', label: 'K₀ω (малі ω)', dash: [5, 4] },
    ];
    mPlot.yRange = [0, 1.15 * Math.max(...pts.map((q) => q[1]))];
    mPlot.xRange = [0, wMax];
  };

  page.hooks = {
    step: (dt) => br.step(dt),
    sample() {
      wChart.push(br.t, [br.y[0]]);
      pChart.push(br.t, [-model.torque(br.y[0]) * br.y[0]]);
      eChart.push(br.t, br.energies());
      mPlot.markers = [{ x: Math.abs(br.y[0]), y: Math.abs(model.torque(br.y[0])), color: '#fff', label: 'зараз' }];
    },
    reset: rebuild,
    draw(ctx, W, H) {
      const cx = W * 0.42, cy = H / 2;
      const sc = (H * 0.44) / p.Rd;
      const g = model.grid;
      const w = br.y[0];
      const s = effScale(w);
      const img = plateImage(g, model.psi, s, jRef, [175, 180, 190]);
      ctx.drawImage(img, cx - p.Rd * sc, cy - p.Rd * sc, 2 * p.Rd * sc, 2 * p.Rd * sc);
      // риски на диску (видно обертання)
      const ph = br.y[1];
      ctx.strokeStyle = 'rgba(40,45,55,0.6)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 12; k++) {
        const a = ph + (k * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * p.Rd * 0.15 * sc, cy - Math.sin(a) * p.Rd * 0.15 * sc);
        ctx.lineTo(cx + Math.cos(a) * p.Rd * 0.97 * sc, cy - Math.sin(a) * p.Rd * 0.97 * sc);
        ctx.stroke();
      }
      ctx.strokeStyle = '#d0d5dd';
      ctx.beginPath(); ctx.arc(cx, cy, p.Rd * sc, 0, 2 * Math.PI); ctx.stroke();
      const toScreen = (i: number, j: number): [number, number] => [cx + (model.x0 + i * g.h) * sc, cy - (model.x0 + j * g.h) * sc];
      drawStreamlines(ctx, g, model.psi, s, { toScreen, jRef, showLines: page.showLines, metal: [175, 180, 190] });
      // полюс магніту
      const px = cx + p.r0 * sc, pole = p.pole * sc;
      ctx.strokeStyle = COL.south;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(px - pole, cy - pole, 2 * pole, 2 * pole);
      ctx.setLineDash([]);
      if (page.showLines) for (let x = -0.6; x <= 0.6; x += 0.6) for (let y = -0.6; y <= 0.6; y += 0.6) fieldSymbol(ctx, px + x * pole, cy + y * pole, 4, false, 'rgba(78,168,255,0.7)');
      text(ctx, 'магніт (B ⊗)', px, cy - pole - 8, COL.bExt, 'center', 12);
      // швидкість диска під магнітом і сила гальмування
      const dir = Math.sign(w) || 1;
      arrow(ctx, px + pole + 14, cy + 30 * dir, px + pole + 14, cy - 30 * dir, '#d6dde8', 2, 8);
      text(ctx, 'v', px + pole + 20, cy - 30 * dir, '#d6dde8', 'left', 12);
      const M = model.torque(w);
      if (Math.abs(M) > 0) {
        const L = 60 * Math.min(1, Math.abs(M) / (model.K0 * model.omegaC * 0.5));
        arrow(ctx, px - pole - 14, cy - (L / 2) * -dir, px - pole - 14, cy + (L / 2) * -dir, COL.force, 3.5, 11);
        text(ctx, 'F гальм.', px - pole - 20, cy + 4, COL.force, 'right', 12, 'bold');
      }
      arcArrow(ctx, cx, cy, p.Rd * sc + 16, Math.PI * 0.75, 0.9, dir, '#d6dde8', 2);
      text(ctx, 'ω', cx - p.Rd * sc * 0.75 - 26, cy - p.Rd * sc * 0.75 - 8, '#d6dde8', 'center', 14, 'bold');
      if (p.drive > 0) text(ctx, 'привід увімкнено: диск виходить на усталену ω, де M_пр = |M(ω)|', 10, H - 10, COL.muted, 'left', 11);
    },
    updateNow(now) {
      const f = units.fmt;
      const w = br.y[0];
      now.set('Кутова швидкість ω', f(w, 'omega'));
      now.set('Оберти', `${((w * 60) / (2 * Math.PI)).toFixed(0)} об/хв`);
      now.set('Гальмівний момент M', f(model.torque(w), 'torque'));
      now.set('K₀ (M = −K₀ω при малих ω)', f(model.K0, 'angDamping'));
      now.set('ω_c = c²/(2πσ d r₀)', f(model.omegaC, 'omega'));
      now.set('ω/ω_c', (w / model.omegaC).toFixed(3));
      now.set('Макс. момент K₀ω_c/2', f((model.K0 * model.omegaC) / 2, 'torque'));
      now.set('Потужність нагріву', f(-model.torque(w) * w, 'power'));
      now.set('Момент інерції J', f(model.J, 'inertia'));
      now.setNote(w < model.omegaC
        ? 'Режим <b>малих швидкостей</b>: струми слабкі, їхнє власне поле мале, і момент ∝ σB²ω — як в\'язке тертя.'
        : 'Режим <b>великих швидкостей</b> (ω > ω_c): поле вихрових струмів стає порівнянним з B і «виштовхує» поле магніту з диска (скін-ефект), тому момент <b>спадає</b> зі зростанням ω.');
    },
  };

  rebuild();
  page.enable3D(() => import('../../sims3d/disk').then((m) => m.diskScene(() => ({ model, br, p, jRef, scale: effScale(br.y[0]) }))));
  page.setTheory(diskTheory());
  page.setQuiz(diskQuiz);
  return page;
}
