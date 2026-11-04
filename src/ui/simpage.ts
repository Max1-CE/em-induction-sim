/**
 * Каркас сторінки симуляції: анімація + панель інструментів (пауза, крок, швидкість ×0.1–×2, скидання,
 * силові лінії), параметри, «що зараз відбувається», графіки, теорія, «Перевір себе».
 * Цикл анімації працює лише коли сторінка активна.
 */
import { h } from './dom';
import { NowPanel, button } from './controls';
import { renderMath } from './tex';
import { quiz, type QuizQ } from './quiz';
import { fmtNum } from '../physics/units';
import type { Scene3D, Scene3DFactory, View3D } from './view3d';

export interface Renderable {
  render(): void;
}

export interface SimHooks {
  /** Просунути фізику на dt (с модельного часу). */
  step(dt: number): void;
  /** Намалювати кадр. */
  draw(ctx: CanvasRenderingContext2D, W: number, H: number): void;
  /** Записати точки на графіки (викликається після кожного кроку). */
  sample?(): void;
  /** Оновити числову панель (≈10 разів на секунду). */
  updateNow?(now: NowPanel): void;
  reset(): void;
}

export interface Page {
  el: HTMLElement;
  activate(): void;
  deactivate(): void;
}

export class SimPage implements Page {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  params: HTMLElement;
  now = new NowPanel();
  chartsEl: HTMLElement;
  theoryEl: HTMLElement;
  quizEl: HTMLElement;
  /** Додаткові кнопки в панелі інструментів (для конкретної симуляції). */
  tools: HTMLElement;

  speed = 1;
  paused = false;
  showLines = true;
  /** Показувати вектори (B, v, F, I, ω) у 3D-сцені. */
  showVectors = true;
  mode3d = false;
  W = 800;
  H = 450;

  hooks!: SimHooks;
  private charts: Renderable[] = [];
  private raf = 0;
  private last = 0;
  private lastChart = 0;
  private lastNow = 0;
  private pauseBtn: HTMLButtonElement;
  private stage!: HTMLElement;
  private s3: { view: View3D; scene: Scene3D } | null = null;
  private s3err = '';

  constructor(title: string, lead: string, private aspect = 0.5) {
    this.canvas = h('canvas', {});
    this.ctx = this.canvas.getContext('2d')!;
    this.params = h('div', {});
    this.chartsEl = h('div', { class: 'charts' });
    this.theoryEl = h('div', { class: 'card theory' });
    this.quizEl = h('div', {});
    this.tools = h('span', { class: 'toolbar', style: { marginTop: '0' } });

    this.pauseBtn = button('⏸ Пауза', () => this.setPaused(!this.paused));
    const stepBtn = button('⏭ Крок', () => {
      this.setPaused(true);
      this.advance(1 / 60);
    });
    const resetBtn = button('⟲ Скинути', () => this.reset());
    const linesBtn = button('Силові лінії', () => {
      this.showLines = !this.showLines;
      linesBtn.classList.toggle('on', this.showLines);
    });
    linesBtn.classList.add('on');
    const speedVal = h('span', {}, '×1.00');
    const speedIn = h('input', { type: 'range', min: -1, max: Math.log10(2), step: 0.01, value: 0 }) as HTMLInputElement;
    speedIn.addEventListener('input', () => {
      this.speed = 10 ** Number(speedIn.value);
      speedVal.textContent = '×' + this.speed.toFixed(2);
    });
    const toolbar = h('div', { class: 'toolbar' },
      this.pauseBtn, stepBtn, resetBtn, linesBtn,
      h('span', { class: 'speed' }, 'швидкість', speedIn, speedVal),
      this.tools,
    );

    this.el = h('div', {},
      h('h2', { class: 'sim-title' }, title),
      lead ? h('p', { class: 'sim-lead', html: lead }) : null,
      h('div', { class: 'sim-grid' },
        h('div', { class: 'card' }, (this.stage = h('div', { class: 'stage' }, this.canvas)), toolbar),
        h('div', { class: 'side' },
          h('div', { class: 'card' }, h('h3', {}, 'Параметри'), this.params),
          h('div', { class: 'card' }, h('h3', {}, 'Що зараз відбувається'), this.now.el),
        ),
      ),
      this.chartsEl,
      this.theoryEl,
      this.quizEl,
    );
  }

