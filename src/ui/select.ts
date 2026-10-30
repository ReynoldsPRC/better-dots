// Level select: a plain grid of numbered levels, grouped by world.
import type { Catalog } from '../levels';
import { isUnlocked, type SaveData } from '../progress';
import { el } from './dom';

export function renderSelect(
  root: HTMLElement, catalog: Catalog, save: SaveData, onPick: (levelId: string) => void, candidates?: Catalog,
): void {
  const order = catalog.order.map((l) => l.id);
  const sections = [...catalog.worlds.map((w) => ({ w, cand: false })), ...(candidates?.worlds ?? []).map((w) => ({ w, cand: true }))];
  root.replaceChildren(
    ...sections.map(({ w, cand }) =>
      el('section', { class: 'world' },
        el('h2', {}, cand ? `Candidates · world ${w.number}` : `${w.number} · ${w.name}`),
        el('div', { class: 'level-grid' },
          ...w.levels.map((level, k) => {
            const rec = save.levels[level.id];
            const open = cand || isUnlocked(save, order, level.id);
            const stars = rec && !rec.assistedOnly ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) : '';
            return el('button', {
              class: `level${rec ? ' cleared' : ''}${rec?.assistedOnly ? ' assisted' : ''}`,
              disabled: !open,
              'aria-label': `Level ${level.id}${open ? '' : ', locked'}${rec?.assistedOnly ? ', cleared with assist' : ''}`,
              onClick: () => onPick(level.id),
            },
              el('span', { class: 'num' }, String(k + 1)),
              el('span', { class: 'stars' }, rec?.assistedOnly ? 'assist' : stars),
            );
          }),
        ),
      ),
    ),
  );
}
