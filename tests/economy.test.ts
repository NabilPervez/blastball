import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { gameOdds, multiplierFor, type PublicTeamView } from '../src/engine/odds';
import { migrateSave } from '../src/storage/migrate';
import { analystReveal, personaMultiplier, winningPayout, type Persona } from '../src/world/persona';
import {
  betError,
  createUniverse,
  currentOdds,
  DAILY_STIPEND,
  offeredMultiplier,
  reduce,
  runCommand,
  SAVE_VERSION,
  STARTING_COINS,
  unplayedToday,
  type UniverseSettings,
  type UniverseState,
} from '../src/world/universe';

const settings: UniverseSettings = { name: 'Econ', seed: 'econ-seed', leagueSize: 8, seasonLength: 20, chaos: 'normal', timeMode: 'manual', dayLengthMinutes: 60 };
const persona = (kind: Persona['kind'], favoriteTeamId: string | null = null): Persona => ({ kind, fanName: 'Pat', favoriteTeamId });
const fresh = (p: Persona | null = null) => createUniverse('e', settings, 0, p);

describe('odds', () => {
  const team = (p: Partial<PublicTeamView>): PublicTeamView => ({ teamId: 'x', battingHalfStars: 45, pitcherHalfStars: 5, wins: 0, losses: 0, ...p });

  it('probabilities sum to 1000, stronger teams are favored, house keeps an edge', () => {
    const o = gameOdds(team({ battingHalfStars: 30 }), team({ battingHalfStars: 60 }));
    expect(o.awayPm + o.homePm).toBe(1000);
    expect(o.homePm).toBeGreaterThan(o.awayPm);
    // Expected return of a bet is below the stake (5% edge).
    expect((o.homePm * o.homeMult) / 1_000_000).toBeLessThan(1);
  });

  it('are deterministic for a given seed and day', () => {
    const a = fresh();
    const b = fresh();
    const g = unplayedToday(a)[0].id;
    expect(currentOdds(a, g)).toEqual(currentOdds(b, g));
  });

  it('even game pays 1.90×', () => {
    expect(multiplierFor(500)).toBe(1900);
  });
});

describe('betting', () => {
  it('places a bet, locks the stake, and settles a win or a loss', () => {
    let u = fresh();
    const game = unplayedToday(u)[0];
    u = reduce(u, { type: 'betPlaced', gameId: game.id, teamId: game.homeId, amount: 40 });
    expect(u.coins).toBe(STARTING_COINS - 40);
    expect(u.bets).toHaveLength(1);
    const mult = u.bets[0].multMilli;
    u = runCommand(u, { type: 'playGame', gameId: game.id }).state;
    const r = u.results[game.id];
    const won = r.homeScore > r.awayScore;
    expect(u.bets[0].status).toBe(won ? 'won' : 'lost');
    expect(u.coins).toBe(STARTING_COINS - 40 + (won ? Math.floor((40 * mult) / 1000) : 0));
  });

  it('bets lock once a game starts (watching counts)', () => {
    let u = fresh();
    const game = unplayedToday(u)[0];
    u = reduce(u, { type: 'gameStarted', gameId: game.id });
    expect(betError(u, game.id, game.homeId, 10)).toMatch(/closed/);
    expect(reduce(u, { type: 'betPlaced', gameId: game.id, teamId: game.homeId, amount: 10 })).toBe(u);
  });

  it('rejects bets on future days, the other side, and invalid amounts', () => {
    const u = fresh();
    const today = unplayedToday(u)[0];
    const tomorrow = u.schedule.find((g) => g.day === 2)!;
    expect(betError(u, tomorrow.id, tomorrow.homeId, 5)).toMatch(/today/);
    expect(betError(u, today.id, today.homeId, 0)).toBeTruthy();
    expect(betError(u, today.id, today.homeId, 1.5)).toBeTruthy();
    const after = reduce(u, { type: 'betPlaced', gameId: today.id, teamId: today.homeId, amount: 5 });
    expect(betError(after, today.id, today.awayId, 5)).toMatch(/other team/);
  });

  it('coins never go negative, whatever the player tries (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.nat(10), fc.boolean(), fc.integer({ min: -50, max: 400 }), fc.boolean()), { maxLength: 40 }), (actions) => {
        let u: UniverseState = fresh();
        for (const [gi, home, amount, advance] of actions) {
          const games = unplayedToday(u);
          if (games.length) {
            const g = games[gi % games.length];
            u = reduce(u, { type: 'betPlaced', gameId: g.id, teamId: home ? g.homeId : g.awayId, amount });
          }
          if (advance) u = runCommand(u, { type: 'nextGame' }).state;
          expect(u.coins).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 40 },
    );
  });

  it('pays a daily stipend', () => {
    const u = runCommand(fresh(), { type: 'endDay' }).state;
    expect(u.coins).toBe(STARTING_COINS + DAILY_STIPEND);
  });
});

