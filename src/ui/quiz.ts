/** Блок «Перевір себе»: питання з варіантами та поясненням правильної відповіді. */
import { h } from './dom';
import { renderMath } from './tex';

export interface QuizQ {
  q: string;
  options: string[];
  correct: number;
  explain: string;
}

export function quiz(parent: HTMLElement, qs: QuizQ[]): void {
  const box = h('div', { class: 'card quiz' }, h('h3', {}, 'Перевір себе'));
  qs.forEach((item, qi) => {
    const opts = h('div', { class: 'opts' });
    const explain = h('div', { class: 'explain', style: { display: 'none' }, html: item.explain });
    const buttons = item.options.map((text, i) => {
      const b = h('button', { html: `${String.fromCharCode(1072 + i)}) ${text}` }) as HTMLButtonElement;
      b.addEventListener('click', () => {
        buttons.forEach((bb, j) => {
          bb.classList.toggle('right', j === item.correct);
          bb.classList.toggle('wrong', j === i && i !== item.correct);
        });
        explain.style.display = '';
      });
      opts.append(b);
      return b;
    });
    box.append(h('div', { class: 'q' }, h('p', { html: `${qi + 1}. ${item.q}` }), opts, explain));
  });
  parent.append(box);
  renderMath(box);
}
