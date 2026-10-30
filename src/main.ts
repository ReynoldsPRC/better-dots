import { createGame, type GameState, type LevelDef } from './rules';
import { el } from './ui/dom';
import { hideCard, showCard } from './ui/overlay';
import { PlayScreen } from './ui/play';

// Step 2: one hardcoded board. Level files and level select come next.
const LEVEL: LevelDef = {
  id: 'core',
  seed: 2026,
  moves: 20,
  colors: [0, 1, 2, 3],
  layout: Array(6).fill('......'),
  goals: [
    { type: 'collect', color: 0, count: 20 },
    { type: 'collect', color: 3, count: 20 },
  ],
};

const SETTINGS_KEY = 'better-dots-settings';
const settings: { colorblind: boolean } = { colorblind: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

const play = new PlayScreen(
  document.getElementById('game') as HTMLCanvasElement,
  {
    top: document.getElementById('hud')!,
    goals: document.getElementById('goals')!,
    moves: document.getElementById('moves')!,
  },
  { onEnd, colorblind: () => settings.colorblind },
);

function newGame(): void {
  hideCard();
  play.start(createGame(LEVEL, { playSeed: Date.now() >>> 0 }));
}

function onEnd(state: GameState): void {
  if (state.status === 'won') {
    showCard('Cleared!', [el('p', {}, `in ${state.movesUsed} moves`)], [{ label: 'Play again', primary: true, onClick: newGame }]);
  } else {
    showCard('Out of moves', [], [
      { label: 'Retry', primary: true, onClick: newGame },
    ]);
  }
}

function openSettings(): void {
  const box = el('input', { type: 'checkbox', checked: settings.colorblind }) as HTMLInputElement;
  box.addEventListener('change', () => {
    settings.colorblind = box.checked;
    saveSettings();
    play.renderHud();
    play.redraw();
  });
  showCard('Settings', [el('label', { class: 'toggle' }, 'Colorblind symbols', box)], [
    { label: 'Done', primary: true, onClick: hideCard },
  ]);
}

document.getElementById('btn-settings')!.addEventListener('click', openSettings);
document.getElementById('btn-back')!.hidden = true;
window.addEventListener('resize', () => play.resize());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  play.renderHud();
  play.redraw();
});

newGame();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW registration failed', err));
}

// Dev builds expose the play screen for poking at from the console.
if (import.meta.env.DEV) Object.assign(window, { __play: play });
