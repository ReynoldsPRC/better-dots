import { drawEmpty, fitCanvas, type Theme } from './render/canvas';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function theme(): Theme {
  return darkQuery.matches ? 'dark' : 'light';
}

function redraw(): void {
  drawEmpty(fitCanvas(canvas), theme());
}

window.addEventListener('resize', redraw);
darkQuery.addEventListener('change', redraw);
redraw();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW registration failed', err));
}
