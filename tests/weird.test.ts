import { describe, expect, it } from 'vitest';
import core from '../content/weird/core.json';
import { tally, winnerOf } from '../src/world/elections';
import { createUniverse, currentElection, prophecy, reduce, runCommand, type UniverseSettings, type UniverseState, type WorldEvent } from '../src/world/universe';
import { DEFAULT_PACKS, effectiveLeague, mergePacks, rollDay, validatePack } from '../src/world/weird';

const settings = (seed: string, p: Partial<UniverseSettings> = {}): UniverseSettings => ({
  name: 'Weird', seed, leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'manual', dayLengthMinutes: 60, ...p,
});

const deathsIn = (u: UniverseState) => u.weird.departed.length;

describe('rule packs', () => {
  it('the core pack is valid', () => {
    expect(() => validatePack(core)).not.toThrow();
  });

  it('rejects malformed packs', () => {
    expect(() => validatePack({ ...core, events: [{ ...core.events[0], effect: { type: 'addPlayerMod', mods: ['nope'], durationDays: null } }] })).toThrow(/unknown mod/);
    expect(() => validatePack({ ...core, playerMods: [{ ...core.playerMods[0], delta: { luck: 5 } }] })).toThrow(/unknown rating/);
    expect(() => validatePack({ ...core, deathCauses: [] })).toThrow();
  });

  it('a brand-new event and modifier can be added with JSON only — no engine changes', () => {
    const custom = validatePack({
      id: 'custom',
      name: 'Test pack',
      eventChancePerMille: { calm: 1000, normal: 1000, weird: 1000, unhinged: 1000 },
      deathsPerSeason: { calm: 0, normal: 0, weird: 0, unhinged: 0 },
      deathCauses: ['n/a'],
      playerMods: [{ id: 'glitter', name: 'Glittering', icon: '✧', description: '+20 contact.', delta: { contact: 20 } }],
      stadiumMods: [],
      events: [{ id: 'glitter-storm', weight: 1, minChaos: 'calm', target: 'player', effect: { type: 'addPlayerMod', mods: ['glitter'], durationDays: null }, text: '{player} is covered in glitter.' }],
    });
    const u = createUniverse('w', settings('pack'), 0);
    const [h] = rollDay({ league: u.league, weird: u.weird, seed: 'pack', season: 1, day: 1, seasonDays: 20, chaos: 'calm' }, custom);
    expect(h.eventId).toBe('glitter-storm');
    expect(h.text).toMatch(/covered in glitter/);
    // And it really changes how the player plays.
    const pid = h.changes[0].kind === 'addPlayerMod' ? h.changes[0].playerId : '';
    const after = reduce(u, { type: 'weird', happening: h } as WorldEvent);
    const game = u.schedule.find((g) => g.awayId === u.league.players[pid].teamId || g.homeId === u.league.players[pid].teamId)!;
    const eff = effectiveLeague(after.league, after.weird, game, 1, mergePacks([...DEFAULT_PACKS, custom]));
    expect(eff.players[pid].ratings.contact).toBe(Math.min(100, u.league.players[pid].ratings.contact + 20));
  });
});

