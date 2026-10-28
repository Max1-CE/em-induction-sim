/** Допоміжні функції малювання на Canvas 2D (спільні для всіх анімацій). */

export const COL = {
  bExt: '#4ea8ff',   // зовнішнє поле
  bInd: '#ffa63d',   // поле індукованих струмів
  cur: '#5eead4',    // індукований струм
  force: '#ff5d5d',  // сила/момент протидії (Ленц)
  text: '#e4e8ef',
  muted: '#8d97a8',
  north: '#e5484d',
  south: '#3e7bfa',
  copper: '#c8794a',
  metal: '#9aa4b2',
  bg: '#0a0d12',
  good: '#4ade80',
};

export function arrow(
  ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number,
  color: string, width = 2, head = 8,
): void {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const ux = dx / len, uy = dy / len;
  const hd = Math.min(head, len * 0.6);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - ux * hd * 0.8, y1 - uy * hd * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * hd - uy * hd * 0.5, y1 - uy * hd + ux * hd * 0.5);
  ctx.lineTo(x1 - ux * hd + uy * hd * 0.5, y1 - uy * hd - ux * hd * 0.5);
  ctx.closePath();
  ctx.fill();
}

/** Стрілка-підпис: стрілка + текст біля кінця. */
export function labeledArrow(
  ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number,
  color: string, label: string, width = 2.5,
): void {
  arrow(ctx, x0, y0, x1, y1, color, width, 10);
  text(ctx, label, x1 + (x1 >= x0 ? 6 : -6), y1 + (y1 >= y0 ? 12 : -6), color, x1 >= x0 ? 'left' : 'right');
}

export function text(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number,
  color = COL.text, align: CanvasTextAlign = 'left', size = 12, weight = '',
): void {
  ctx.font = `${weight} ${size}px Segoe UI, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}

/** Символ «поле на нас» ⊙ або «від нас» ⊗. */
export function fieldSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, out: boolean, color: string): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.stroke();
  if (out) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.3, 0, 2 * Math.PI);
    ctx.fill();
  } else {
    const k = r * 0.65;
    ctx.beginPath();
    ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k);
    ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k);
    ctx.stroke();
  }
}

/**
 * Прямокутний магніт з полюсами. Вісь магніту — від S до N, кут angle (рад) від осі +x екрана.
 */
export function magnet(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, wid: number, angle: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = COL.south;
  ctx.fillRect(-len / 2, -wid / 2, len / 2, wid);
  ctx.fillStyle = COL.north;
  ctx.fillRect(0, -wid / 2, len / 2, wid);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(-len / 2, -wid / 2, len, wid);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.min(wid * 0.6, 16)}px Segoe UI, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', -len / 4, 0);
  ctx.fillText('N', len / 4, 0);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

/** Колір індукованого струму з яскравістю ∝ |I|/I_max. */
export function currentColor(frac: number, alpha = 1): string {
  const f = Math.max(0, Math.min(1, frac));
  const a = (0.12 + 0.88 * f) * alpha;
  return `rgba(94, 234, 212, ${a.toFixed(3)})`;
}

/** Колір «тепла» для карт густини струму (чорний → червоний → жовтий → білий). */
export function heatColor(f: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, f));
  const r = Math.min(1, x * 2.2);
  const g = Math.max(0, Math.min(1, x * 2.2 - 0.8));
  const b = Math.max(0, x * 3 - 2.2);
  return [r * 255, g * 255, b * 255];
}

/** Індикатор-шкала (гальванометр): стрілка відхиляється пропорційно value/max. */
export function galvanometer(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, frac: number, label: string,
): void {
  ctx.fillStyle = '#151a22';
  ctx.strokeStyle = '#3a4456';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = -5; i <= 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * 1.2;
    const r0 = i === 0 ? r * 0.72 : r * 0.82;
    ctx.beginPath();
    ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
    ctx.lineTo(cx + r * 0.95 * Math.cos(a), cy + r * 0.95 * Math.sin(a));
    ctx.stroke();
  }
  const f = Math.max(-1, Math.min(1, frac));
  const a = -Math.PI / 2 + f * 1.2;
  ctx.strokeStyle = COL.force;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + r * 0.9 * Math.cos(a), cy + r * 0.9 * Math.sin(a));
  ctx.stroke();
  text(ctx, '−', cx - r * 0.75, cy - 4, COL.muted, 'center', 13);
  text(ctx, '+', cx + r * 0.75, cy - 4, COL.muted, 'center', 13);
  text(ctx, label, cx, cy + 15, COL.muted, 'center', 11);
}

/** Автоматичний масштаб: повільно наздоганяє максимум |x| (для яскравості/стрілок). */
export class AutoScale {
  private m = 0;
  constructor(private decay = 0.995) {}
  update(x: number): number {
    const a = Math.abs(x);
    this.m = Math.max(a, this.m * this.decay);
    return this.m || 1;
  }
  get value(): number {
    return this.m || 1;
  }
  reset(): void {
    this.m = 0;
  }
}
