/** 1d. RL-коло з ручним вимикачем: аналітичний розв'язок через інтегрувальний множник τ(t) = e^{t/T}. */
import { RLCircuit } from '../../physics/rlCircuit';
import { fromSys } from '../../physics/units';
import { SimPage } from '../../ui/simpage';
import { slider, checkbox, button } from '../../ui/controls';
import { LiveChart, EnergyChart } from '../../ui/chart';
import { arrow, COL, currentColor, text } from '../../ui/draw';
import { units } from '../../ui/units-store';
import { rlTheory, rlQuiz } from './theory';

export function createRLSim(): SimPage {
  const page = new SimPage(
    '1d. RL-коло: самоіндукція і стала часу T',
    'Клацніть по вимикачу (або кнопку «Вимикач»). При розмиканні струм котушки замикається через діод і резистор R_d.',
    0.45,
  );
  const ohm = (x: number) => fromSys(x, 'resistance', 'SI');
  const henry = (x: number) => fromSys(x, 'inductance', 'SI');
  const volt = (x: number) => fromSys(x, 'voltage', 'SI');
  const rl = new RLCircuit({ emf: volt(12), R: ohm(10), Rd: ohm(20), L: henry(5) });
  let auto = true;
  let dotPhase = 0;

  const toggle = () => rl.setClosed(!rl.closed);
  const restart = () => {
    rl.reset();
    rl.setClosed(true);
    eChart.clear();
    iChart.clear();
    eLChart.clear();
  };

  page.tools.append(button('⚡ Вимикач', toggle));
  page.params.append(
    slider({ label: 'ЕРС батареї ε', dim: 'voltage', min: volt(1), max: volt(24), value: rl.p.emf, onChange: (v) => { rl.p.emf = v; rl.tSwitch = rl.t; rl.iSwitch = rl.y[0]; } }).el,
    slider({ label: 'Опір R', dim: 'resistance', min: ohm(1), max: ohm(100), value: rl.p.R, log: true, onChange: (v) => { rl.p.R = v; rl.tSwitch = rl.t; rl.iSwitch = rl.y[0]; } }).el,
    slider({ label: 'Індуктивність L', dim: 'inductance', min: henry(0.5), max: henry(20), value: rl.p.L, log: true, onChange: (v) => { rl.p.L = v; rl.tSwitch = rl.t; rl.iSwitch = rl.y[0]; } }).el,
    slider({ label: 'Розрядний резистор R_d', dim: 'resistance', min: ohm(1), max: ohm(200), value: rl.p.Rd, log: true, onChange: (v) => { rl.p.Rd = v; rl.tSwitch = rl.t; rl.iSwitch = rl.y[0]; } }).el,
    checkbox('Автоматично перемикати кожні 5T', true, (v) => (auto = v)),
  );

  const iChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'I(t): чисельний RK4 (суцільна) та аналітичний I = ε/R + (I₀ − ε/R)/τ(t) (пунктир)',
    yDim: 'current',
    series: [
      { label: 'I чисельний', color: COL.cur, width: 3 },
      { label: 'I аналітичний', color: '#ffffff', dash: [5, 5] },
    ],
  }));
  const eLChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'ЕРС самоіндукції ε_L = −(L/c²)dI/dt',
    yDim: 'voltage',
    series: [{ label: 'ε_L', color: COL.bInd }, { label: 'ε батареї', color: '#9ca3af', dash: [4, 4] }],
  }));
  const eChart = page.addChart(new EnergyChart(page.chartsEl, 'Баланс: A_батареї = Q + LI²/2c²'));

  page.canvas.addEventListener('click', (e) => {
    const [x, y] = page.mouse(e);
    if (x < page.W * 0.4 && y < page.H * 0.35) toggle();
  });

  page.hooks = {
    step(dt) {
      rl.step(dt);
      dotPhase += (rl.y[0] / (rl.p.emf / rl.p.R)) * dt * 40;
      if (auto && rl.t - rl.tSwitch > 5 * rl.T) toggle();
    },
    sample() {
      iChart.push(rl.t, [rl.y[0], rl.analytic()]);
      eLChart.push(rl.t, [rl.selfEmf(), rl.closed ? rl.p.emf : 0]);
      eChart.push(rl.t, rl.energies());
    },
    reset: restart,
    draw(ctx, W, H) {
      const L = W * 0.12, Rr = W * 0.66, T = H * 0.2, B = H * 0.82;
      const xD = W * 0.34; // гілка діод + R_d
      const I = rl.y[0];
      const Imax = rl.p.emf / rl.p.R;
      const frac = Math.abs(I) / Imax;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      // дроти
      const wire = (pts: [number, number][], col: string) => {
        ctx.strokeStyle = col;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      };
      const live = currentColor(frac);
      wire([[L, B], [L, T + 10]], rl.closed ? live : '#555');
      wire([[L + 70, T], [Rr, T], [Rr, B], [L, B]], live);
      wire([[xD, T], [xD, B]], rl.closed ? '#555' : live);
      // батарея
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(L - 20, (T + B) / 2 - 16, 40, 32);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(L - 18, (T + B) / 2 - 6); ctx.lineTo(L + 18, (T + B) / 2 - 6); ctx.stroke();
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(L - 9, (T + B) / 2 + 6); ctx.lineTo(L + 9, (T + B) / 2 + 6); ctx.stroke();
      text(ctx, 'ε', L - 30, (T + B) / 2 + 5, '#ddd', 'right', 15, 'bold');
      // вимикач
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(L, T + 10);
      if (rl.closed) ctx.lineTo(L + 70, T);
      else ctx.lineTo(L + 58, T - 34);
      ctx.stroke();
      ctx.fillStyle = '#ddd';
      for (const [x, y] of [[L, T + 10], [L + 70, T]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.fill(); }
      text(ctx, rl.closed ? 'замкнено' : 'розімкнено (клацніть)', L + 8, T - 40, rl.closed ? COL.good : COL.force, 'left', 12);
      // резистор R
      const rx = (xD + Rr) / 2;
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(rx - 40, T - 10, 80, 20);
      ctx.strokeStyle = '#e0c060';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rx - 40, T - 10, 80, 20);
      text(ctx, 'R', rx, T - 16, '#e0c060', 'center', 14, 'bold');
      // діод + R_d
      const yd = (T + B) / 2;
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(xD - 14, yd - 50, 28, 100);
      ctx.fillStyle = '#ddd';
      ctx.beginPath(); ctx.moveTo(xD - 11, yd + 26); ctx.lineTo(xD + 11, yd + 26); ctx.lineTo(xD, yd + 8); ctx.closePath(); ctx.fill();
      ctx.fillRect(xD - 11, yd + 5, 22, 3);
      ctx.strokeStyle = '#e0c060';
      ctx.strokeRect(xD - 8, yd - 45, 16, 36);
      text(ctx, 'R_d', xD + 16, yd - 24, '#e0c060', 'left', 12);
      text(ctx, 'діод', xD + 16, yd + 20, COL.muted, 'left', 11);
      // котушка L
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(Rr - 20, T + 40, 40, B - T - 80);
      ctx.strokeStyle = COL.copper;
      ctx.lineWidth = 3;
      const nT = 7;
      const hT = (B - T - 80) / nT;
      ctx.beginPath();
      for (let k = 0; k < nT; k++) ctx.arc(Rr, T + 40 + hT * (k + 0.5), hT / 2, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      // світіння ∝ енергії поля
      const wFrac = frac * frac;
      ctx.fillStyle = `rgba(192,132,252,${(0.08 + 0.35 * wFrac).toFixed(2)})`;
      ctx.beginPath(); ctx.ellipse(Rr, (T + B) / 2, 55, (B - T) / 2 - 30, 0, 0, 2 * Math.PI); ctx.fill();
      text(ctx, 'L', Rr + 30, (T + B) / 2 + 5, COL.copper, 'left', 15, 'bold');
      // ЕРС самоіндукції: стрілка проти зміни струму
      const eL = rl.selfEmf();
      if (Math.abs(eL) > 1e-3 * rl.p.emf) {
        const len = 60 * Math.min(1, Math.abs(eL) / rl.p.emf);
        // струм по котушці йде вниз (за год. стрілкою: ε → вимикач → R → L ↓ → низ)
        const s = Math.sign(eL); // ε_L > 0 — «штовхає» струм униз (по ходу), < 0 — проти
        arrow(ctx, Rr + 75, (T + B) / 2 - (s * len) / 2, Rr + 75, (T + B) / 2 + (s * len) / 2, COL.bInd, 3.5, 11);
        text(ctx, 'ε_L', Rr + 85, (T + B) / 2 + 4, COL.bInd, 'left', 13, 'bold');
        text(ctx, eL < 0 ? '(проти наростання струму)' : '(підтримує спадний струм)', Rr + 85, (T + B) / 2 + 20, COL.bInd, 'left', 11);
      }
      // «бігучі» точки струму вздовж R-L гілки
      if (frac > 0.01) {
        ctx.fillStyle = currentColor(frac);
        const ph = (((dotPhase * 10) % 30) + 30) % 30;
        for (let x = xD + ph; x < Rr; x += 30) { ctx.beginPath(); ctx.arc(x, T, 3.5, 0, 2 * Math.PI); ctx.fill(); }
        for (let x = Rr - ph; x > (rl.closed ? L : xD); x -= 30) { ctx.beginPath(); ctx.arc(x, B, 3.5, 0, 2 * Math.PI); ctx.fill(); }
      }
      // підсумок
      const t = rl.t - rl.tSwitch;
      text(ctx, `t − t_перемик = ${t.toFixed(2)} с = ${(t / rl.T).toFixed(2)} T`, W - 20, H - 12, COL.muted, 'right', 12);
      text(ctx, `τ(t) = e^(t/T) = ${Math.exp(Math.min(50, t / rl.T)).toPrecision(4)}`, W - 20, H - 28, COL.muted, 'right', 12);
    },
    updateNow(now) {
      const f = units.fmt;
      now.set('Стан вимикача', rl.closed ? 'замкнено' : 'розімкнено');
      now.set('Стала часу T', f(rl.T, 'time'));
      now.set('Струм I (RK4)', f(rl.y[0], 'current'));
      now.set('Струм I (аналітика)', f(rl.analytic(), 'current'));
      now.set('Відносна похибка', (Math.abs(rl.y[0] - rl.analytic()) / (rl.p.emf / rl.p.R)).toExponential(1));
      now.set('Усталений струм ε/R', f(rl.p.emf / rl.p.R, 'current'));
      now.set('ЕРС самоіндукції ε_L', f(rl.selfEmf(), 'voltage'));
      const e = rl.energies();
      now.set('Енергія поля W', f(e.mag, 'energy'));
      now.set('Тепло Q', f(e.heat, 'energy'));
      now.set('Робота батареї A', f(e.ext, 'energy'));
      now.setNote(rl.closed
        ? 'Струм наростає. ЕРС самоіндукції напрямлена <b>проти</b> батареї і сповільнює зміну струму (Ленц). Частина роботи батареї запасається в полі котушки.'
        : 'Батарею відключено. ЕРС самоіндукції <b>підтримує</b> струм, і він затухає через діод і R_d. Енергія поля котушки переходить у тепло.');
    },
  };

  restart();
  page.setTheory(rlTheory());
  page.setQuiz(rlQuiz);
  return page;
}
