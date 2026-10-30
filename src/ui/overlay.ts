// A modal card over the board: end-of-level results, settings.
import { el } from './dom';

const root = () => document.getElementById('overlay')!;

export interface CardButton {
  label: string;
  primary?: boolean;
  onClick(): void;
}

export function showCard(title: string, body: (Node | string)[], buttons: CardButton[]): void {
  const o = root();
  o.replaceChildren(
    el('div', { class: 'card', role: 'dialog', 'aria-modal': 'true' },
      el('h2', {}, title),
      ...body,
      el('div', { class: 'buttons' },
        ...buttons.map((b) => el('button', { class: `btn${b.primary ? ' primary' : ''}`, onClick: () => b.onClick() }, b.label)),
      ),
    ),
  );
  o.hidden = false;
}

export function hideCard(): void {
  root().hidden = true;
  root().replaceChildren();
}
