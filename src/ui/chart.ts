/**
 * Графіки:
 *  LiveChart — часові ряди на uPlot (оновлення ≥30 fps), дані зберігаються в СГС,
 *              переводяться у вибрану систему під час малювання;
 *  XYPlot    — статичні характеристики y(x) (M(s), ω(M), j(глибина)…) з маркером робочої точки.
 */
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Dim } from '../physics/units';
import { fmtNum, toSys, unitLabel } from '../physics/units';
import type { EnergyBudget } from '../physics/energy';
import { energyTotal } from '../physics/energy';
import { h } from './dom';
import { units } from './units-store';

export interface SeriesDef {
  label: string;
  color: string;
  dash?: number[];
  width?: number;
}

export interface ChartOpts {
  title: string;
  yDim: Dim;
  xDim?: Dim;
  series: SeriesDef[];
  /** Скільки останніх точок тримати (≈ maxPoints/60 секунд при запису кожного кадру). */
  maxPoints?: number;
  height?: number;
}

const AXIS = { stroke: '#8d97a8', grid: { stroke: '#222a38', width: 1 }, ticks: { stroke: '#2a3242', width: 1 } };

export class LiveChart {
  el: HTMLElement;
  note: HTMLElement;
  private plotEl: HTMLElement;
  private u: uPlot | null = null;
  private xs: number[] = [];
  private ys: number[][];
  private dirty = true;
  private ro: ResizeObserver;

  constructor(parent: HTMLElement, private o: ChartOpts) {
    this.ys = o.series.map(() => []);
    this.plotEl = h('div', {});
    this.note = h('div', { class: 'chart-note' });
    this.el = h('div', { class: 'chart-box' }, h('div', { class: 'chart-title' }, o.title), this.plotEl, this.note);
    parent.append(this.el);
    units.on(() => this.rebuild());
    this.ro = new ResizeObserver(() => {
      if (this.u && this.plotEl.clientWidth > 0) this.u.setSize({ width: this.plotEl.clientWidth, height: this.o.height ?? 190 });
    });
    this.ro.observe(this.plotEl);
  }

  private rebuild(): void {
    this.u?.destroy();
    this.u = null;
    this.dirty = true;
    this.render();
  }

  private create(): void {
    const width = this.plotEl.clientWidth;
    if (width <= 0) return;
    const sys = units.sys;
    const xDim = this.o.xDim ?? 'time';
    const yu = unitLabel(this.o.yDim, sys);
    const xu = unitLabel(xDim, sys);
    const opts: uPlot.Options = {
      width,
      height: this.o.height ?? 190,
      legend: { show: true, live: false },
      cursor: { show: false },
      scales: { x: { time: false } },
      axes: [
        { ...AXIS, label: xDim === 'time' ? 't, с' : xu, labelSize: 18, size: 34, values: (_u, v) => v.map((x) => fmtNum(x, 3)) },
        { ...AXIS, label: yu, labelSize: 18, size: 62, values: (_u, v) => v.map((x) => fmtNum(x, 3)) },
      ],
      series: [
        { label: 't' },
        ...this.o.series.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: s.width ?? 1.6,
          dash: s.dash,
          points: { show: false },
        })),
      ],
    };
    this.u = new uPlot(opts, [[], ...this.o.series.map(() => [])], this.plotEl);
  }

  /** Додати точку (значення в СГС). */
  push(x: number, ys: number[]): void {
    this.xs.push(x);
    for (let i = 0; i < this.ys.length; i++) this.ys[i].push(ys[i] ?? NaN);
    const max = this.o.maxPoints ?? 1200;
    if (this.xs.length > max) {
      const k = this.xs.length - max;
      this.xs.splice(0, k);
      for (const a of this.ys) a.splice(0, k);
    }
    this.dirty = true;
  }

  clear(): void {
    this.xs = [];
    this.ys = this.o.series.map(() => []);
    this.dirty = true;
  }

  render(): void {
    if (!this.dirty) return;
    if (!this.u) this.create();
    if (!this.u) return;
    const sys = units.sys;
    const xDim = this.o.xDim ?? 'time';
    const fx = toSys(1, xDim, sys);
    const fy = toSys(1, this.o.yDim, sys);
    const data: number[][] = [this.xs.map((x) => x * fx), ...this.ys.map((a) => a.map((y) => y * fy))];
    this.u.setData(data as uPlot.AlignedData);
    this.dirty = false;
  }
}

/** Графік енергетичного балансу: E_мех, W_маг, Q, A_зовн та їх сума (повинна бути сталою). */
export class EnergyChart {
  chart: LiveChart;
  private e0: EnergyBudget | null = null;
  private maxErr = 0;

  constructor(parent: HTMLElement, title = 'Енергетичний баланс: E_мех + W_маг + Q − A_зовн = const') {
    this.chart = new LiveChart(parent, {
      title,
      yDim: 'energy',
      series: [
        { label: 'E_мех', color: '#6aa9ff' },
        { label: 'W_маг', color: '#c084fc' },
        { label: 'Q (тепло)', color: '#ff7a59' },
        { label: 'A_зовн', color: '#9ca3af', dash: [4, 4] },
        { label: 'Сума', color: '#ffffff', width: 2.4 },
      ],
    });
  }

