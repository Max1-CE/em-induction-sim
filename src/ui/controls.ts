/** Елементи керування: слайдери з одиницями, списки, перемикачі. */
import type { Dim } from '../physics/units';
import { fmtNum } from '../physics/units';
import { h } from './dom';
import { units } from './units-store';

export interface SliderOpts {
  label: string;
  /** Розмірність — задає одиниці відображення; значення завжди в СГС. */
  dim: Dim;
  min: number;
  max: number;
  value: number;
  /** Логарифмічна шкала (для величин, що змінюються на порядки). */
  log?: boolean;
  /** Округлення до цілого (кількість витків, кілець…). */
  integer?: boolean;
  digits?: number;
  /** Довільний показ значення замість стандартного. */
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

const STEPS = 1000;

export interface Slider {
  el: HTMLElement;
  get value(): number;
  set(v: number, fire?: boolean): void;
}

export function slider(o: SliderOpts): Slider {
  let value = o.value;
  const input = h('input', { type: 'range', min: 0, max: STEPS, step: 1 }) as HTMLInputElement;
  const val = h('span', { class: 'val' });
  const toPos = (v: number) =>
    o.log
      ? (Math.log(v / o.min) / Math.log(o.max / o.min)) * STEPS
      : ((v - o.min) / (o.max - o.min)) * STEPS;
  const fromPos = (p: number) => {
    const f = p / STEPS;
    let v = o.log ? o.min * Math.pow(o.max / o.min, f) : o.min + f * (o.max - o.min);
    if (o.integer) v = Math.round(v);
    return v;
  };
  const show = () => {
    val.textContent = o.format
      ? o.format(value)
      : o.dim === 'none'
        ? fmtNum(value, o.digits ?? 3)
        : units.fmt(value, o.dim, o.digits ?? 3);
  };
  input.value = String(toPos(value));
  input.addEventListener('input', () => {
    value = fromPos(Number(input.value));
    show();
    o.onChange(value);
  });
  units.on(show);
  show();
  const el = h('div', { class: 'ctl' }, h('label', {}, h('span', {}, o.label), val), input);
  return {
    el,
    get value() {
      return value;
    },
    set(v: number, fire = true) {
      value = v;
      input.value = String(toPos(v));
      show();
      if (fire) o.onChange(v);
    },
  };
}

export function select<T extends string>(
  label: string,
  options: { value: T; text: string }[],
  value: T,
  onChange: (v: T) => void,
): { el: HTMLElement; sel: HTMLSelectElement } {
  const sel = h('select', {}) as HTMLSelectElement;
  for (const op of options) sel.append(h('option', { value: op.value }, op.text));
  sel.value = value;
  sel.addEventListener('change', () => onChange(sel.value as T));
  return { el: h('div', { class: 'ctl' }, h('label', {}, h('span', {}, label)), sel), sel };
}

export function checkbox(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const inp = h('input', { type: 'checkbox' }) as HTMLInputElement;
  inp.checked = value;
  inp.addEventListener('change', () => onChange(inp.checked));
  return h('label', { class: 'check' }, inp, label);
}

export function button(text: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  return h('button', { class: cls, onclick: onClick }, text) as HTMLButtonElement;
}

/** Таблиця «що зараз відбувається»: рядки підпис → значення, оновлюються ззовні. */
export class NowPanel {
  el: HTMLElement;
  private table: HTMLTableElement;
  private rows = new Map<string, HTMLTableCellElement>();
  note: HTMLElement;

  constructor() {
    this.table = h('table', { class: 'now-table' });
    this.note = h('div', { class: 'now-note' });
    this.el = h('div', {}, this.table, this.note);
  }

  set(label: string, text: string): void {
    let td = this.rows.get(label);
    if (!td) {
      td = h('td', {});
      this.table.append(h('tr', {}, h('td', {}, label), td));
      this.rows.set(label, td);
    }
    if (td.textContent !== text) td.textContent = text;
  }

  private lastNote = '';

  setNote(html: string): void {
    if (this.lastNote === html) return;
    this.lastNote = html;
    this.note.innerHTML = html;
  }
}
