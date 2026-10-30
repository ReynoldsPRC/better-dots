import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard: the rules module must stay free of DOM, rendering, time, and Math.random.
const RULES_DIR = join(__dirname, '../src/rules');
const FORBIDDEN = /\b(document|window|navigator|localStorage|indexedDB|requestAnimationFrame|performance|Date\.now|Math\.random|CanvasRenderingContext2D)\b/;

describe('rules module purity', () => {
  for (const file of readdirSync(RULES_DIR).filter((f) => f.endsWith('.ts'))) {
    it(`${file} has no DOM, clock, or unseeded randomness`, () => {
      const src = readFileSync(join(RULES_DIR, file), 'utf8');
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(FORBIDDEN);
    });
  }
});