  push(t: number, e: EnergyBudget): void {
    if (!this.e0) this.e0 = e;
    this.chart.push(t, [e.mech, e.mag, e.heat, e.ext, energyTotal(e)]);
    const scale = Math.max(Math.abs(this.e0.mech), Math.abs(e.mech), e.heat, Math.abs(e.ext), e.mag, 1e-300);
    const err = Math.abs(energyTotal(e) - energyTotal(this.e0)) / scale;
    this.maxErr = Math.max(this.maxErr, err);
    const ok = this.maxErr < 0.01;
    this.chart.note.innerHTML = `Відхилення суми: <span class="${ok ? 'ok' : 'bad'}">${(err * 100).toExponential(2)} %</span> (макс. ${(this.maxErr * 100).toExponential(2)} %)`;
  }

  clear(): void {
    this.e0 = null;
    this.maxErr = 0;
    this.chart.clear();
  }

  render(): void {
    this.chart.render();
  }
}

export interface Curve {
  pts: [number, number][];
  color: string;
  label: string;
  dash?: number[];
}

export interface Marker {
  x: number;
  y: number;
  color: string;
  label?: string;
}

/** Простий XY-графік на canvas (для характеристик), значення в СГС. */
export class XYPlot {
  el: HTMLElement;
  note: HTMLElement;
  private cv: HTMLCanvasElement;
  curves: Curve[] = [];
  markers: Marker[] = [];
  /** Фіксовані межі (СГС), якщо треба. */
  xRange: [number, number] | null = null;
  yRange: [number, number] | null = null;

  constructor(
    parent: HTMLElement,
    private o: { title: string; xDim: Dim; yDim: Dim; xName: string; yName: string; height?: number },
  ) {
    this.cv = h('canvas', { class: 'xyplot' });
    this.note = h('div', { class: 'chart-note' });
    this.el = h('div', { class: 'chart-box' }, h('div', { class: 'chart-title' }, o.title), this.cv, this.note);
    parent.append(this.el);
    units.on(() => this.render());
    new ResizeObserver(() => this.render()).observe(this.cv);
  }

  render(): void {
    const cv = this.cv;
    const W = cv.clientWidth;
    const H = this.o.height ?? 200;
    if (W <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.height = H + 'px';
    }
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sys = units.sys;
    const fx = toSys(1, this.o.xDim, sys);
    const fy = toSys(1, this.o.yDim, sys);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of this.curves)
      for (const [x, y] of c.pts) {
        if (!isFinite(x) || !isFinite(y)) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    for (const m of this.markers) {
      x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x); y0 = Math.min(y0, m.y); y1 = Math.max(y1, m.y);
    }
    if (this.xRange) [x0, x1] = this.xRange;
    if (this.yRange) [y0, y1] = this.yRange;
    if (!isFinite(x0) || !isFinite(y0)) return;
    if (y0 > 0 && !this.yRange) y0 = 0;
    if (x1 === x0) x1 = x0 + 1;
    if (y1 === y0) y1 = y0 + 1;
    const padY = (y1 - y0) * 0.06;
    if (!this.yRange) { y1 += padY; if (y0 < 0) y0 -= padY; }
    const L = 64, R = 12, T = 10, B = 34;
    const X = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
    const Y = (y: number) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.strokeStyle = '#222a38';
    ctx.fillStyle = '#8d97a8';
    ctx.lineWidth = 1;
    // Поділки рахуємо у відображуваних одиницях, щоб вони були «круглими» в обох системах.
    for (const tv of niceTicks(x0 * fx, x1 * fx)) {
      const v = tv / fx;
      ctx.beginPath();
      ctx.moveTo(X(v), T); ctx.lineTo(X(v), H - B);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(fmtNum(tv, 3), X(v), H - B + 13);
    }
    for (const tv of niceTicks(y0 * fy, y1 * fy)) {
      const v = tv / fy;
      ctx.beginPath();
      ctx.moveTo(L, Y(v)); ctx.lineTo(W - R, Y(v));
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(fmtNum(tv, 3), L - 4, Y(v) + 4);
    }
    ctx.textAlign = 'center';
    const xu = unitLabel(this.o.xDim, sys);
    const yu = unitLabel(this.o.yDim, sys);
    ctx.fillText(`${this.o.xName}${xu ? ', ' + xu : ''}`, (L + W - R) / 2, H - 4);
    ctx.save();
    ctx.translate(11, (T + H - B) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${this.o.yName}${yu ? ', ' + yu : ''}`, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, T, W - L - R, H - T - B);
    ctx.clip();
    for (const c of this.curves) {
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(c.dash ?? []);
      ctx.beginPath();
      let first = true;
      for (const [x, y] of c.pts) {
        if (!isFinite(x) || !isFinite(y)) { first = true; continue; }
        if (first) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
        first = false;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const m of this.markers) {
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(X(m.x), Y(m.y), 5, 0, 2 * Math.PI);
      ctx.fill();
      if (m.label) {
        ctx.textAlign = 'left';
        ctx.fillText(m.label, X(m.x) + 7, Y(m.y) - 6);
      }
    }
    ctx.restore();
    // легенда
    let lx = L + 6;
    ctx.textAlign = 'left';
    for (const c of this.curves) {
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(c.dash ?? []);
      ctx.beginPath(); ctx.moveTo(lx, T + 8); ctx.lineTo(lx + 16, T + 8); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#c9d2e0';
      ctx.fillText(c.label, lx + 20, T + 12);
      lx += 28 + ctx.measureText(c.label).width;
    }
  }
}

function niceTicks(a: number, b: number, n = 5): number[] {
  const span = b - a;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const r = step0 / mag;
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9 * span; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}
