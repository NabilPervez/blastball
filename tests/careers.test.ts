import { describe, expect, it } from 'vitest';
import { careerPhase, runOffseason } from '../src/world/seasons';
import { createUniverse, reduce, runCommand, type UniverseSettings } from '../src/world/universe';
import { tierOf, weirdnessScore, flavorOf } from '../src/world/rarity';
import { agingTraits, DEFAULT_PACKS, mergePacks } from '../src/world/weird';

const settings = (over: Partial<UniverseSettings> = {}): UniverseSettings =>
  ({ name: 'T', seed: 'careers', leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'manual', dayLengthMinutes: 60, ...over }) as UniverseSettings;

describe('careers', () => {
  it('a new league is a mix of rookies and veterans', () => {
    const u = createUniverse('c', settings(), 0);
    const exp = Object.values(u.experience);
    expect(exp.some((e) => e === 0)).toBe(true);
    expect(exp.some((e) => e >= 5)).toBe(true);
    for (const id of Object.keys(u.league.players)) expect(u.experience[id]).toBeLessThanOrEqual(u.ages[id] - 21);
  });

  it('players rise, peak, then fade', () => {
    expect(careerPhase(22)).toBe('rising');
    expect(careerPhase(28)).toBe('prime');
    expect(careerPhase(32)).toBe('fading');
    expect(careerPhase(35)).toBe('twilight');
    const u = createUniverse('c', settings({ leagueSize: 16 }), 0);
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    const off = runOffseason(u.league, u.ages, 'seed', 2, u.experience);
    const kept = Object.keys(u.ages).filter((id) => off.league.players[id] && !off.retired.some((r) => r.playerId === id));
    const change = (id: string) => sum(off.league.players[id].ratings) - sum(u.league.players[id].ratings);
    const young = kept.filter((id) => u.ages[id] + 1 <= 25);
    const old = kept.filter((id) => u.ages[id] + 1 >= 34);
    expect(young.every((id) => change(id) > 0)).toBe(true);
    expect(old.every((id) => change(id) < 0)).toBe(true);
    for (const id of kept) expect(off.experience[id]).toBe(u.experience[id] + 1);
  });

  it('aging traits bend the curve', () => {
    const u = createUniverse('c', settings(), 0);
    const old = Object.keys(u.ages).find((id) => u.ages[id] === 33)!;
    const withTrait = runOffseason(u.league, u.ages, 'seed', 2, u.experience, { [old]: { shift: 6, delay: 4 } });
    const without = runOffseason(u.league, u.ages, 'seed', 2, u.experience);
    const sum = (id: string, l: typeof u.league) => Object.values(l.players[id].ratings).reduce((a, b) => a + b, 0);
    if (!without.retired.some((r) => r.playerId === old)) expect(sum(old, withTrait.league)).toBeGreaterThan(sum(old, without.league));
    expect(withTrait.retired.some((r) => r.playerId === old)).toBe(false);

    const weird = { ...u.weird, playerMods: { [old]: [{ id: 'ageless', until: null }] } };
    expect(agingTraits(weird, mergePacks(DEFAULT_PACKS), 1, 1)[old]).toEqual({ shift: 1, delay: 4 });
  });

  it('more traits make a rarer card', () => {
    const born = createUniverse('c', settings(), 0);
    const u = { ...born, weird: { ...born.weird, playerMods: {} } };
    expect(tierOf(u, 't1p1')).toBe('common');
    const weird = { ...u.weird, playerMods: { t1p1: ['glasses', 'extra-arm', 'ageless', 'old-soul', 'echo'].map((id) => ({ id, until: null })) } };
    const v = { ...u, weird };
    expect(weirdnessScore(v, 't1p1')).toBeGreaterThanOrEqual(9);
    expect(tierOf(v, 't1p1')).toBe('legendary');
    expect(flavorOf('t1p1')).toBe(flavorOf('t1p1'));
  });

  it('favorites are collected as keepsakes and survive retirement', () => {
    let u = createUniverse('c', settings(), 0);
    u = reduce(u, { type: 'collectionToggled', playerId: 't1p1' });
    u = reduce(u, { type: 'collectionToggled', playerId: 't2p3' });
    expect(u.collection.map((c) => c.playerId)).toEqual(['t1p1', 't2p3']);
    u = reduce(u, { type: 'collectionToggled', playerId: 't1p1' });
    expect(u.collection.map((c) => c.playerId)).toEqual(['t2p3']);
    expect(reduce(u, { type: 'collectionToggled', playerId: 'nobody' })).toBe(u);
    for (let i = 0; i < 3; i++) u = runCommand(runCommand(u, { type: 'simToSeasonEnd' }).state, { type: 'endDay' }).state;
    expect(u.collection.map((c) => c.playerId)).toEqual(['t2p3']);
  }, 60_000);
});
