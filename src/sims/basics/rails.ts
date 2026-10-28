/** 1c. Провідник на рейках у магнітному полі + демонстрація «анти-Ленца». */
import { Rails } from '../../physics/rails';
import { fromSys } from '../../physics/units';
import { C2 } from '../../physics/constants';
import { SimPage } from '../../ui/simpage';
import { slider, checkbox } from '../../ui/controls';
import { LiveChart, EnergyChart } from '../../ui/chart';
import { arrow, COL, currentColor, fieldSymbol, text, AutoScale } from '../../ui/draw';
import { units } from '../../ui/units-store';
import { railsTheory, railsQuiz } from './theory';

export function createRailsSim(): SimPage {
  const page = new SimPage(
    '1c. Провідник на рейках: ЕРС руху та «анти-Ленц»',
    'Поле B напрямлене на нас (⊙). Рухомий стрижень замикає контур через резистор R. ' +
      'Спробуйте перемикач «анти-Ленц», щоб побачити, чому в законі Фарадея стоїть мінус.',
    0.48,
  );
  const ohm = (x: number) => fromSys(x, 'resistance', 'SI');
  const henry = (x: number) => fromSys(x, 'inductance', 'SI');
  const r = new Rails({ B: 5000, l: 20, m: 50, R: ohm(0.2), L: 0, Fext: 0, antiLenz: false }, 50);
  let v0 = 50;
  let dotPhase = 0;

  const restart = () => {
    r.reset(r.p.antiLenz ? Math.min(v0, 2) : v0);
    eChart.clear();
    charts.forEach((c) => c.clear());
  };

  const warn = document.createElement('div');
  warn.className = 'callout warn';
  warn.style.display = 'none';
  warn.innerHTML = '<b>Анти-Ленц увімкнено!</b> Знак ЕРС навпаки — такого в природі немає. Дивіться, як «Сума» на графіку енергії зростає з нічого.';

  page.params.append(
    slider({ label: 'Початкова швидкість v₀', dim: 'velocity', min: 0, max: 200, value: v0, onChange: (v) => (v0 = v) }).el,
    slider({ label: 'Зовнішня сила F_зовн', dim: 'force', min: 0, max: 1e4, value: 0, onChange: (v) => (r.p.Fext = v) }).el,
    slider({ label: 'Індукція B', dim: 'B', min: 100, max: 15000, value: r.p.B, log: true, onChange: (v) => (r.p.B = v) }).el,
    slider({ label: 'Довжина стрижня l', dim: 'length', min: 5, max: 50, value: r.p.l, onChange: (v) => (r.p.l = v) }).el,
    slider({ label: 'Маса стрижня m', dim: 'mass', min: 5, max: 500, value: r.p.m, log: true, onChange: (v) => (r.p.m = v) }).el,
    slider({ label: 'Опір R', dim: 'resistance', min: ohm(0.01), max: ohm(10), value: r.p.R, log: true, onChange: (v) => (r.p.R = v) }).el,
    slider({ label: 'Індуктивність контуру L', dim: 'inductance', min: 0, max: henry(0.05), value: 0, onChange: (v) => { r.p.L = v; r.y[2] = r.current(); } }).el,
    checkbox('Анти-Ленц (уявний світ з ε = +(1/c)dΦ/dt)', false, (v) => {
      r.p.antiLenz = v;
      warn.style.display = v ? '' : 'none';
      restart();
    }),
    warn,
  );
  const hint = document.createElement('p');
  hint.className = 'muted';
  hint.textContent = 'Зміни v₀ застосовуються після «Скинути».';
  page.params.append(hint);

  const vChart = page.addChart(new LiveChart(page.chartsEl, { title: 'Швидкість стрижня v(t)', yDim: 'velocity', series: [{ label: 'v', color: '#d6dde8' }] }));
  const emfChart = page.addChart(new LiveChart(page.chartsEl, { title: 'ЕРС ε(t) = −(1/c)·dΦ/dt', yDim: 'voltage', series: [{ label: 'ε', color: COL.bInd }] }));
  const curChart = page.addChart(new LiveChart(page.chartsEl, { title: 'Струм I(t)', yDim: 'current', series: [{ label: 'I', color: COL.cur }] }));
  const eChart = page.addChart(new EnergyChart(page.chartsEl));
  const charts = [vChart, emfChart, curChart];
  const iS = new AutoScale(0.999), fS = new AutoScale(0.999);

  page.hooks = {
    step(dt) {
      r.step(dt);
      dotPhase += (r.current() / iS.value) * dt * 60;
    },
    sample() {
      vChart.push(r.t, [r.y[1]]);
      emfChart.push(r.t, [r.emf()]);
      curChart.push(r.t, [r.current()]);
      eChart.push(r.t, r.energies());
    },
    reset: restart,
    draw(ctx, W, H) {
      const x0 = 70, xEnd = W - 20;
      const yt = H * 0.22, yb = H * 0.78;
      const span = 100; // см відображуваної довжини рейок
      const sc = (xEnd - x0 - 40) / span;
      // стрижень «перескакує» на початок кожні span см (фізика від x не залежить, лише від v)
      const xr = x0 + 20 + (((r.y[0] % span) + span) % span) * sc;
      const I = r.current();
      const frac = Math.abs(I) / iS.update(I);

      // зовнішнє поле ⊙
      if (page.showLines) {
        for (let x = x0 - 40; x < W; x += 46)
          for (let y = 22; y < H; y += 46) fieldSymbol(ctx, x, y, 6, true, 'rgba(78,168,255,0.35)');
        text(ctx, 'B ⊙ (на нас)', W - 110, H - 8, COL.bExt, 'left', 12);
      }
      // індуковане поле в контурі: I>0 (проти год. стрілки) → ⊙, I<0 → ⊗
      if (frac > 0.03) {
        for (let x = x0 + 30; x < xr - 15; x += 46)
          for (let y = yt + 30; y < yb - 15; y += 46)
            fieldSymbol(ctx, x + 23, y + 8, 9, I > 0, `rgba(255,166,61,${(0.25 + 0.75 * Math.min(1, frac)).toFixed(2)})`);
      }
      // рейки
      ctx.strokeStyle = COL.metal;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x0, yt); ctx.lineTo(xEnd, yt);
      ctx.moveTo(x0, yb); ctx.lineTo(xEnd, yb);
      ctx.stroke();
      // резистор (зигзаг)
      ctx.strokeStyle = '#e0c060';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x0, yt);
      const nZ = 8;
      for (let k = 0; k <= nZ; k++) {
        const y = yt + 20 + ((yb - yt - 40) * k) / nZ;
        ctx.lineTo(x0 + (k % 2 ? 10 : -10), y);
      }
      ctx.lineTo(x0, yb);
      ctx.stroke();
      text(ctx, 'R', x0 - 22, (yt + yb) / 2 + 4, '#e0c060', 'right', 14, 'bold');
      // струм — «бігучі» точки вздовж контуру (I>0: вздовж нижньої рейки вправо, стрижнем угору)
      if (frac > 0.02) {
        const path: [number, number][] = [[x0, yb], [xr, yb], [xr, yt], [x0, yt]];
        const seg = path.map((p, i) => Math.hypot(path[(i + 1) % 4][0] - p[0], path[(i + 1) % 4][1] - p[1]));
        const per = seg.reduce((a, b) => a + b, 0);
        ctx.fillStyle = currentColor(frac);
        const step = 28;
        const ph = ((dotPhase * 10) % step + step) % step;
        for (let s = ph; s < per; s += step) {
          let rem = s, i = 0;
          while (rem > seg[i]) { rem -= seg[i]; i++; }
          const a = path[i], b = path[(i + 1) % 4];
          const f = rem / seg[i];
          ctx.beginPath();
          ctx.arc(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 3.5, 0, 2 * Math.PI);
          ctx.fill();
        }
        const s = Math.sign(I);
        arrow(ctx, xr + 14, (yt + yb) / 2 + s * 18, xr + 14, (yt + yb) / 2 - s * 18, COL.cur, 2.5, 9);
        text(ctx, 'I', xr + 22, (yt + yb) / 2 + 4, COL.cur, 'left', 13, 'bold');
      }
      // стрижень
      ctx.strokeStyle = COL.copper;
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(xr, yt - 12); ctx.lineTo(xr, yb + 12); ctx.stroke();
      // швидкість, сила Ампера, зовнішня сила
      const v = r.y[1];
      if (Math.abs(v) > 0.2) {
        const L = 20 + 50 * Math.min(1, Math.abs(v) / 150);
        arrow(ctx, xr, yt - 26, xr + Math.sign(v) * L, yt - 26, '#d6dde8', 2, 8);
        text(ctx, 'v', xr + Math.sign(v) * (L + 6), yt - 22, '#d6dde8', v > 0 ? 'left' : 'right', 13);
      }
      const F = r.force();
      if (Math.abs(F) > 1e-3 * fS.update(F)) {
        const L = 80 * Math.min(1, Math.abs(F) / fS.value);
        arrow(ctx, xr, yb + 26, xr + Math.sign(F) * L, yb + 26, COL.force, 3.5, 12);
        text(ctx, r.p.antiLenz ? 'F (анти-Ленц!)' : 'F Ампера (Ленц)', xr + Math.sign(F) * (L + 6), yb + 30, COL.force, F > 0 ? 'left' : 'right', 12, 'bold');
      }
      if (r.p.Fext > 0) {
        const L = 80 * Math.min(1, r.p.Fext / Math.max(fS.value, r.p.Fext));
        arrow(ctx, xr, (yt + yb) / 2 + 40, xr + L, (yt + yb) / 2 + 40, '#9ca3af', 3, 10);
        text(ctx, 'F зовн', xr + L + 6, (yt + yb) / 2 + 44, '#9ca3af', 'left', 12);
      }
      if (r.p.antiLenz) text(ctx, '⚠ АНТИ-ЛЕНЦ: енергія береться нізвідки', W / 2, 18, COL.force, 'center', 14, 'bold');
    },
    updateNow(now) {
      const f = units.fmt;
      const Tm = (r.p.m * C2 * r.p.R) / (r.p.B * r.p.l) ** 2;
      now.set('Швидкість v', f(r.y[1], 'velocity'));
      now.set('Пройдений шлях x', f(r.y[0], 'length'));
      now.set('ЕРС ε', f(r.emf(), 'voltage'));
      now.set('Струм I', f(r.current(), 'current'));
      now.set('Сила Ампера F', f(r.force(), 'force'));
      now.set('Механічна стала T_м', f(Tm, 'time'));
      now.set('Шлях до зупинки v₀T_м', f(v0 * Tm, 'length'));
      if (r.p.Fext > 0) now.set('Гранична швидкість v_∞', f((r.p.Fext * C2 * r.p.R) / (r.p.B * r.p.l) ** 2, 'velocity'));
      const e = r.energies();
      now.set('Кінетична енергія', f(e.mech, 'energy'));
      now.set('Тепло Q', f(e.heat, 'energy'));
      now.setNote(r.p.antiLenz
        ? 'Струм у «неправильному» напрямі: сила Ампера <b>допомагає</b> рухові, швидкість росте експоненційно. Кінетична енергія і тепло ростуть разом — порушення закону збереження енергії.'
        : 'Площа контуру (і потік) зростає → індуковане поле напрямлене <b>проти</b> зовнішнього (⊗ всередині контуру). Сила Ампера на стрижень гальмує рух.');
    },
  };

  restart();
  page.setTheory(railsTheory());
  page.setQuiz(railsQuiz);
  return page;
}
