// @vitest-environment node
/* T-20 · contratos/T-20-ruta-frontend.md — F1/F2: the board computes routes exactly like the server. */
import { describe, expect, it } from 'vitest';
import cases from '../../../../../internal/service/testdata/route_cases.json';
import { liveElapsed, liveTokenPosition, routePosition, routeRate, type Route } from '../routePosition';

interface Case { name: string; mode: Route['mode']; rate: number; elapsed_ms: number; points: Route['points']; want: { x: number; y: number } }

describe('routePosition (shared table with Go)', () => {
  const table = (cases as { cases: Case[] }).cases;

  it('has the full table', () => {
    expect(table.length).toBeGreaterThanOrEqual(20);
  });

  it.each(table.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const got = routePosition({ mode: c.mode, points: c.points }, c.rate, c.elapsed_ms);
    expect(got.x).toBeCloseTo(c.want.x, 6);
    expect(got.y).toBeCloseTo(c.want.y, 6);
  });

  it('an empty route stays at the origin', () => {
    expect(routePosition({ mode: 'loop', points: [] }, 100, 1000)).toEqual({ x: 0, y: 0 });
  });
});

describe('routeRate', () => {
  it('matches the exploration rate: 30 ft at ×2 on 70 px / 5 ft cells is 140 px/s', () => {
    expect(routeRate(30, 70, 5, 2)).toBeCloseTo(140, 9);
  });
  it('speed 0 stands still; a missing pace means ×2', () => {
    expect(routeRate(0, 70, 5, 2)).toBe(0);
    expect(routeRate(30, 70, 5, 0)).toBeCloseTo(140, 9);
  });
});

describe('liveElapsed (F2)', () => {
  it('adds the local time since the clock arrived only while it runs', () => {
    expect(liveElapsed({ elapsed_ms: 1000, running: true }, 5000, 5750)).toBe(1750);
    expect(liveElapsed({ elapsed_ms: 1000, running: false }, 5000, 9000)).toBe(1000);
  });
  it('never goes back in time', () => {
    expect(liveElapsed({ elapsed_ms: 1000, running: true }, 5000, 4000)).toBe(1000);
  });
});

describe('liveTokenPosition', () => {
  const scene = { grid_size_px: 70, feet_per_cell: 5, exploration_pace: 2 };
  const route: Route = { mode: 'once', points: [{ x: 0, y: 0 }, { x: 1400, y: 0 }] };

  it('walks a running route from the received clock', () => {
    const t = { x: 0, y: 0, speed_ft: 30, route, route_clock: { elapsed_ms: 1000, running: true, received_at: 100 } };
    expect(liveTokenPosition(t, scene, 600)).toEqual({ x: 210, y: 0 });
  });
  it('keeps a frozen route where its clock says', () => {
    const t = { x: 5, y: 5, speed_ft: 30, route, route_clock: { elapsed_ms: 500, running: false } };
    expect(liveTokenPosition(t, scene, 99999)).toEqual({ x: 70, y: 0 });
  });
  it('tokens without route (or without clock) stay at x, y', () => {
    expect(liveTokenPosition({ x: 5, y: 6, speed_ft: 30 }, scene, 1)).toEqual({ x: 5, y: 6 });
    expect(liveTokenPosition({ x: 5, y: 6, speed_ft: 30, route, route_clock: null }, scene, 1)).toEqual({ x: 5, y: 6 });
  });
});
