import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BlastballDB, deleteUniverse, loadUniverse, persistCommand, saveUniverse } from '../src/storage/db';
import { exportUniverse, importLeague, leagueFileName } from '../src/storage/exportImport';
import { InvalidSaveError } from '../src/storage/migrate';
import { createUniverse, runCommand } from '../src/world/universe';

let n = 0;
const setup = async () => {
  const d = new BlastballDB(`exp-${Date.now()}-${++n}`);
  const u = createUniverse('u1', { name: 'Round Trip', seed: 'rt', leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'manual' }, 0);
  await saveUniverse(u, d);
  const r = runCommand(u, { type: 'simDays', count: 4 });
  await persistCommand(u, r, d);
  return { d, state: r.state };
};

describe('.league export/import', () => {
  it('export → delete → import gives an identical universe', async () => {
    const { d, state } = await setup();
    const blob = await exportUniverse('u1', { includePlayByPlay: true }, d);
    const gamesBefore = await d.games.where('universeId').equals('u1').count();
    const eventsBefore = await d.worldEvents.where('universeId').equals('u1').count();
    await deleteUniverse('u1', d);

    const id = await importLeague(blob, d);
    expect(id).toBe('u1');
    expect(await loadUniverse('u1', d)).toEqual(state);
    expect(await d.games.where('universeId').equals('u1').count()).toBe(gamesBefore);
    expect(await d.worldEvents.where('universeId').equals('u1').count()).toBe(eventsBefore);
    expect(await d.snapshots.where('universeId').equals('u1').count()).toBe(1);
  });

  it('can strip play-by-play to save space', async () => {
    const { d } = await setup();
    const full = await exportUniverse('u1', { includePlayByPlay: true }, d);
    const slim = await exportUniverse('u1', { includePlayByPlay: false }, d);
    expect(slim.size).toBeLessThan(full.size);
  });

  it('importing over an existing universe makes a copy instead of overwriting', async () => {
    const { d, state } = await setup();
    const blob = await exportUniverse('u1', { includePlayByPlay: false }, d);
    const id = await importLeague(blob, d, () => 'copy-id');
    expect(id).toBe('copy-id');
    expect((await loadUniverse('copy-id', d))!.settings.name).toBe('Round Trip (copy)');
    expect(await loadUniverse('u1', d)).toEqual(state);
  });

  it('corrupt or newer files fail clearly and change nothing', async () => {
    const { d } = await setup();
    const before = await d.universes.count();
    await expect(importLeague(new Blob(['not gzip at all']), d)).rejects.toThrow(InvalidSaveError);

    const gz = async (obj: unknown) => new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
    await expect(importLeague(await gz({ format: 'blastball.league', formatVersion: 99 }), d)).rejects.toThrow(/newer version/);
    await expect(importLeague(await gz({ format: 'something-else' }), d)).rejects.toThrow(InvalidSaveError);
    expect(await d.universes.count()).toBe(before);
  });

  it('builds safe file names', () => {
    expect(leagueFileName('The Blastball League!')).toBe('the-blastball-league.league');
  });
});