describe('weirdness in a season', () => {
  it('stays deterministic with all weirdness on (Unhinged)', () => {
    const a = runCommand(createUniverse('w', settings('det', { chaos: 'unhinged' }), 0), { type: 'simToSeasonEnd' }).state;
    const b = runCommand(createUniverse('w', settings('det', { chaos: 'unhinged' }), 0), { type: 'simToSeasonEnd' }).state;
    expect(a).toEqual(b);
    expect(a.news.length).toBeGreaterThan(5);
  });

  it('deaths average 1–3 per season at Normal chaos', () => {
    let total = 0;
    const N = 60;
    for (let i = 0; i < N; i++) total += deathsIn(runCommand(createUniverse('w', settings(`d-${i}`), 0), { type: 'simToSeasonEnd' }).state);
    const avg = total / N;
    expect(avg).toBeGreaterThanOrEqual(1);
    expect(avg).toBeLessThanOrEqual(3);
  });

  it('Unhinged is deadlier than Calm', () => {
    let calm = 0;
    let unhinged = 0;
    for (let i = 0; i < 25; i++) {
      calm += deathsIn(runCommand(createUniverse('w', settings(`c-${i}`, { chaos: 'calm' }), 0), { type: 'simToSeasonEnd' }).state);
      unhinged += deathsIn(runCommand(createUniverse('w', settings(`c-${i}`, { chaos: 'unhinged' }), 0), { type: 'simToSeasonEnd' }).state);
    }
    expect(unhinged).toBeGreaterThan(calm);
  });

  it('a departed player leaves the roster and is replaced; rosters stay full', () => {
    for (let i = 0; i < 40; i++) {
      const u = runCommand(createUniverse('w', settings(`r-${i}`, { chaos: 'unhinged' }), 0), { type: 'simToSeasonEnd' }).state;
      if (!u.weird.departed.length) continue;
      const d = u.weird.departed[0];
      const team = u.league.teams.find((t) => t.id === d.teamId)!;
      expect([...team.lineup, ...team.rotation]).not.toContain(d.playerId);
      for (const t of u.league.teams) {
        expect(t.lineup).toHaveLength(9);
        expect(t.rotation).toHaveLength(4);
      }
      return;
    }
    throw new Error('no death found');
  });

  it('resurrection never happens outside an election', () => {
    for (let i = 0; i < 20; i++) {
      // Events only — no player votes; check every returned player came back via an election result.
      const u = runCommand(createUniverse('w', settings(`n-${i}`, { chaos: 'unhinged', seasonLength: 50 }), 0), { type: 'simToSeasonEnd' }).state;
      const returned = Object.entries(u.weird.playerStatus).filter(([, s]) => s === 'returned').map(([id]) => id);
      const viaElection = u.elections
        .filter((e) => e.result)
        .map((e) => e.proposals[e.result!.winner].effect)
        .filter((ef) => ef.kind === 'resurrect')
        .map((ef) => (ef.kind === 'resurrect' ? ef.playerId : ''));
      for (const id of returned) expect(viaElection).toContain(id);
    }
  });

  it('a resurrection election brings a player back, changed, and costs someone their slot', () => {
    for (let i = 0; i < 80; i++) {
      let u = createUniverse('w', settings(`z-${i}`, { chaos: 'unhinged', seasonLength: 50 }), 0);
      for (let guard = 0; guard < 50 && !u.weird.departed.length; guard++) u = runCommand(u, { type: 'endDay' }).state;
      // Find an election offering a resurrection, then vote it through.
      for (let guard = 0; guard < 40; guard++) {
        const e = currentElection(u);
        if (!e) break;
        const idx = e.proposals.findIndex((p) => p.effect.kind === 'resurrect');
        if (idx > 0) {
          const totals = tally(e);
          const need = Math.max(0, totals[winnerOf(totals)] - totals[idx]) + 1;
          u = reduce({ ...u, coins: need * need }, { type: 'votesBought', electionId: e.id, proposal: idx, count: need });
          u = runCommand(u, { type: 'simDays', count: e.closesDay - u.currentDay + 1 }).state;
          const ef = e.proposals[idx].effect;
          const pid = ef.kind === 'resurrect' ? ef.playerId : '';
          expect(u.weird.playerStatus[pid]).toBe('returned');
          expect(u.weird.playerMods[pid].some((m) => ['echo', 'hollow', 'still-warm'].includes(m.id))).toBe(true);
          expect(Object.values(u.weird.playerStatus)).toContain('reserve');
          const team = u.league.teams.find((t) => t.id === u.league.players[pid].teamId)!;
          expect([...team.lineup, ...team.rotation]).toContain(pid);
          return;
        }
        u = runCommand(u, { type: 'simDays', count: e.closesDay - u.currentDay + 1 }).state;
      }
    }
    throw new Error('no resurrection election found');
  });

  it('modifiers expire', () => {
    for (let i = 0; i < 40; i++) {
      let u = createUniverse('w', settings(`x-${i}`, { chaos: 'unhinged', seasonLength: 50 }), 0);
      u = runCommand(u, { type: 'simDays', count: 10 }).state;
      const temp = Object.entries(u.weird.playerMods).flatMap(([id, mods]) => mods.filter((m) => m.until).map((m) => ({ id, m })));
      if (!temp.length) continue;
      const { id, m } = temp[0];
      u = runCommand(u, { type: 'simDays', count: m.until!.day - u.currentDay + 1 }).state;
      expect((u.weird.playerMods[id] ?? []).some((x) => x.id === m.id && x.until?.day === m.until!.day)).toBe(false);
      return;
    }
    throw new Error('no temporary modifier found');
  });

  it("the Prophet's hint previews tonight exactly", () => {
    for (let i = 0; i < 60; i++) {
      const u = createUniverse('w', settings(`p-${i}`, { chaos: 'unhinged' }), 0, { kind: 'prophet', fanName: 'Seer', favoriteTeamId: null });
      const hint = prophecy(u)!;
      const after = runCommand(u, { type: 'endDay' }).state;
      const happened = after.news.length > u.news.length + (after.elections.length > u.elections.length ? 2 : 0);
      expect(hint.startsWith('The air is still')).toBe(!happened);
      if (happened) return;
    }
  });
});

describe('save fixtures', () => {
  it('a real v4 save (Sprint 6) migrates to v5 and keeps playing', async () => {
    const { migrateSave } = await import('../src/storage/migrate');
    const raw = (await import('./fixtures/save-v4.json')).default;
    const u = migrateSave(structuredClone(raw));
    expect(u.weird).toEqual(raw.weird);
    expect(u.settings.dayLengthMinutes).toBe(60);
    expect(u.clock).toBeNull();
    // Timeline backfilled from past elections and deaths.
    expect(u.timeline.filter((t) => t.kind === 'election')).toHaveLength(raw.elections.filter((e) => e.result).length);
    expect(u.timeline.filter((t) => t.kind === 'death')).toHaveLength(raw.weird.departed.length);
    expect(runCommand(u, { type: 'endDay' }).state.currentDay).toBe(14);
  });
});
