import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard: the rules and the bot must stay free of DOM, rendering, time, and Math.random.
const DIRS = [join(__dirname, '../src/rules'), join(__dirname, '../src/bot')];
const FORBIDDEN = /\b(document|window|navigator|localStorage|indexedDB|requestAnimationFrame|performance|Date\.now|Math\.random|CanvasRenderingContext2D)\b/;

describe('rules and bot purity', () => {
  for (const [dir, file] of DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.ts')).map((f) => [d, f]))) {
    it(`${file} has no DOM, clock, or unseeded randomness`, () => {
      const src = readFileSync(join(dir, file), 'utf8');
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(FORBIDDEN);
    });
  }
});
