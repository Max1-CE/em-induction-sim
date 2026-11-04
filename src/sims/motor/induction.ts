/** 3b. Асинхронний двигун (обертове поле трьох фаз) і 3c. демо «алюмінієва банка під обертовим магнітом». */
import { InductionMotor, type InductionParams } from '../../physics/inductionMotor';
import { fromSys } from '../../physics/units';
import { SimPage } from '../../ui/simpage';
import { slider } from '../../ui/controls';
import { LiveChart, EnergyChart, XYPlot } from '../../ui/chart';
import { arrow, COL, currentColor, fieldSymbol, magnet, text, AutoScale } from '../../ui/draw';
import { units } from '../../ui/units-store';
import { arcArrow } from '../basics/generator';
import { inductionTheory, inductionQuiz, canTheory, canQuiz } from './theory';

const PHASE = ['#f87171', '#facc15', '#a78bfa'];

interface Variant {
  can: boolean;
}

function build(v: Variant): SimPage {
  const page = v.can
    ? new SimPage(
      '3c. Демо: алюмінієва банка під обертовим магнітом',
      'Під легкою алюмінієвою банкою (вигляд згори) обертається постійний магніт. Вихрові струми в банці «захоплюють» її, ' +
        'і вона починає обертатися слідом, але завжди повільніше за магніт.',
      0.5,
    )
    : new SimPage(
      '3b. Асинхронний двигун: обертове магнітне поле',
      'Три котушки статора з фазами, зсунутими на 120°, створюють поле, вектор якого обертається з ω_поля. ' +
        'Стрижні «білкової клітки» ротора (⊙/⊗ — індуковані струми) тягнуться за полем, але відстають від нього.',
      0.52,
    );
  const ohm = (x: number) => fromSys(x, 'resistance', 'SI');
  const henry = (x: number) => fromSys(x, 'inductance', 'SI');
  const p: InductionParams = v.can
    ? { B0: 2500, fs: 1, S: 60, R: ohm(0.02), L: henry(0.03), N: 6, J: 150, b: 3, Mload: 0 }
    : { B0: 3000, fs: 0.5, S: 80, R: ohm(0.05), L: henry(0.1), N: 4, J: 400, b: 2, Mload: 0 };
  let m = new InductionMotor(p);

  const restart = () => {
    m = new InductionMotor({ ...p });
    wChart.clear(); sChart.clear(); eChart.clear(); iChart.clear();
    updateCurve();
  };
  const live = (fn: () => void) => () => { fn(); Object.assign(m.p, p); updateCurve(); };

  page.params.append(
    slider({ label: v.can ? 'Частота обертання магніту' : 'Частота мережі f (поля)', dim: 'freq', min: 0.1, max: 5, value: p.fs, log: true, onChange: (x) => live(() => (p.fs = x))() }).el,
    slider({ label: 'Індукція поля B₀', dim: 'B', min: 300, max: 10000, value: p.B0, log: true, onChange: (x) => live(() => (p.B0 = x))() }).el,
    slider({ label: v.can ? 'Опір контуру струму в банці R' : 'Опір рамки ротора R', dim: 'resistance', min: ohm(0.002), max: ohm(1), value: p.R, log: true, onChange: (x) => live(() => (p.R = x))() }).el,
    slider({ label: 'Індуктивність рамки L', dim: 'inductance', min: henry(0.005), max: henry(0.5), value: p.L, log: true, onChange: (x) => live(() => (p.L = x))() }).el,
    slider({ label: 'Момент навантаження M_нав', dim: 'torque', min: 0, max: 2000, value: 0, onChange: (x) => live(() => (p.Mload = x))() }).el,
    slider({ label: 'В\'язке тертя b', dim: 'angDamping', min: 0, max: 100, value: p.b, onChange: (x) => live(() => (p.b = x))() }).el,
    slider({ label: 'Момент інерції J', dim: 'inertia', min: 20, max: 5000, value: p.J, log: true, onChange: (x) => live(() => (p.J = x))() }).el,
  );
  if (!v.can) {
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = 'Кількість рамок клітки N змінюється з перезапуском:';
    page.params.append(note, slider({ label: 'Кількість рамок N', dim: 'none', min: 1, max: 8, value: p.N, integer: true, onChange: (x) => { p.N = x; restart(); } }).el);
  }

  const wChart = page.addChart(new LiveChart(page.chartsEl, {
    title: v.can ? 'Кутова швидкість банки і магніту' : 'Кутова швидкість ротора ω_р(t) і поля ω_п', yDim: 'omega',
    series: [{ label: v.can ? 'банка' : 'ротор', color: '#d6dde8', width: 2 }, { label: v.can ? 'магніт' : 'поле', color: COL.bExt, dash: [6, 4] }],
  }));
  const sChart = page.addChart(new LiveChart(page.chartsEl, { title: 'Ковзання s(t) = (ω_п − ω_р)/ω_п', yDim: 'none', series: [{ label: 's', color: COL.bInd, width: 2 }] }));
  const msPlot = page.addChart(new XYPlot(page.chartsEl, { title: 'Механічна характеристика M(s) (формула Клосса) і робоча точка', xDim: 'none', yDim: 'torque', xName: 's', yName: 'M' }));
  const iChart = page.addChart(new LiveChart(page.chartsEl, {
    title: 'Струм рамки ротора I₁(t): частота sf — «частота ковзання»', yDim: 'current', series: [{ label: 'I₁', color: COL.cur }],
  }));
  const eChart = page.addChart(new EnergyChart(page.chartsEl, 'Баланс: ½Jω² + W_L + Q − (A_поля − A_нав) = const'));

  const updateCurve = () => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const s = -0.2 + (1.4 * i) / 200;
      pts.push([s, m.steadyTorque(s)]);
    }
    msPlot.curves = [
      { pts, color: COL.force, label: 'M(s)' },
      { pts: [[-0.2, p.Mload], [1.2, p.Mload]], color: '#9ca3af', label: 'M_нав', dash: [5, 4] },
    ];
    msPlot.xRange = [-0.2, 1.2];
  };

  // ковзне середнє моменту за період поля (миттєвий момент пульсує при малих N)
  let mAvg = 0;
  const iS = new AutoScale(0.999);

  page.hooks = {
    step: (dt) => m.step(dt),
    sample() {
      const ws = m.ws;
      wChart.push(m.t, [m.y[0], ws]);
      sChart.push(m.t, [m.slip()]);
      iChart.push(m.t, [m.rotorCurrent(0)]);
      eChart.push(m.t, m.energies());
      mAvg += (m.torque() - mAvg) * 0.05;
      msPlot.markers = [{ x: m.slip(), y: mAvg, color: '#fff', label: 'зараз' }];
    },
    reset: restart,
    draw(ctx, W, H) {
      const cx = W * 0.4, cy = H / 2;
      const Rs = H * 0.43, Rr = H * 0.27;
      const ws = m.ws;
      const th = m.y[1];
      const psiB = m.fieldAngle();
      if (v.can) {
        // обертовий магніт під банкою
        ctx.globalAlpha = 0.55;
        magnet(ctx, cx, cy, 2 * Rs, 34, -psiB);
        ctx.globalAlpha = 1;
      } else {
        // статор: три котушки, струми i_j = cos(ω t − 2πj/3)
        ctx.strokeStyle = '#3a4456';
        ctx.lineWidth = 14;
        ctx.beginPath(); ctx.arc(cx, cy, Rs + 12, 0, 2 * Math.PI); ctx.stroke();
        for (let j = 0; j < 3; j++) {
          const ang = (2 * Math.PI * j) / 3;
          const ij = Math.cos(ws * m.t - ang);
          for (const sgn of [1, -1]) {
            const a = ang + (sgn > 0 ? 0 : Math.PI);
            const x = cx + Math.cos(a) * Rs, y = cy - Math.sin(a) * Rs;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-a);
            ctx.fillStyle = PHASE[j];
            ctx.globalAlpha = 0.25 + 0.75 * Math.abs(ij);
            ctx.fillRect(-10, -18, 20, 36);
            ctx.restore();
            ctx.globalAlpha = 1;
          }
          text(ctx, 'ABC'[j], cx + Math.cos(ang) * (Rs + 32), cy - Math.sin(ang) * (Rs + 32) + 5, PHASE[j], 'center', 14, 'bold');
          // складова поля від котушки j
          if (page.showLines) {
            const L = Rs * 0.55 * ij * (2 / 3);
            arrow(ctx, cx, cy, cx + Math.cos(ang) * L, cy - Math.sin(ang) * L, PHASE[j], 1.8, 7);
          }
        }
      }
      // ротор / банка
      ctx.fillStyle = v.can ? '#9aa4b2' : '#1d2430';
      ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 2;
      ctx.stroke();
      // мітка на роторі
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(th) * Rr * 0.9, cy - Math.sin(th) * Rr * 0.9); ctx.stroke();
      // стрижні клітки / вихрові струми банки
      let iMax = 0;
      for (let k = 0; k < p.N && k < m.p.N; k++) iMax = Math.max(iMax, Math.abs(m.rotorCurrent(k)));
      const Iref = iS.update(iMax);
      for (let k = 0; k < m.p.N; k++) {
        const I = m.rotorCurrent(k);
        const fr = Math.abs(I) / Iref;
        const nAng = th + (Math.PI * k) / m.p.N;
        for (const sg of [1, -1]) {
          const a = nAng + (sg * Math.PI) / 2;
          const x = cx + Math.cos(a) * Rr * 0.85, y = cy - Math.sin(a) * Rr * 0.85;
          // на +t (кут n + π/2) струм «на нас» при I > 0
          const out = sg > 0 ? I > 0 : I < 0;
          fieldSymbol(ctx, x, y, 7, out, fr > 0.05 ? currentColor(fr) : '#555');
          // сила на стрижень: F ∝ I_bar ẑ × B, ẑ × (cos ψ, sin ψ) = (−sin ψ, cos ψ)
          if (fr > 0.2) {
            const s = out ? 1 : -1;
            const fx = -Math.sin(psiB) * s, fy = Math.cos(psiB) * s;
            const L = 26 * fr;
            arrow(ctx, x, y, x + fx * L, y - fy * L, COL.force, 2, 7);
          }
        }
      }
      // результуюче поле
      const BL = Rs * 0.85;
      arrow(ctx, cx - Math.cos(psiB) * BL * 0.2, cy + Math.sin(psiB) * BL * 0.2, cx + Math.cos(psiB) * BL, cy - Math.sin(psiB) * BL, COL.bExt, 4.5, 14);
      text(ctx, 'B', cx + Math.cos(psiB) * (BL + 14), cy - Math.sin(psiB) * (BL + 14) + 5, COL.bExt, 'center', 15, 'bold');
      arcArrow(ctx, cx, cy, Rs + 30, 0.3, 0.8, 1, COL.bExt, 2);
      text(ctx, 'ω поля', cx + Rs * 0.95, cy - Rs * 0.62, COL.bExt, 'left', 12);
      if (m.y[0] > 0.05) arcArrow(ctx, cx, cy, Rr + 10, Math.PI + 0.3, 0.8, 1, '#d6dde8', 2);
      // відставання
      const lag = ((((psiB - th) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      text(ctx, `ковзання s = ${m.slip().toFixed(3)}`, W - 16, 24, COL.bInd, 'right', 14, 'bold');
      text(ctx, `ротор відстає від поля: ${(((lag * 180) / Math.PI + 360) % 360).toFixed(0)}° (змінюється)`, W - 16, 44, COL.muted, 'right', 11);
      text(ctx, `частота струму в роторі = s·f = ${(m.slip() * p.fs).toFixed(3)} Гц`, W - 16, 62, COL.muted, 'right', 11);
      if (p.Mload > m.Mmax) text(ctx, '⚠ M_нав > M_max: двигун «перекидається» і зупиняється', W - 16, H - 12, COL.force, 'right', 12, 'bold');
    },
    updateNow(now) {
      const f = units.fmt;
      now.set(v.can ? 'ω магніту' : 'ω поля (синхронна)', f(m.ws, 'omega'));
      now.set(v.can ? 'ω банки' : 'ω ротора', f(m.y[0], 'omega'));
      now.set('Ковзання s', m.slip().toFixed(4));
      now.set('Момент (середній)', f(mAvg, 'torque'));
      now.set('Критичне ковзання s_k', m.sCrit.toFixed(3));
      now.set('Максимальний момент M_max', f(m.Mmax, 'torque'));
      now.set('Пусковий момент M(1)', f(m.steadyTorque(1), 'torque'));
      now.set('Втрати в роторі = s·P_поля', f(m.slip() * mAvg * m.ws, 'power'));
      now.set('Стала часу ротора T = L/c²R', f(m.T, 'time'));
      now.setNote(
        'Якби ротор обертався <b>синхронно</b> з полем (s = 0), потік через його рамки не змінювався б, ЕРС і струмів не було б, а отже і моменту. ' +
          'Тому ротор завжди відстає настільки, щоб індуковані струми давали момент, рівний навантаженню й тертю. ' +
          'Струми протидіють <b>відносному</b> руху поля і ротора (Ленц), тобто «тягнуть» ротор за полем.',
      );
    },
  };

  restart();
  const iS3 = new AutoScale(0.999);
  page.enable3D(() => import('../../sims3d/induction').then((mod) => mod.inductionScene(() => {
    let iMax = 0;
    for (let k = 0; k < m.p.N; k++) iMax = Math.max(iMax, Math.abs(m.rotorCurrent(k)));
    return { m, can: v.can, iRef: iS3.update(iMax) };
  }, v.can)));
  page.setTheory(v.can ? canTheory() : inductionTheory());
  page.setQuiz(v.can ? canQuiz : inductionQuiz);
  return page;
}

export const createInductionSim = (): SimPage => build({ can: false });
export const createCanSim = (): SimPage => build({ can: true });
