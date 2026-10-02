import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BlastballDB, persistCommand, saveUniverse } from '../src/storage/db';
import { exportUniverse } from '../src/storage/exportImport';
import { daysDue, MAX_CATCHUP_DAYS, msUntilNextDay, planCatchUp } from '../src/world/clock';
import { buildDigest } from '../src/world/digest';
import { createUniverse, reduce, runCommand, type UniverseSettings } from '../src/world/universe';

const HOUR = 3_600_000;
const settings = (p: Partial<UniverseSettings> = {}): UniverseSettings => ({
  name: 'Time', seed: 'time-seed', leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'living', dayLengthMinutes: 60, ...p,
});

describe('living clock (mocked time)', () => {
  const clock = { anchorMs: 1_000_000, anchorDay: 1 };

  it('advances one day per day-length of real time', () => {
    expect(daysDue(clock, 60, 1, clock.anchorMs + 59 * 60_000)).toBe(0);
    expect(daysDue(clock, 60, 1, clock.anchorMs + HOUR)).toBe(1);
    expect(daysDue(clock, 60, 1, clock.anchorMs + 5.5 * HOUR)).toBe(5);
    expect(daysDue(clock, 15, 1, clock.anchorMs + HOUR)).toBe(4);
    expect(daysDue(clock, 1440, 1, clock.anchorMs + 49 * HOUR)).toBe(2);
    // Already caught up.
    expect(daysDue(clock, 60, 6, clock.anchorMs + 5.5 * HOUR)).toBe(0);
  });

  it('caps catch-up at 7 days and restarts the clock when capped', () => {
    const now = clock.anchorMs + 30 * HOUR;
    const plan = planCatchUp(clock, 60, 1, 20, now);
    expect(plan.simulate).toBe(MAX_CATCHUP_DAYS);
    expect(plan.skipped).toBe(30 - MAX_CATCHUP_DAYS);
    expect(plan.nextClock(8)).toEqual({ anchorMs: now, anchorDay: 8 });
  });

  it('keeps partial progress toward the next day when not capped', () => {
    const now = clock.anchorMs + 3.5 * HOUR;
    const plan = planCatchUp(clock, 60, 1, 20, now);
    expect(plan.simulate).toBe(3);
    const next = plan.nextClock(4);
    expect(daysDue(next, 60, 4, now)).toBe(0);
    expect(msUntilNextDay(next, 60, 4, now)).toBe(HOUR / 2);
  });

  it('never simulates past the end of the season', () => {
    expect(planCatchUp(clock, 60, 18, 3, clock.anchorMs + 100 * HOUR).simulate).toBe(3);
  });

  it('switching to Living or changing day length re-anchors at "now"', () => {
    let u = createUniverse('t', settings({ timeMode: 'manual' }), 0);
    expect(u.clock).toBeNull();
    u = reduce(u, { type: 'timeSettingsChanged', timeMode: 'living', dayLengthMinutes: 15, nowMs: 5000 });
    expect(u.clock).toEqual({ anchorMs: 5000, anchorDay: 1 });
    expect(u.settings.dayLengthMinutes).toBe(15);
    u = reduce(u, { type: 'timeSettingsChanged', timeMode: 'manual', dayLengthMinutes: 15, nowMs: 9000 });
    expect(u.clock).toBeNull();
  });

  it('a 7-day catch-up is fast (16 teams)', () => {
    const u = createUniverse('t', settings({ leagueSize: 16, seasonLength: 50 }), 0);
    const t = performance.now();
    runCommand(u, { type: 'simDays', count: 7 });
    expect(performance.now() - t).toBeLessThan(3000);
  });
});

describe('While You Were Gone digest', () => {
  it('ranks deaths, returns and elections above everything else', () => {
    for (let i = 0; i < 40; i++) {
      const u = createUniverse('t', settings({ seed: `dg-${i}`, chaos: 'unhinged' }), 0, { kind: 'diehard', fanName: 'Fan', favoriteTeamId: 't1' });
      const r = runCommand(u, { type: 'simDays', count: 7 });
      const d = buildDigest(u, r.state, r.events);
      if (!d.items.some((x) => x.kind === 'death')) continue;
      expect(d.items[0].kind).toBe('death');
      const rank = (k: string) => d.items.findIndex((x) => x.kind === k);
      expect(rank('election')).toBeLessThan(rank('team'));
      expect(rank('team')).toBeLessThan(rank('coins'));
      for (let k = 1; k < d.items.length; k++) expect(d.items[k - 1].importance).toBeGreaterThanOrEqual(d.items[k].importance);
      expect(d.games).toBe(28);
      return;
    }
    throw new Error('no season with a death found');
  });

  it('mentions the pause when days were skipped', () => {
    const u = createUniverse('t', settings(), 0);
    const r = runCommand(u, { type: 'simDays', count: 7 });
    expect(buildDigest(u, r.state, r.events, 12).items.some((x) => x.kind === 'paused')).toBe(true);
  });
});

describe('timeline', () => {
  it('records elections and the champion permanently', () => {
    const u = runCommand(createUniverse('t', settings({ timeMode: 'manual' }), 0), { type: 'simToSeasonEnd' }).state;
    expect(u.timeline.filter((t) => t.kind === 'election')).toHaveLength(3);
    expect(u.timeline.at(-1)!.kind).toBe('champion');
  });

  it('backup reminders are tracked per day', () => {
    const u = reduce(createUniverse('t', settings(), 0), { type: 'backupNoted', day: 9 });
    expect(u.lastBackupDay).toBe(9);
  });
});

describe('save size', () => {
  it('a full 99-game, 16-team season exports well under 5 MB', async () => {
    const d = new BlastballDB(`size-${Date.now()}`);
    let u = createUniverse('big', settings({ leagueSize: 16, seasonLength: 99, timeMode: 'manual' }), 0);
    await saveUniverse(u, d);
    // Day by day, as a real player would, so compaction runs along the way.
    for (let i = 0; i < 99; i++) {
      const r = runCommand(u, { type: 'endDay' });
      await persistCommand(u, r, d);
      u = r.state;
    }
    const withPbp = await exportUniverse('big', { includePlayByPlay: true }, d);
    expect(withPbp.size).toBeLessThan(5 * 1024 * 1024);
    // Only the last 7 days of play-by-play are kept.
    expect(await d.games.where('universeId').equals('big').count()).toBeLessThanOrEqual(8 * 8);
  }, 60_000);
});

describe('save fixtures', () => {
  it('a real v5 save (Sprint 7) migrates and keeps its clock', async () => {
    const { migrateSave } = await import('../src/storage/migrate');
    const raw = (await import('./fixtures/save-v5.json')).default;
    const u = migrateSave(structuredClone(raw));
    expect(u.timeline).toEqual(raw.timeline);
    expect(u.dayCount).toBe(raw.currentDay);
    expect(u.phase).toBe('regular');
    expect(u.clock).toEqual({ anchorMs: 1790000000000, anchorDay: 1 });
    expect(planCatchUp(u.clock!, u.settings.dayLengthMinutes, u.currentDay, 20, 1790000000000 + 12 * 30 * 60_000).simulate).toBe(3);
  });
});
