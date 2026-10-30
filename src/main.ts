import { catalog } from './levels';
import { isUnlocked, recordWin, type SaveData } from './progress';
import { createGame, starsFor, type GameState, type LevelDef } from './rules';
import { el } from './ui/dom';
import { hideCard, showCard } from './ui/overlay';
import { PlayScreen } from './ui/play';
import { renderSelect } from './ui/select';
import { exportSave, loadSave, pickSaveFile, storeSave } from './ui/storage';

const $ = (id: string) => document.getElementById(id)!;

let save: SaveData = loadSave();
/** Developer switch from the URL: ?dev or ?dev=1 unlocks every level. */
const devFromUrl = /[?&]dev(=1|=true)?(&|$)/.test(location.search);
const devUnlock = () => devFromUrl || save.settings.devUnlock;
const order = catalog.order.map((l) => l.id);
let current: LevelDef | null = null;

function persist(next: SaveData): void {
  save = next;
  storeSave(save);
}

const play = new PlayScreen(
  $('game') as HTMLCanvasElement,
  { top: $('hud'), goals: $('goals'), moves: $('moves') },
  { onEnd, colorblind: () => save.settings.colorblind },
);

// --- screens ---------------------------------------------------------------

function showSelect(): void {
  hideCard();
  current = null;
  $('play').hidden = true;
  $('select').hidden = false;
  renderSelect($('worlds'), catalog, { ...save, settings: { ...save.settings, devUnlock: devUnlock() } }, startLevel);
}

function startLevel(id: string): void {
  const level = catalog.byId.get(id);
  if (!level || !isUnlocked(save, order, id, devUnlock())) return;
  hideCard();
  current = level;
  $('select').hidden = true;
  $('play').hidden = false;
  $('level-label').textContent = level.name ? `${level.id} · ${level.name}` : level.id;
  // Same opening board every time; refills differ per attempt.
  play.start(createGame(level, { playSeed: (Math.random() * 2 ** 32) >>> 0 }));
}

function nextLevelId(id: string): string | null {
  const k = order.indexOf(id);
  return k >= 0 && k + 1 < order.length ? order[k + 1] : null;
}

// --- end of a level --------------------------------------------------------

function onEnd(state: GameState): void {
  const level = current;
  if (!level) return;
  if (state.status === 'won') {
    const stars = starsFor(level, state.movesUsed, state.assisted);
    persist(recordWin(save, level.id, state.movesUsed, stars, state.assisted));
    const next = nextLevelId(level.id);
    showCard('Cleared!', [
      state.assisted
        ? el('p', { class: 'note' }, 'Cleared with the assist. The next level is open; replay without it to earn stars.')
        : el('div', { class: 'result-stars', 'aria-label': `${stars} stars` }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
      el('p', {}, `${state.movesUsed} moves used`),
    ], [
      ...(next ? [{ label: 'Next level', primary: true, onClick: () => startLevel(next) }] : []),
      { label: 'Replay', primary: !next, onClick: () => startLevel(level.id) },
      { label: 'Levels', onClick: showSelect },
    ]);
  } else {
    showCard('Out of moves', [el('p', {}, 'No penalty either way.')], [
      { label: '5 more moves', primary: true, onClick: () => { hideCard(); play.assist(); } },
      { label: 'Retry', onClick: () => startLevel(level.id) },
      { label: 'Levels', onClick: showSelect },
    ]);
  }
}

// --- menus -----------------------------------------------------------------

function toggle(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const box = el('input', { type: 'checkbox', checked: value }) as HTMLInputElement;
  box.addEventListener('change', () => onChange(box.checked));
  return el('label', { class: 'toggle' }, label, box);
}

function colorblindToggle(): HTMLElement {
  return toggle('Colorblind symbols', save.settings.colorblind, (v) => {
    persist({ ...save, settings: { ...save.settings, colorblind: v } });
    play.renderHud();
    play.redraw();
  });
}

function openPlayMenu(): void {
  const level = current!;
  showCard(level.id, [colorblindToggle()], [
    { label: 'Retry level', onClick: () => startLevel(level.id) },
    { label: 'Levels', onClick: showSelect },
    { label: 'Close', primary: true, onClick: hideCard },
  ]);
}

function openSettings(): void {
  showCard('Settings', [
    colorblindToggle(),
    toggle('Unlock all levels (developer)', save.settings.devUnlock, (v) => {
      persist({ ...save, settings: { ...save.settings, devUnlock: v } });
    }),
  ], [
    { label: 'Export save', onClick: () => exportSave(save) },
    {
      label: 'Import save',
      onClick: () => {
        pickSaveFile().then(
          (loaded) => {
            if (!loaded) return;
            if (confirm('Replace your current progress with this save?')) persist(loaded);
            showSelect();
          },
          (err) => alert(`That file couldn't be read: ${err instanceof Error ? err.message : err}`),
        );
      },
    },
    { label: 'Done', primary: true, onClick: showSelect },
  ]);
}

$('btn-back').addEventListener('click', showSelect);
$('btn-menu').addEventListener('click', openPlayMenu);
$('btn-options').addEventListener('click', openSettings);
window.addEventListener('resize', () => play.resize());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!current) return showSelect();
  play.renderHud();
  play.redraw();
});

showSelect();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW registration failed', err));
}

// Dev builds expose the play screen for poking at from the console.
if (import.meta.env.DEV) Object.assign(window, { __play: play, __save: () => save });
