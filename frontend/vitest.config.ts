import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Tests reuse the Vite config (aliases, React plugin). Pure-function suites (sprite sensors)
// opt out of the DOM with `// @vitest-environment node`.
//
// The sprite suites carry absolute time budgets (C13, RG-1, O7…). They run in their own project,
// one file at a time and with two retries, so a CPU spike from other processes (agents, builds)
// does not fail them, while a real slowdown still fails all three attempts (E-0023, D-0056).
const SPRITE_SUITES = 'src/lib/avatar/__tests__/**/*.test.ts';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: { name: 'sprite', include: [SPRITE_SUITES], fileParallelism: false, retry: 2 },
      },
      {
        extends: true,
        test: { name: 'app', include: ['src/**/*.test.{ts,tsx}'], exclude: [SPRITE_SUITES] },
      },
    ],
  },
}));
