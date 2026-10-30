import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works at any path (e.g. GitHub Pages /better-dots/).
  base: './',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
