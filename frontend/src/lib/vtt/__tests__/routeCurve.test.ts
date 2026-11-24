// @vitest-environment node
/* T-29 · K1 — Bézier route legs walk like the server's (internal/service/testdata/route_curve_cases.json). */
import { describe, expect, it } from 'vitest';
import cases from '../../../../../internal/service/testdata/route_curve_cases.json';
import { routeCycleSeconds, routePosition, type Route } from '../routePosition';

interface Case { name: string; mode: Route['mode']; rate: number; elapsed_frac: number; points: Route['points']; want: { x: number; y: number } }

describe('routePosition on curves (shared table with Go)', () => {
  const table = (cases as { cases: Case[] }).cases;
  it('has the full table', () => expect(table.length).toBeGreaterThanOrEqual(10));
  it.each(table.map((c) => [c.name, c] as const))('%s', (_n, c) => {
    const route: Route = { mode: c.mode, points: c.points };
    const cycle = routeCycleSeconds(route, c.rate);
    expect(cycle).toBeGreaterThan(0);
    const got = routePosition(route, c.rate, c.elapsed_frac * cycle * 1000);
    expect(got.x).toBeCloseTo(c.want.x, 6);
    expect(got.y).toBeCloseTo(c.want.y, 6);
  });
  it('an arch takes longer than its chord', () => {
    const arch: Route = { mode: 'once', points: [{ x: 0, y: 0, out: { x: 0, y: 100 } }, { x: 100, y: 0, in: { x: 100, y: 100 } }] };
    const chord: Route = { mode: 'once', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
    expect(routeCycleSeconds(chord, 10)).toBeCloseTo(10, 9);
    expect(routeCycleSeconds(arch, 10)).toBeGreaterThan(13);
  });
});
