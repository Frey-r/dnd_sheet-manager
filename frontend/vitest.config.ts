import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Tests reuse the Vite config (aliases, React plugin). Pure-function suites (sprite sensors)
// opt out of the DOM with `// @vitest-environment node`.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
}));
