// Small DOM helpers for the menus and HUD (the board itself is canvas).
import { config } from '../config';
import { drawSymbol } from '../render/board';
import type { Theme } from '../render/canvas';
import type { ColorId } from '../rules';

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string | boolean | ((e: Event) => void)>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') node.addEventListener(key.replace(/^on/, '').toLowerCase(), value);
    else if (key === 'class') node.className = String(value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

let darkQuery: MediaQueryList | null = null;

export function currentTheme(): Theme {
  darkQuery ??= window.matchMedia('(prefers-color-scheme: dark)');
  return darkQuery.matches ? 'dark' : 'light';
}

/** A small dot drawn the same way as on the board, for goals and labels. */
export function dotIcon(color: ColorId, colorblind: boolean, size = 22): HTMLCanvasElement {
  const theme = currentTheme();
  const dpr = window.devicePixelRatio || 1;
  const canvas = el('canvas', { class: 'dot-icon', width: String(size * dpr), height: String(size * dpr) });
  canvas.style.width = canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const r = size / 2;
  ctx.fillStyle = config.palette[theme][color];
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  if (colorblind) drawSymbol(ctx, r, r, r * config.colorblind.symbolScale, color, config.background[theme]);
  return canvas;
}
