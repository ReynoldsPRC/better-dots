import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Stamps the service worker's cache VERSION with the short git SHA (or a
 * timestamp outside git), so every deploy gets a fresh cache and the old
 * one is evicted on the next load.
 */
function stampServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      let version: string;
      try {
        version = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      } catch {
        version = `t${Date.now().toString(36)}`;
      }
      const file = join(outDir, 'sw.js');
      const src = readFileSync(file, 'utf8');
      const stamped = src.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
      if (stamped === src) throw new Error('stamp-service-worker: no VERSION line in sw.js');
      writeFileSync(file, stamped);
    },
  };
}

export default defineConfig({
  // Relative base so the build works at any path (e.g. GitHub Pages /better-dots/).
  base: './',
  build: { target: 'es2022' },
  plugins: [stampServiceWorker()],
  test: { include: ['tests/**/*.test.ts'] },
});
