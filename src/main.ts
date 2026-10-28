/** Точка входу: вкладки розділів, перемикач СГС/СІ, ліниве створення сторінок. */
import './style.css';
import { h } from './ui/dom';
import { units } from './ui/units-store';
import type { Page } from './ui/simpage';
import { SECTIONS } from './sections';

const tabsEl = document.getElementById('tabs')!;
const subEl = document.getElementById('subtabs')!;
const app = document.getElementById('app')!;
const unitEl = document.getElementById('unit-switch')!;

document.body.classList.add('sys-CGS');

// Перемикач систем одиниць
const bCgs = h('button', { class: 'active' }, 'СГС (Гаусс)');
const bSi = h('button', {}, 'СІ');
const setSys = (s: 'CGS' | 'SI') => {
  units.set(s);
  bCgs.classList.toggle('active', s === 'CGS');
  bSi.classList.toggle('active', s === 'SI');
};
bCgs.addEventListener('click', () => setSys('CGS'));
bSi.addEventListener('click', () => setSys('SI'));
unitEl.append(bCgs, bSi);

const pages = new Map<string, Page>();
let active: Page | null = null;

function show(secId: string, subId?: string): void {
  const sec = SECTIONS.find((s) => s.id === secId) ?? SECTIONS[0];
  const sub = sec.subs.find((s) => s.id === subId) ?? sec.subs[0];
  tabsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.id === sec.id));
  subEl.innerHTML = '';
  subEl.style.display = sec.subs.length > 1 ? '' : 'none';
  for (const s of sec.subs) {
    const b = h('button', { class: s.id === sub.id ? 'active' : '' }, s.title);
    b.addEventListener('click', () => (location.hash = `${sec.id}/${s.id}`));
    subEl.append(b);
  }
  const key = `${sec.id}/${sub.id}`;
  let page = pages.get(key);
  if (!page) {
    page = sub.make();
    pages.set(key, page);
  }
  active?.deactivate();
  app.innerHTML = '';
  app.append(page.el);
  page.activate();
  active = page;
}

for (const s of SECTIONS) {
  const b = h('button', { 'data-id': s.id }, s.title);
  b.addEventListener('click', () => (location.hash = `${s.id}/${s.subs[0].id}`));
  tabsEl.append(b);
}

const route = () => {
  const [a, b] = location.hash.replace('#', '').split('/');
  show(a, b);
};
window.addEventListener('hashchange', route);
route();
