import { candidates, catalog } from './levels';
import { awardPowerUps, isUnlocked, recordWin, spendPowerUp, type SaveData } from './progress';
import { createGame, starsFor, type GameState, type LevelDef } from './rules';
import { dotIcon, el } from './ui/dom';
import { hideCard, showCard } from './ui/overlay';
import { PlayScreen, type TargetPowerUp } from './ui/play';
import { renderSelect } from './ui/select';
import { exportSave, loadSave, pickSaveFile, storeSave } from './ui/storage';

const $ = (id: string) => document.getElementById(id)!;

/** Level labels ("4-3", "c4-2") to stable ids, for migrating old saves keyed on labels. */
const labelToId = new Map([...catalog.order, ...candidates.order].map((l) => [l.label, l.id]));
let save: SaveData = loadSave(labelToId);
// Catch up on power-ups earned before they existed (or under looser thresholds after a retune).
{
  const r = awardPowerUps(save, catalog.worlds);
  if (r.earned > 0) storeSave((save = r.save));
}
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
  {
    onEnd,
    colorblind: () => save.settings.colorblind,
    squareHint: () => save.settings.squareHint,
    // The developer switch also makes power-ups free, for testing.
    powerUsed: () => {
      if (!devUnlock()) persist(spendPowerUp(save));
      renderPowerButton();
    },
    targetChanged: () => renderPowerButton(),
  },
);

// --- power-ups -------------------------------------------------------------

function powerUpsOnHand(): number {
  return devUnlock() ? Infinity : save.powerUps;
}

function renderPowerButton(): void {
  const btn = $('btn-power');
  const n = powerUpsOnHand();
  const aiming = play.targeting;
  btn.hidden = n < 1 && !aiming;
  btn.classList.toggle('armed', aiming !== null);
  btn.textContent = aiming ? '✕' : `✦ ${n === Infinity ? '∞' : n}`;
  btn.setAttribute('aria-label', aiming ? `Cancel ${POWER_NAMES[aiming]}` : `Power-ups: ${n === Infinity ? 'unlimited' : n}`);
  $('level-label').textContent =
    aiming === 'eraser' ? 'Tap a dot, ice, slime, or fire to erase'
    : aiming === 'sureShot' ? 'Tap a cell to blast its row and column'
    : levelLabel();
}

function levelLabel(): string {
  if (!current) return '';
  return current.name ? `${current.label} · ${current.name}` : current.label;
}

const POWER_NAMES = { eraser: 'Eraser', sureShot: 'Sure Shot' } as const;

function openPowerUps(): void {
  if (play.targeting) return play.setTarget(null);
  if (powerUpsOnHand() < 1 || !play.ready()) return;
  const n = powerUpsOnHand();
  const cb = save.settings.colorblind;
  const aim = (kind: TargetPowerUp) => () => { hideCard(); play.setTarget(kind); };
  showCard('Power-ups', [
    el('p', {}, n === Infinity ? 'Unlimited (developer switch). Using one costs no move.' : `You have ${n}. Using one costs no move.`),
    el('h3', {}, 'Color Burst'),
    el('div', { class: 'swatches' },
      ...play.game.colors.map((color) =>
        el('button', {
          class: 'swatch', 'aria-label': `Color Burst: color ${color + 1}`,
          onClick: () => { hideCard(); play.usePowerUp({ kind: 'colorBurst', color }); },
        }, dotIcon(color, cb, 30)),
      ),
    ),
  ], [
    { label: 'Eraser: one dot or obstacle', primary: true, onClick: aim('eraser') },
    { label: 'Sure Shot: a row and column', onClick: aim('sureShot') },
    { label: 'Shuffler: mix up the dots', onClick: () => { hideCard(); play.usePowerUp({ kind: 'shuffler' }); } },
    { label: 'Cancel', onClick: hideCard },
  ]);
}

// --- screens ---------------------------------------------------------------

function showSelect(): void {
  hideCard();
  current = null;
  $('play').hidden = true;
  $('select').hidden = false;
  renderSelect(
    $('worlds'), catalog, { ...save, settings: { ...save.settings, devUnlock: devUnlock() } }, startLevel,
    devUnlock() ? candidates : undefined,
  );
}

function startLevel(id: string): void {
  const level = catalog.byId.get(id) ?? (devUnlock() ? candidates.byId.get(id) : undefined);
  if (!level || !(candidates.byId.has(id) || isUnlocked(save, order, id, devUnlock()))) return;
  hideCard();
  current = level;
  $('select').hidden = true;
  $('play').hidden = false;
  // Same opening board every time; refills differ per attempt.
  play.start(createGame(level, { playSeed: (Math.random() * 2 ** 32) >>> 0 }));
  renderPowerButton();
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
    const awarded = awardPowerUps(recordWin(save, level.id, state.movesUsed, state.assisted), catalog.worlds);
    persist(awarded.save);
    const next = nextLevelId(level.id);
    showCard('Cleared!', [
      state.assisted
        ? el('p', { class: 'note' }, 'Cleared with the assist. The next level is open; replay without it to earn stars.')
        : el('div', { class: 'result-stars', 'aria-label': `${stars} stars` }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
      el('p', {}, `${state.movesUsed} moves used`),
      ...(awarded.earned > 0 ? [el('p', { class: 'note' }, `You earned ${awarded.earned} power-up${awarded.earned > 1 ? 's' : ''}.`)] : []),
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
  showCard(level.label, [colorblindToggle()], [
    { label: 'Retry level', onClick: () => startLevel(level.id) },
    { label: 'Levels', onClick: showSelect },
    { label: 'Close', primary: true, onClick: hideCard },
  ]);
}

function openSettings(): void {
  showCard('Settings', [
    colorblindToggle(),
    toggle('Square hint', save.settings.squareHint, (v) => {
      persist({ ...save, settings: { ...save.settings, squareHint: v } });
    }),
    toggle('Unlock all levels (developer)', save.settings.devUnlock, (v) => {
      persist({ ...save, settings: { ...save.settings, devUnlock: v } });
    }),
  ], [
    { label: 'Export save', onClick: () => exportSave(save) },
    {
      label: 'Import save',
      onClick: () => {
        pickSaveFile(labelToId).then(
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
$('btn-power').addEventListener('click', openPowerUps);
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
