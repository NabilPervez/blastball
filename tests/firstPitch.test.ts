import { describe, expect, it } from 'vitest';
import { firstPitchMs, PLAY_MS, playsSince } from '../src/world/clock';
import { createUniverse, reduce, type UniverseSettings } from '../src/world/universe';

describe('first pitch', () => {
  const clock = { anchorMs: 1_000_000, anchorDay: 3 };
  it('is the set share of the way into the current day', () => {
    expect(firstPitchMs(clock, 60, 3, 25)).toBe(1_000_000 + 15 * 60_000);
    expect(firstPitchMs(clock, 60, 4, 0)).toBe(1_000_000 + 60 * 60_000);
  });
  it('late arrivals pick up where the games would be', () => {
    expect(playsSince(5000, 4000)).toBe(1);
    expect(playsSince(5000, 5000 + 10 * PLAY_MS)).toBe(11);
  });
  it('is a saved setting', () => {
    const u = createUniverse('f', { name: 'F', seed: 'f', leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'living', dayLengthMinutes: 60 } as UniverseSettings, 0);
    expect(reduce(u, { type: 'firstPitchSet', pct: 50 }).settings.firstPitchPct).toBe(50);
  });
});
