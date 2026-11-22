/* Shared Vitest setup (D-0004). DOM-only pieces are guarded: pure suites run with
   `// @vitest-environment node` and must not touch jsdom globals. */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

if (typeof window !== 'undefined') {
  // Without Vitest globals, Testing Library cannot register its own cleanup.
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());

  // jsdom has no canvas backend; PixelAvatar skips drawing when the 2D context is null.
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return null;
  } as HTMLCanvasElement['getContext'];
}
