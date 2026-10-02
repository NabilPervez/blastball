import { describe, expect, it } from 'vitest';
import { FACTION_BUDGET } from '../src/world/factions';
import { factionSplit, marginalCost, tally, votesCost, winnerOf } from '../src/world/elections';
import {
  createUniverse,
  currentElection,
  reduce,
  runCommand,
  voteError,
  type UniverseSettings,
  type UniverseState,
} from '../src/world/universe';

const settings = (seed: string): UniverseSettings => ({ name: 'Vote', seed, leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'manual', dayLengthMinutes: 60 });
const fresh = (seed = 'vote-seed') => createUniverse('v', settings(seed), 0);

describe('vote pricing', () => {
  it('is quadratic: n votes cost n² coins', () => {
    expect([1, 2, 3, 10].map((n) => votesCost(n, false))).toEqual([1, 4, 9, 100]);
    expect(marginalCost(3, 2, false)).toBe(25 - 9);
  });

  it('Organizer pays 20% less', () => {
    expect(votesCost(10, true)).toBe(80);
    expect(votesCost(10, true)).toBeLessThan(votesCost(10, false));
  });

  it('outvoting all factions combined is far beyond any realistic bankroll', () => {
    const allFactions = 6 * FACTION_BUDGET;
    expect(votesCost(allFactions, false)).toBeGreaterThan(100_000);
  });
});

describe('elections', () => {
  it('the first election opens on day 1 and closes at the end of day 7', () => {
    const e = currentElection(fresh())!;
    expect(e.openedDay).toBe(1);
    expect(e.closesDay).toBe(7);
    expect(e.proposals).toHaveLength(3);
    expect(e.proposals[0].effect.kind).toBe('statusQuo');
    for (const votes of Object.values(e.factionVotes)) expect(votes.reduce((a, b) => a + b, 0)).toBe(FACTION_BUDGET);
  });

  it('same seed ⇒ same proposals and faction leanings', () => {
    expect(currentElection(fresh('x'))).toEqual(currentElection(fresh('x')));
  });

  it('resolves at week end, applies the winner, and opens the next election', () => {
    const u = runCommand(fresh(), { type: 'simDays', count: 7 }).state;
    const [first, second] = u.elections;
    expect(first.result).not.toBeNull();
    expect(first.result!.winner).toBe(winnerOf(tally(first)));
    expect(second.openedDay).toBe(8);
    expect(second.closesDay).toBe(14);
    expect(u.news.some((n) => n.text.startsWith('Election #1:'))).toBe(true);
  });

  it('the final election closes on the last day of the season, and no more open after', () => {
    const u = runCommand(fresh(), { type: 'simToSeasonEnd' }).state;
    expect(u.elections.map((e) => [e.openedDay, e.closesDay])).toEqual([
      [1, 7],
      [8, 14],
      [15, 20],
    ]);
    expect(u.elections.every((e) => e.result)).toBe(true);
    expect(currentElection(u)).toBeNull();
  });

  it('buying votes spends coins and is rejected when unaffordable', () => {
    let u = fresh();
    const e = currentElection(u)!;
    u = reduce(u, { type: 'votesBought', electionId: e.id, proposal: 1, count: 5 });
    expect(u.coins).toBe(100 - 25);
    u = reduce(u, { type: 'votesBought', electionId: e.id, proposal: 2, count: 2 });
    expect(u.coins).toBe(100 - 49); // 7 votes total = 49 coins
    expect(voteError(u, e.id, 1, 10)).toMatch(/Not enough/);
    expect(reduce(u, { type: 'votesBought', electionId: e.id, proposal: 1, count: 10 })).toBe(u);
    expect(voteError(u, 999, 1, 1)).toMatch(/closed/);
  });

  it('a player who saved up can swing a close election', () => {
    // Find a seed whose first election is close.
    let found: { u: UniverseState; runnerUp: number; margin: number } | null = null;
    for (let i = 0; i < 200 && !found; i++) {
      const u = fresh(`close-${i}`);
      const totals = tally(currentElection(u)!);
      const sorted = [...totals].map((t, idx) => [t, idx]).sort((a, b) => b[0] - a[0]);
      const margin = sorted[0][0] - sorted[1][0];
      if (margin > 0 && margin <= 12) found = { u, runnerUp: sorted[1][1], margin };
    }
    expect(found).not.toBeNull();
    const { u, runnerUp, margin } = found!;
    const e = currentElection(u)!;
    const rich = { ...u, coins: 400 };
    const voted = reduce(rich, { type: 'votesBought', electionId: e.id, proposal: runnerUp, count: margin + 1 });
    expect(voted.coins).toBe(400 - (margin + 1) ** 2);
    const after = runCommand(voted, { type: 'simDays', count: 7 }).state;
    expect(after.elections[0].result!.winner).toBe(runnerUp);
    expect(after.news.some((n) => n.text.includes('swung the election'))).toBe(true);
  });

  it('factions decide from public info only: hidden ratings do not change their votes', () => {
    const u = fresh();
    const e = currentElection(u)!;
    const standings = u.league.teams.map((t) => ({ teamId: t.id, wins: 0, losses: 0 }));
    const views = e.proposals.map((proposal) => ({ standings, proposal }));
    const before = u.factions.map((f) => factionSplit(f, views, ['s']));
    // Scramble every hidden rating; FactionView has no access to them, so nothing changes.
    for (const p of Object.values(u.league.players)) for (const k of Object.keys(p.ratings) as (keyof typeof p.ratings)[]) p.ratings[k] = 100 - p.ratings[k];
    expect(u.factions.map((f) => factionSplit(f, views, ['s']))).toEqual(before);
  });

  it('election effects actually change the league', () => {
    // Find a universe whose first election is won by something other than the status quo.
    for (let i = 0; i < 50; i++) {
      const u0 = fresh(`fx-${i}`);
      const winner = winnerOf(tally(currentElection(u0)!));
      if (winner === 0) continue;
      const u = runCommand(u0, { type: 'simDays', count: 7 }).state;
      expect(u.league).not.toEqual(u0.league);
      return;
    }
    throw new Error('no non-status-quo winner found');
  });
});

describe('save fixtures', () => {
  it('a real v3 save (Sprint 5) migrates and keeps voting', async () => {
    const { migrateSave } = await import('../src/storage/migrate');
    const raw = (await import('./fixtures/save-v3.json')).default;
    const u = migrateSave(structuredClone(raw));
    expect(u.elections).toEqual(raw.elections);
    expect(u.coins).toBe(raw.coins);
    expect(Object.keys(u.weird.stadiums)).toHaveLength(4);
    expect(u.elections[0].result).not.toBeNull();
    const e = currentElection(u)!;
    expect(reduce(u, { type: 'votesBought', electionId: e.id, proposal: 0, count: 1 }).coins).toBe(u.coins - 1);
  });
});
