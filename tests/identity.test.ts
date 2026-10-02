import { describe, expect, it } from 'vitest';
import { tierOf } from '../src/world/rarity';
import { isRivalry, recordWithWin, rivalsOf, teamBio, teamPerk, type HeadToHead } from '../src/world/teams';
import { createUniverse, massBetTargets, offeredMultiplier, reduce, runCommand, RULES, type UniverseSettings } from '../src/world/universe';
import { applyHappening, birthTraits, grantMod, rollDay } from '../src/world/weird';

const settings = (over: Partial<UniverseSettings> = {}): UniverseSettings =>
  ({ name: 'T', seed: 'identity', leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'manual', dayLengthMinutes: 60, ...over }) as UniverseSettings;

describe('trait combos', () => {
  it('two matching traits fuse into the combo', () => {
    const r = grantMod(RULES, 'p', [{ id: 'running-hot', until: null }], { id: 'insomniac', until: { season: 1, day: 5 } });
    expect(r.combo?.id).toBe('burnt-out');
    expect(r.changes).toEqual([
      { kind: 'removePlayerMods', playerId: 'p', ids: ['running-hot', 'insomniac'] },
      { kind: 'addPlayerMod', playerId: 'p', mod: { id: 'burnt-out', until: null } },
    ]);
    const u = createUniverse('c', settings(), 0);
    const { weird } = applyHappening(u.league, { ...u.weird, playerMods: { p: [{ id: 'running-hot', until: null }] } }, { eventId: 'x', teamId: 't1', text: '', changes: r.changes }, 1, 1);
    expect(weird.playerMods.p.map((m) => m.id)).toEqual(['burnt-out']);
  });

  it('a temporary combo lasts as long as the later ingredient', () => {
    const r = grantMod(RULES, 'p', [{ id: 'foggy', until: { season: 1, day: 9 } }], { id: 'glasses', until: { season: 1, day: 4 } });
    expect(r.changes[1]).toEqual({ kind: 'addPlayerMod', playerId: 'p', mod: { id: 'fog-lights', until: { season: 1, day: 9 } } });
  });

  it('unrelated traits just stack', () => {
    expect(grantMod(RULES, 'p', [{ id: 'foggy', until: null }], { id: 'blessed', until: null }).combo).toBeNull();
  });
});

describe('contagion', () => {
  it('contagious traits spread to teammates over time', () => {
    const u = createUniverse('c', settings({ chaos: 'unhinged' }), 0);
    const carrier = u.league.teams[0].lineup[0];
    const weird = { ...u.weird, playerMods: { [carrier]: [{ id: 'foggy', until: null }] } };
    let spread = 0;
    for (let day = 1; day <= 20; day++) {
      const hs = rollDay({ league: u.league, weird, seed: 'c', season: 1, day, seasonDays: 20, chaos: 'unhinged' }, RULES);
      spread += hs.filter((h) => h.eventId === 'contagion').length;
    }
    expect(spread).toBeGreaterThan(0);
  });
});

describe('born-with traits', () => {
  it('day 1 of a new league already has a spread of rarities', () => {
    const u = createUniverse('c', settings({ leagueSize: 16 }), 0);
    const tiers = new Set(Object.keys(u.league.players).map((id) => tierOf(u, id)));
    expect(tiers.has('common')).toBe(true);
    expect(tiers.has('uncommon')).toBe(true);
    expect(tiers.has('rare')).toBe(true);
    expect(birthTraits('c', 't1p1')).toEqual(birthTraits('c', 't1p1'));
  });

  it('offseason rookies are born with traits too', () => {
    let u = createUniverse('c', settings({ leagueSize: 16 }), 0);
    u = runCommand(runCommand(u, { type: 'simToSeasonEnd' }).state, { type: 'endDay' }).state;
    const rookies = Object.keys(u.league.players).filter((id) => /y2r/.test(id));
    expect(rookies.length).toBeGreaterThan(0);
    for (const id of rookies) expect(u.weird.playerMods[id] ?? []).toEqual(birthTraits('identity', id, RULES));
  }, 60_000);
});

describe('mass betting', () => {
  it('bets the same amount on every favorite today', () => {
    const u = { ...createUniverse('c', settings(), 0), coins: 500 };
    const targets = massBetTargets(u, 'favorite');
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      const g = u.schedule.find((x) => x.id === t.gameId)!;
      const other = t.teamId === g.homeId ? g.awayId : g.homeId;
      expect(offeredMultiplier(u, g.id, t.teamId)).toBeLessThan(offeredMultiplier(u, g.id, other));
    }
    const next = reduce(u, { type: 'massBet', side: 'favorite', amount: 20 });
    expect(next.bets.filter((b) => b.status === 'open')).toHaveLength(targets.length);
    expect(next.coins).toBe(500 - 20 * targets.length);
    const under = massBetTargets(u, 'underdog');
    expect(under.map((t) => t.gameId)).toEqual(targets.map((t) => t.gameId));
    expect(under.every((t, i) => t.teamId !== targets[i].teamId)).toBe(true);
  });

  it('stops when coins run out', () => {
    const u = { ...createUniverse('c', settings(), 0), coins: 30 };
    const next = reduce(u, { type: 'massBet', side: 'underdog', amount: 20 });
    expect(next.bets).toHaveLength(1);
    expect(next.coins).toBe(10);
  });
});

describe('team identity', () => {
  it('every team gets a different perk and a fixed bio', () => {
    const u = createUniverse('c', settings({ leagueSize: 12 }), 0);
    const perks = u.league.teams.map((t) => teamPerk('identity', u.league, t.id).id);
    expect(new Set(perks).size).toBe(perks.length);
    expect(teamBio('identity', u.league.teams[0])).toEqual(teamBio('identity', u.league.teams[0]));
  });

  it('close, frequent matchups become rivalries', () => {
    let h: HeadToHead = {};
    for (let i = 0; i < 4; i++) h = recordWithWin(recordWithWin(h, 'a', 'b'), 'b', 'a');
    expect(isRivalry(h, 'a', 'b')).toBe(true);
    let lopsided: HeadToHead = {};
    for (let i = 0; i < 8; i++) lopsided = recordWithWin(lopsided, 'a', 'b');
    expect(isRivalry(lopsided, 'a', 'b')).toBe(false);
    expect(rivalsOf(h, [{ id: 'a' }, { id: 'b' }] as never, 'a')).toEqual(['b']);
  });

  it('games build the head-to-head record and announce rivalries', () => {
    let u = createUniverse('c', settings({ leagueSize: 4, seasonLength: 50 }), 0);
    u = runCommand(u, { type: 'simToSeasonEnd' }).state;
    const total = Object.values(u.h2h).reduce((s, r) => s + Object.values(r).reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(Object.keys(u.results).length);
    expect(u.timeline.some((t) => t.kind === 'rivalry')).toBe(true);
  }, 60_000);
});
