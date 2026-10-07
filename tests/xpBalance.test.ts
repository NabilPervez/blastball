import { describe, expect, it } from 'vitest';
import { LEVEL_THRESHOLDS, PERSONA_KINDS, type PersonaKind } from '../src/world/persona';
import {
  betError,
  createUniverse,
  currentElection,
  currentOdds,
  pickError,
  reduce,
  runCommand,
  unplayedToday,
  voteError,
  type UniverseSettings,
  type UniverseState,
} from '../src/world/universe';

/**
 * XP balance run (Sprint 14 DoD): 10 personas × 6 seasons = 60 simulated seasons with a scripted
 * "average player" who opens the app once a day. Slow, so it only runs with XP_BALANCE=1:
 *   XP_BALANCE=1 npx vitest run tests/xpBalance.test.ts
 * Target: Level 2 in season 1–2, Level 3 in season 3–5.
 */
const SEASONS = 6;
const settings = (seed: string): UniverseSettings => ({ name: 'XP', seed, leagueSize: 16, seasonLength: 20, chaos: 'normal', timeMode: 'manual', dayLengthMinutes: 60 });

/** One daily session: a bet, a few cards, one live game, picks kept full, a couple of votes — leaning a little into the persona. */
function session(s: UniverseState, day: number): UniverseState {
  const fav = s.persona!.favoriteTeamId!;
  const today = unplayedToday(s);
  // Bet ~10% of coins: on the favorite if it plays today, otherwise on whoever the odds favor.
  const g = today.find((x) => x.homeId === fav || x.awayId === fav) ?? today[0];
  if (g) {
    const o = currentOdds(s, g.id);
    // Gamblers and Contrarians back the underdog; everyone else the favorite team, or the odds-on side.
    const underdog = o.homePm < o.awayPm ? g.homeId : g.awayId;
    const kind = s.persona!.kind;
    const team = kind === 'gambler' || kind === 'contrarian' ? underdog : g.homeId === fav || g.awayId === fav ? fav : o.homePm >= o.awayPm ? g.homeId : g.awayId;
    const amount = Math.max(10, Math.floor(s.coins / 10));
    if (!betError(s, g.id, team, amount)) s = reduce(s, { type: 'betPlaced', gameId: g.id, teamId: team, amount });
  }
  // Watch the favorite's game live when there is one.
  const live = today.find((x) => x.homeId === fav || x.awayId === fav);
  if (live) s = reduce(s, { type: 'watchedLive', gameId: live.id });
  // Look at three player cards and collect one.
  const ids = Object.keys(s.league.players);
  for (let i = 0; i < 3; i++) s = reduce(s, { type: 'cardViewed', playerId: ids[(day * 3 + i) % ids.length] });
  // Collectors collect two new cards a day, everyone else one.
  for (let i = 0; i < (s.persona!.kind === 'collector' ? 2 : 1); i++) {
    const card = ids[(day * 2 + i) % ids.length];
    if (!s.collection.some((c) => c.playerId === card)) s = reduce(s, { type: 'collectionToggled', playerId: card });
  }
  if (s.weird.departed[0]) s = reduce(s, { type: 'departedVisited', playerId: s.weird.departed[0].playerId });
  // Keep picks full: back the favorite's hitters, fade another team's.
  const team = s.league.teams.find((t) => t.id === fav)!;
  const other = s.league.teams.find((t) => t.id !== fav)!;
  for (const id of team.lineup) if (!s.picks.back.includes(id) && !pickError(s, id, 'back')) s = reduce(s, { type: 'pickSet', playerId: id, kind: 'back' });
  for (const id of other.lineup) if (!s.picks.fade.includes(id) && !pickError(s, id, 'fade')) s = reduce(s, { type: 'pickSet', playerId: id, kind: 'fade' });
  // Two votes in each election for the first proposal; Organizers add one vote every day it's open.
  const e = currentElection(s);
  const organizer = s.persona!.kind === 'organizer';
  if (e && (organizer || !e.playerVotes.some((v) => v > 0)) && !voteError(s, e.id, 0, organizer ? 1 : 2)) s = reduce(s, { type: 'votesBought', electionId: e.id, proposal: 0, count: organizer ? 1 : 2 });
  return s;
}

function run(kind: PersonaKind) {
  let s = createUniverse('xp', settings(`xp-${kind}`), 0, { kind, fanName: 'Avg', favoriteTeamId: 't1' });
  const reached: { l2: number | null; l3: number | null } = { l2: null, l3: null };
  const xpBySeason: number[] = [];
  let day = 0;
  while (s.season <= SEASONS) {
    const season = s.season;
    if (s.phase === 'regular') s = session(s, day++);
    s = runCommand(s, { type: 'simDays', count: 1 }).state;
    const xp = s.persona!.xp ?? 0;
    if (reached.l2 === null && xp >= LEVEL_THRESHOLDS[1]) reached.l2 = season;
    if (reached.l3 === null && xp >= LEVEL_THRESHOLDS[2]) reached.l3 = season;
    if (s.season !== season) xpBySeason.push(xp);
  }
  return { kind, ...reached, xpBySeason };
}

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

describe.skipIf(!env.XP_BALANCE)('XP balance (60 seasons)', () => {
  it('average player: Level 2 in season 1–2, Level 3 in season 3–5', () => {
    const rows = PERSONA_KINDS.map(run);
    console.table(rows.map((r) => ({ persona: r.kind, 'L2 season': r.l2 ?? '—', 'L3 season': r.l3 ?? '—', 'XP after each season': r.xpBySeason.join(' / ') })));
    for (const r of rows) {
      expect(r.l2, `${r.kind} L2`).not.toBeNull();
      expect(r.l2!, `${r.kind} L2`).toBeLessThanOrEqual(2);
      expect(r.l3, `${r.kind} L3`).not.toBeNull();
      expect(r.l3!, `${r.kind} L3`).toBeGreaterThanOrEqual(3);
      expect(r.l3!, `${r.kind} L3`).toBeLessThanOrEqual(5);
    }
  }, 600_000);
});
