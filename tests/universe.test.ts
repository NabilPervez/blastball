import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { computeStandings } from '../src/engine/season';
import { BlastballDB, deleteUniverse, listUniverses, loadUniverse, persistCommand, saveUniverse } from '../src/storage/db';
import { migrateSave, NewerSaveError, InvalidSaveError } from '../src/storage/migrate';
import { snapshotsToPrune, gamesToPrune } from '../src/storage/retention';
import { createUniverse, reduceAll, regularResults, runCommand, type UniverseSettings } from '../src/world/universe';

const settings = (p: Partial<UniverseSettings> = {}): UniverseSettings => ({
  name: 'Test League', seed: 'test-seed', leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'manual', dayLengthMinutes: 60, ...p,
});

describe('universe', () => {
  it('a 20-game season simulates end to end and standings match results', () => {
    const u = createUniverse('u1', settings(), 0);
    const { state } = runCommand(u, { type: 'simToSeasonEnd' });
    expect(state.phase).toBe('offseason');
    expect(regularResults(state)).toHaveLength(80);
    const table = computeStandings(state.league.teams, regularResults(state));
    for (const row of table) expect(row.wins + row.losses).toBe(20);
    // Season stats agree with team runs.
    const teamRuns = Object.values(state.results).reduce((s, r) => s + r.awayScore + r.homeScore, 0);
    const playerRuns = Object.values(state.seasonStats).reduce((s, l) => s + l.r, 0);
    expect(playerRuns).toBe(teamRuns);
  });

  it('replaying the emitted events reproduces the same state', () => {
    const u = createUniverse('u1', settings(), 0);
    const { state, events } = runCommand(u, { type: 'simDays', count: 5 });
    expect(reduceAll(u, events)).toEqual(state);
  });

  it('nextGame plays one game at a time, then ends the day', () => {
    let u = createUniverse('u1', settings({ leagueSize: 4 }), 0);
    u = runCommand(u, { type: 'nextGame' }).state;
    u = runCommand(u, { type: 'nextGame' }).state;
    expect(Object.keys(u.results)).toHaveLength(2);
    expect(u.currentDay).toBe(1);
    u = runCommand(u, { type: 'nextGame' }).state;
    expect(u.currentDay).toBe(2);
  });

  it('different league sizes and season lengths work', () => {
    for (const leagueSize of [4, 12, 16] as const) {
      const { state } = runCommand(createUniverse('x', settings({ leagueSize, seasonLength: 20 }), 0), { type: 'simToSeasonEnd' });
      expect(regularResults(state)).toHaveLength((leagueSize / 2) * 20);
    }
  });
});

describe('retention', () => {
  it('keeps 7 newest daily snapshots and every season-end', () => {
    const snaps = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: i + 1, season: 1, day: i + 1, kind: 'daily' as const })),
      { id: 100, season: 1, day: 20, kind: 'seasonEnd' as const },
    ];
    expect(snapshotsToPrune(snaps).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('drops old play-by-play unless pinned', () => {
    const games = [
      { gameId: 'old', season: 1, day: 1, pinned: false },
      { gameId: 'pinned', season: 1, day: 1, pinned: true },
      { gameId: 'recent', season: 1, day: 9, pinned: false },
    ];
    expect(gamesToPrune(games, 1, 12, 7)).toEqual(['old']);
  });
});

describe('save migration', () => {
  it('rejects newer and invalid saves', () => {
    expect(() => migrateSave({ saveVersion: 999 })).toThrow(NewerSaveError);
    expect(() => migrateSave({ hello: 1 })).toThrow(InvalidSaveError);
    expect(() => migrateSave(null)).toThrow(InvalidSaveError);
  });
});

describe('persistence', () => {
  it('saves, reloads exactly, keeps universes isolated, and deletes cleanly', async () => {
    const d = new BlastballDB('test-' + Date.now());
    const a = createUniverse('a', settings({ seed: 'aaa' }), 0);
    const b = createUniverse('b', settings({ seed: 'bbb', name: 'Other' }), 0);
    await saveUniverse(a, d);
    await saveUniverse(b, d);

    const r = runCommand(a, { type: 'simDays', count: 5 });
    await persistCommand(a, r, d);

    expect(await loadUniverse('a', d)).toEqual(r.state);
    expect(await loadUniverse('b', d)).toEqual(b);
    expect((await listUniverses(d)).map((m) => m.id).sort()).toEqual(['a', 'b']);
    expect(await d.snapshots.where('universeId').equals('a').count()).toBe(1);
    expect(await d.games.where('universeId').equals('a').count()).toBe(20);

    await deleteUniverse('a', d);
    expect(await loadUniverse('a', d)).toBeNull();
    expect(await d.games.where('universeId').equals('a').count()).toBe(0);
    expect(await loadUniverse('b', d)).toEqual(b);
  });
});

describe('save fixtures', () => {
  it('a real v1 save (Sprint 2) loads through migrateSave', async () => {
    const raw = (await import('./fixtures/save-v1.json')).default;
    const u = migrateSave(structuredClone(raw));
    expect(u.id).toBe('fixture-v1');
    expect(u.currentDay).toBe(4);
    // Still playable after loading.
    expect(runCommand(u, { type: 'endDay' }).state.currentDay).toBe(5);
  });
});
