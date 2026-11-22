/* Module doubles shared by page tests. Use inside a `vi.mock` factory:
   vi.mock(import('../../services/api'), async (orig) => (await import('../../test/mocks')).mockApiModule(await orig())); */
import { vi } from 'vitest';
import type * as ApiModule from '../services/api';

type Api = typeof ApiModule;

const spies = <T extends object>(o: T) => Object.fromEntries(Object.keys(o).map((k) => [k, vi.fn()])) as unknown as T;

/** `services/api` with the HTTP client and every `characterApi` call replaced by spies: no network. */
export function mockApiModule(actual: Api): Api {
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as Api['api'],
    characterApi: spies(actual.characterApi),
  };
}
