import { describe, expect, it } from 'vitest';
import { createUniverse, runCommand, standingsOf, type UniverseSettings } from '../src/world/universe';

const settings = { name: 'R', seed: 'relegate', leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'manual', dayLengthMinutes: 60 } as UniverseSettings;

describe('relegation', () => {
  it('the last-place team is replaced by a brand-new team and roster', () => {
    let u = createUniverse('r', settings, 0);
    u = runCommand(u, { type: 'simToSeasonEnd' }).state;
    const loser = standingsOf(u).at(-1)!.teamId;
    const old = u.league.teams.find((t) => t.id === loser)!;
    const oldRoster = [...old.lineup, ...old.rotation];

    const next = runCommand(u, { type: 'endDay' }).state;
    expect(next.season).toBe(2);
    const fresh = next.league.teams.find((t) => t.id === loser)!;
    expect(`${fresh.city} ${fresh.name}`).not.toBe(`${old.city} ${old.name}`);
    expect(next.league.teams.filter((t) => t.city === fresh.city)).toHaveLength(1);
    const roster = [...fresh.lineup, ...fresh.rotation];
    expect(roster).toHaveLength(13);
    for (const id of roster) {
      expect(oldRoster).not.toContain(id);
      expect(next.ages[id]).toBeGreaterThan(0);
    }
    for (const id of oldRoster) expect(next.weird.playerStatus[id]).toBe('retired');
    expect(next.timeline.some((t) => t.kind === 'relegation')).toBe(true);
    // Last season's history still shows the old name.
    expect(next.archive.at(-1)!.teamNames![loser]).toBe(old.name);
    // The new team plays.
    const after = runCommand(next, { type: 'endDay' }).state;
    expect(Object.values(after.results).some((r) => r.awayId === loser || r.homeId === loser)).toBe(true);
  });
});