  /**
   * Додати 3D-вид. load() ліниво завантажує модуль сцени (і three.js).
   * Режим запам'ятовується (localStorage) і за замовчуванням увімкнений.
   */
  enable3D(load: () => Promise<Scene3DFactory>): void {
    const b3 = button('🧊 3D', () => set3d(!this.mode3d));
    const bv = button('➚ Вектори', () => {
      this.showVectors = !this.showVectors;
      bv.classList.toggle('on', this.showVectors);
      localStorage.setItem('em-vec', this.showVectors ? '1' : '0');
    });
    this.showVectors = localStorage.getItem('em-vec') !== '0';
    bv.classList.toggle('on', this.showVectors);
    const msg = h('span', { class: 'muted', style: { fontSize: '12px' } });
    this.tools.prepend(b3, bv, msg);
    let loading: Promise<void> | null = null;
    const ensure = () => (loading ??= Promise.all([import('./view3d'), load()]).then(([m, factory]) => {
      const view = new m.View3D();
      this.stage.append(view.el);
      this.s3 = { view, scene: factory(view) };
    }));
    const set3d = (on: boolean) => {
      this.mode3d = on;
      b3.classList.toggle('on', on);
      bv.style.display = on ? '' : 'none';
      localStorage.setItem('em-3d', on ? '1' : '0');
      if (!on) {
        this.canvas.style.display = '';
        if (this.s3) this.s3.view.el.style.display = 'none';
        return;
      }
      msg.textContent = this.s3 ? '' : 'завантаження 3D…';
      ensure().then(() => {
        msg.textContent = '';
        if (!this.mode3d || !this.s3) return;
        this.canvas.style.display = 'none';
        this.s3.view.el.style.display = '';
      }).catch((e) => {
        console.error(e);
        this.s3err = String(e);
        msg.textContent = '3D недоступне (WebGL): ' + this.s3err.slice(0, 60);
        this.mode3d = false;
        b3.classList.remove('on');
        bv.style.display = 'none';
        this.canvas.style.display = '';
      });
    };
    set3d(localStorage.getItem('em-3d') !== '0');
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.pauseBtn.textContent = p ? '▶ Пуск' : '⏸ Пауза';
  }

  addChart<T extends Renderable>(c: T): T {
    this.charts.push(c);
    return c;
  }

  setTheory(html: string): void {
    this.theoryEl.innerHTML = html;
    renderMath(this.theoryEl);
  }

  setQuiz(qs: QuizQ[]): void {
    quiz(this.quizEl, qs);
  }

  reset(): void {
    this.hooks.reset();
    this.hooks.sample?.();
    this.charts.forEach((c) => c.render());
  }

  /** Координати миші в CSS-пікселях canvas. */
  mouse(e: MouseEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private advance(dt: number): void {
    this.hooks.step(dt * this.speed);
    this.hooks.sample?.();
  }

  private resize(): void {
    const w = this.canvas.clientWidth || 800;
    const hgt = Math.min(Math.round(w * this.aspect), 620);
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hgt * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hgt * dpr);
      this.canvas.style.height = hgt + 'px';
    }
    this.W = w;
    this.H = hgt;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private frame = (ts: number): void => {
    const dtReal = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    if (!this.paused && dtReal > 0) this.advance(dtReal);
    if (this.mode3d && this.s3) {
      const w = this.stage.clientWidth || 800;
      this.s3.view.resize(w, Math.min(Math.round(w * Math.max(this.aspect, 0.56)), 640));
      try {
        this.s3.scene.update({ vectors: this.showVectors, lines: this.showLines });
      } catch (e) {
        console.error(e);
      }
      this.s3.view.render();
    } else {
      this.resize();
      this.ctx.clearRect(0, 0, this.W, this.H);
      this.hooks.draw(this.ctx, this.W, this.H);
    }
    if (ts - this.lastChart > 30) {
      this.charts.forEach((c) => c.render());
      this.lastChart = ts;
    }
    if (ts - this.lastNow > 100) {
      this.hooks.updateNow?.(this.now);
      this.lastNow = ts;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  activate(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  deactivate(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

/** Відносне значення у відсотках для панелей. */
export const pct = (x: number): string => `${fmtNum(100 * x, 3)} %`;