describe('personas', () => {
  it('is chosen once per universe', () => {
    let u = fresh();
    u = reduce(u, { type: 'personaChosen', persona: persona('gambler') });
    u = reduce(u, { type: 'personaChosen', persona: persona('analyst') });
    expect(u.persona?.kind).toBe('gambler');
  });

  it('Diehard: +25% of stake on winning bets for their team only', () => {
    const p = persona('diehard', 't1');
    expect(winningPayout(p, 100, 1900, 't1')).toBe(190 + 25);
    expect(winningPayout(p, 100, 1900, 't2')).toBe(190);
    expect(winningPayout(null, 100, 1900, 't1')).toBe(190);
  });

  it('Gambler: better payouts on underdogs only', () => {
    expect(personaMultiplier(persona('gambler'), 2500, 380)).toBe(3000);
    expect(personaMultiplier(persona('gambler'), 1500, 620)).toBe(1500);
    expect(personaMultiplier(persona('analyst'), 2500, 380)).toBe(2500);
    // And the universe applies it when offering odds.
    const base = fresh();
    const gam = fresh(persona('gambler'));
    const g = unplayedToday(base)[0];
    const odds = currentOdds(base, g.id);
    const dog = odds.homePm < 500 ? g.homeId : g.awayId;
    expect(offeredMultiplier(gam, g.id, dog)).toBeGreaterThan(offeredMultiplier(base, g.id, dog));
  });

  it('Analyst: reveals one real hidden rating, the same one every time', () => {
    const u = fresh();
    for (const p of Object.values(u.league.players).slice(0, 20)) {
      const r = analystReveal(p);
      expect(analystReveal(p)).toEqual(r);
      expect(Object.values(p.ratings)).toContain(r.value);
    }
  });
});

describe('save migration v1 → v2', () => {
  it('old saves load with a starting coin balance and no persona yet', async () => {
    const raw = (await import('./fixtures/save-v1.json')).default;
    const u = migrateSave(structuredClone(raw));
    expect(u.saveVersion).toBe(SAVE_VERSION);
    expect(u.coins).toBe(100);
    expect(u.bets).toEqual([]);
    expect(u.persona).toBeNull();
    const g = unplayedToday(u)[0];
    expect(reduce(u, { type: 'betPlaced', gameId: g.id, teamId: g.homeId, amount: 10 }).coins).toBe(90);
  });
});

describe('save fixtures', () => {
  it('a real v2 save (Sprint 4) migrates to v3 and stays playable', async () => {
    const raw = (await import('./fixtures/save-v2.json')).default;
    const u = migrateSave(structuredClone(raw));
    expect(u.coins).toBe(raw.coins);
    expect(u.bets.map((b) => ({ ...b, season: undefined }))).toEqual(raw.bets.map((b) => ({ ...b, season: undefined })));
    expect(u.factions).toHaveLength(6);
    expect(u.elections).toEqual([]);
    expect(u.persona?.kind).toBe('gambler');
    expect(u.bets[0].status).not.toBe('open');
    const next = runCommand(u, { type: 'endDay' }).state;
    expect(next.currentDay).toBe(4);
    // The first election opens for migrated saves once the day ends.
    expect(next.elections).toHaveLength(1);
    expect(next.elections[0].openedDay).toBe(4);
  });
});
