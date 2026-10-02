import { addLines, boxScore, emptyLine, type BoxScore, type StatLine } from '../engine/boxScore';
import { ENGINE_VERSION, simulateGame } from '../engine/game';
import { oddsForGame } from '../engine/odds';
import { computeStandings, generateSchedule } from '../engine/season';
import type { GameEvent, League, ScheduledGame } from '../engine/types';
import type { Clock, DayLengthMinutes } from './clock';
import { applyEffect, marginalCost, openElection, playerVoteTotal, tally, winnerOf, type Election } from './elections';
import { createFactions, type Faction } from './factions';
import { generateLeague } from './generate';
import { personaMultiplier, winningPayout, type Persona } from './persona';
import { applyHappening, createStadiums, DEFAULT_PACKS, effectiveLeague, expireMods, mergePacks, resurrect, rollDay, type WeirdHappening, type WeirdState } from './weird';

/** The active rule packs (data-driven weirdness). */
export const RULES = mergePacks(DEFAULT_PACKS);

/**
 * A universe is one save: settings + league + season progress. All changes go through
 * `reduce(state, event)`, so the same events always produce the same state.
 */

export const SAVE_VERSION = 5;

export const STARTING_COINS = 100;
/** Small daily allowance so a broke fan can always get back in the game. */
export const DAILY_STIPEND = 10;
const LEDGER_KEPT = 200;

export type ChaosLevel = 'calm' | 'normal' | 'weird' | 'unhinged';
export type TimeMode = 'manual' | 'living';
export const LEAGUE_SIZES = [4, 8, 12, 16] as const;
export const SEASON_LENGTHS = [20, 50, 99] as const;

export interface UniverseSettings {
  name: string;
  seed: string;
  leagueSize: (typeof LEAGUE_SIZES)[number];
  seasonLength: (typeof SEASON_LENGTHS)[number];
  chaos: ChaosLevel;
  timeMode: TimeMode;
  /** Living mode: real minutes per in-game day. */
  dayLengthMinutes: DayLengthMinutes;
}

export type TimelineKind = 'election' | 'death' | 'return' | 'weird' | 'champion';

/** Notable world events, kept forever (unlike the capped news feed). */
export interface TimelineEntry {
  season: number;
  day: number;
  kind: TimelineKind;
  text: string;
}

export interface GameSummary {
  gameId: string;
  day: number;
  awayId: string;
  homeId: string;
  awayScore: number;
  homeScore: number;
  innings: number;
}

export interface LogEntry {
  season: number;
  day: number;
  text: string;
}

export interface Bet {
  id: string;
  gameId: string;
  day: number;
  teamId: string;
  amount: number;
  /** Payout multiplier in thousandths, locked when the bet is placed. */
  multMilli: number;
  status: 'open' | 'won' | 'lost';
  payout: number;
}

export interface LedgerEntry {
  season: number;
  day: number;
  amount: number;
  reason: string;
}

export interface UniverseState {
  saveVersion: number;
  engineVersion: number;
  id: string;
  createdAt: number;
  settings: UniverseSettings;
  league: League;
  season: number;
  schedule: ScheduledGame[];
  results: Record<string, GameSummary>;
  /** Games the player has started watching (locks them from changes such as bets). */
  started: string[];
  currentDay: number;
  seasonStats: Record<string, StatLine>;
  careerStats: Record<string, StatLine>;
  playerLog: Record<string, LogEntry[]>;
  coins: number;
  bets: Bet[];
  persona: Persona | null;
  /** Most recent coin movements, newest last. */
  ledger: LedgerEntry[];
  factions: Faction[];
  /** Every election this universe has held; the last one is open while result === null. */
  elections: Election[];
  /** Headlines: faction reactions, election results. Newest last. */
  news: NewsItem[];
  /** Modifiers, stadiums, the Departed. */
  weird: WeirdState;
  /** Living mode clock; null in Manual mode. */
  clock: Clock | null;
  timeline: TimelineEntry[];
  /** Day the player last exported (or dismissed the backup reminder). */
  lastBackupDay: number;
}

export interface NewsItem {
  season: number;
  day: number;
  text: string;
}

export type WorldEvent =
  | { type: 'gameStarted'; gameId: string }
  | { type: 'gamePlayed'; summary: GameSummary; box: BoxScore }
  | { type: 'dayEnded'; day: number }
  | { type: 'personaChosen'; persona: Persona }
  | { type: 'betPlaced'; gameId: string; teamId: string; amount: number }
  | { type: 'votesBought'; electionId: number; proposal: number; count: number }
  | { type: 'weird'; happening: WeirdHappening }
  | { type: 'timeSettingsChanged'; timeMode: TimeMode; dayLengthMinutes: DayLengthMinutes; nowMs: number }
  | { type: 'clockSet'; clock: Clock }
  | { type: 'backupNoted'; day: number };

export function createUniverse(id: string, settings: UniverseSettings, now: number, persona: Persona | null = null): UniverseState {
  const league = generateLeague({ seed: settings.seed, name: settings.name, teamCount: settings.leagueSize });
  const base: UniverseState = {
    saveVersion: SAVE_VERSION,
    engineVersion: ENGINE_VERSION,
    id,
    createdAt: now,
    settings,
    league,
    season: 1,
    schedule: generateSchedule(league.teams, settings.seasonLength),
    results: {},
    started: [],
    currentDay: 1,
    seasonStats: {},
    careerStats: {},
    playerLog: {},
    coins: STARTING_COINS,
    bets: [],
    persona,
    ledger: [],
    factions: createFactions(settings.seed, league.teams.map((t) => t.id)),
    elections: [],
    news: [],
    weird: { playerStatus: {}, playerMods: {}, stadiums: createStadiums(settings.seed, league), departed: [] },
    clock: settings.timeMode === 'living' ? { anchorMs: now, anchorDay: 1 } : null,
    timeline: [],
    lastBackupDay: 1,
  };
  return withNewElection(base, 1);
}

export const seasonDays = (s: UniverseState) => s.settings.seasonLength;
export const isSeasonOver = (s: UniverseState) => s.currentDay > seasonDays(s);
export const gamesOn = (s: UniverseState, day: number) => s.schedule.filter((g) => g.day === day);
export const unplayedToday = (s: UniverseState) => gamesOn(s, s.currentDay).filter((g) => !s.results[g.id]);

export function teamRecords(s: UniverseState): Record<string, { wins: number; losses: number }> {
  return Object.fromEntries(
    computeStandings(s.league.teams, Object.values(s.results)).map((r) => [r.teamId, { wins: r.wins, losses: r.losses }]),
  );
}

/** Odds a bettor sees for a game right now (public info only). */
export function currentOdds(s: UniverseState, gameId: string) {
  const game = s.schedule.find((g) => g.id === gameId)!;
  return oddsForGame(s.league, game, teamRecords(s));
}

/** The multiplier this player would get backing `teamId` (after persona perks). */
export function offeredMultiplier(s: UniverseState, gameId: string, teamId: string): number {
  const game = s.schedule.find((g) => g.id === gameId)!;
  const odds = currentOdds(s, gameId);
  const home = teamId === game.homeId;
  return personaMultiplier(s.persona, home ? odds.homeMult : odds.awayMult, home ? odds.homePm : odds.awayPm);
}

/** Why a bet can't be placed, or null if it can. Bets lock when a game starts. */
export function betError(s: UniverseState, gameId: string, teamId: string, amount: number): string | null {
  const game = s.schedule.find((g) => g.id === gameId);
  if (!game) return 'No such game.';
  if (game.day !== s.currentDay) return "You can only bet on today's games.";
  if (s.results[gameId] || s.started.includes(gameId)) return 'Betting is closed — this game has started.';
  if (teamId !== game.awayId && teamId !== game.homeId) return "That team isn't playing in this game.";
  if (!Number.isInteger(amount) || amount < 1) return 'Bet at least 1 coin.';
  if (amount > s.coins) return 'Not enough coins.';
  if (s.bets.some((b) => b.gameId === gameId && b.teamId !== teamId)) return 'You already backed the other team in this game.';
  return null;
}

const teamName = (s: UniverseState, id: string) => s.league.teams.find((t) => t.id === id)?.name ?? id;

const withLedger = (s: UniverseState, amount: number, reason: string, day = s.currentDay): LedgerEntry[] =>
  [...s.ledger, { season: s.season, day, amount, reason }].slice(-LEDGER_KEPT);

const NEWS_KEPT = 120;
const withNews = (s: UniverseState, texts: string[], day = s.currentDay): NewsItem[] =>
  [...s.news, ...texts.map((text) => ({ season: s.season, day, text }))].slice(-NEWS_KEPT);

const withTimeline = (s: UniverseState, kind: TimelineKind, text: string, day = s.currentDay): TimelineEntry[] => [...s.timeline, { season: s.season, day, kind, text }];

/** The election currently accepting votes, if any. */
export const currentElection = (s: UniverseState): Election | null => {
  const e = s.elections[s.elections.length - 1];
  return e && !e.result ? e : null;
};

const publicStandings = (s: UniverseState) =>
  computeStandings(s.league.teams, Object.values(s.results)).map((r) => ({ teamId: r.teamId, wins: r.wins, losses: r.losses }));

/** Open the next weekly election starting on `openedDay` (no-op past the end of the season). */
export function withNewElection(s: UniverseState, openedDay: number): UniverseState {
  if (openedDay > seasonDays(s)) return s;
  const departed = s.weird.departed
    .filter((d) => s.weird.playerStatus[d.playerId] === 'departed')
    .map((d) => ({ playerId: d.playerId, name: s.league.players[d.playerId].name, teamId: d.teamId }));
  const e = openElection(s.league, s.factions, publicStandings(s), s.elections.length + 1, s.season, openedDay, seasonDays(s), departed);
  // The faction most committed to a single proposal makes the headline.
  let loudest = s.factions[0];
  let loudestPick = 0;
  for (const f of s.factions) {
    const votes = e.factionVotes[f.id];
    const pick = votes.indexOf(Math.max(...votes));
    if (votes[pick] > e.factionVotes[loudest.id][loudestPick]) {
      loudest = f;
      loudestPick = pick;
    }
  }
  return {
    ...s,
    elections: [...s.elections, e],
    news: withNews(
      s,
      [
        `Election #${e.id} is open until the end of day ${e.closesDay}: ${e.proposals.map((p) => p.title).join(' · ')}.`,
        `${loudest.name} throw their weight behind “${e.proposals[loudestPick].title}”.`,
      ],
      openedDay,
    ),
  };
}

/** Why votes can't be bought, or null if they can. */
export function voteError(s: UniverseState, electionId: number, proposal: number, count: number): string | null {
  const e = currentElection(s);
  if (!e || e.id !== electionId) return 'This election is closed.';
  if (!Number.isInteger(proposal) || proposal < 0 || proposal >= e.proposals.length) return 'No such proposal.';
  if (!Number.isInteger(count) || count < 1) return 'Buy at least 1 vote.';
  const cost = marginalCost(playerVoteTotal(e), count, s.persona?.kind === 'organizer');
  if (cost > s.coins) return `Not enough coins (needs ${cost}).`;
  return null;
}

function resolveElection(s: UniverseState, e: Election, day: number): UniverseState {
  const totals = tally(e);
  const winner = winnerOf(totals);
  const proposal = e.proposals[winner];
  let { league, notes } = applyEffect(s.league, proposal.effect);
  let weird = s.weird;
  const headlines = [`Election #${e.id}: “${proposal.title}” wins with ${totals[winner]} votes.`];
  if (proposal.effect.kind === 'resurrect') {
    const back = resurrect(league, weird, proposal.effect.playerId, s.settings.seed, RULES);
    league = back.league;
    weird = back.weird;
    const name = league.players[proposal.effect.playerId].name;
    notes = [...notes, { playerId: proposal.effect.playerId, text: `Returned from the Departed by election — changed: ${back.modName}.` }];
    headlines.push(`${name} has returned. They are not quite the same: ${back.modName}.`);
  }
  const playerLog = { ...s.playerLog };
  for (const n of notes) playerLog[n.playerId] = [...(playerLog[n.playerId] ?? []), { season: s.season, day, text: n.text }];

  if (playerVoteTotal(e) > 0) {
    const without = tally({ ...e, playerVotes: e.playerVotes.map(() => 0) });
    const fan = s.persona?.fanName || 'A mysterious fan';
    if (winnerOf(without) !== winner) headlines.push(`${fan}'s ${e.playerVotes[winner]} votes swung the election!`);
    else headlines.push(`${fan} cast ${playerVoteTotal(e)} votes.`);
  }

  const elections = s.elections.map((x) => (x.id === e.id ? { ...x, result: { winner, totals } } : x));
  let timeline = withTimeline(s, 'election', headlines[0], day);
  if (proposal.effect.kind === 'resurrect') timeline = [...timeline, { season: s.season, day, kind: 'return', text: headlines[1] }];
  return { ...s, league, weird, playerLog, elections, timeline, news: withNews(s, headlines, day) };
}

/** Story-worthy notes for a player's life timeline, from one game's box score. */
function notesFor(line: StatLine, career: StatLine | undefined): string[] {
  const notes: string[] = [];
  if (line.hr > 0 && !career?.hr) notes.push('Hit their first career home run.');
  if (line.hr >= 2) notes.push(`Hit ${line.hr} home runs in one game.`);
  if (line.h >= 4) notes.push(`Went ${line.h}-for-${line.ab}.`);
  if (line.pk >= 10) notes.push(`Struck out ${line.pk} batters.`);
  if (line.gs && line.w && line.ra === 0 && line.outs >= 27) notes.push('Threw a shutout.');
  return notes;
}

function settleBets(state: UniverseState, summary: GameSummary): UniverseState {
  if (!state.bets.some((b) => b.gameId === summary.gameId && b.status === 'open')) return state;
  const winnerId = summary.homeScore > summary.awayScore ? summary.homeId : summary.awayId;
  let next = state;
  const bets = state.bets.map((b): Bet => {
    if (b.gameId !== summary.gameId || b.status !== 'open') return b;
    if (b.teamId !== winnerId) return { ...b, status: 'lost', payout: 0 };
    const payout = winningPayout(state.persona, b.amount, b.multMilli, b.teamId);
    next = { ...next, coins: next.coins + payout, ledger: withLedger(next, payout, `Bet won: ${teamName(state, b.teamId)}`, summary.day) };
    return { ...b, status: 'won', payout };
  });
  return { ...next, bets };
}

export function reduce(state: UniverseState, event: WorldEvent): UniverseState {
  switch (event.type) {
    case 'gameStarted':
      return state.started.includes(event.gameId) ? state : { ...state, started: [...state.started, event.gameId] };

    case 'gamePlayed': {
      const { summary, box } = event;
      if (state.results[summary.gameId]) return state;
      const seasonStats = { ...state.seasonStats };
      const careerStats = { ...state.careerStats };
      const playerLog = { ...state.playerLog };
      for (const [pid, line] of Object.entries(box)) {
        for (const text of notesFor(line, careerStats[pid])) {
          playerLog[pid] = [...(playerLog[pid] ?? []), { season: state.season, day: summary.day, text }];
        }
        seasonStats[pid] = addLines(seasonStats[pid] ?? emptyLine(), line);
        careerStats[pid] = addLines(careerStats[pid] ?? emptyLine(), line);
      }
      return settleBets({ ...state, results: { ...state.results, [summary.gameId]: summary }, seasonStats, careerStats, playerLog }, summary);
    }

    case 'dayEnded':
    {
      if (event.day !== state.currentDay) return state;
      let next: UniverseState = {
        ...state,
        currentDay: state.currentDay + 1,
        coins: state.coins + DAILY_STIPEND,
        ledger: withLedger(state, DAILY_STIPEND, 'Daily fan stipend'),
        weird: expireMods(state.weird, state.season, state.currentDay + 1),
      };
      const open = currentElection(next);
      if (open && open.closesDay <= event.day) {
        next = resolveElection(next, open, event.day);
        next = withNewElection(next, event.day + 1);
      } else if (!open) {
        next = withNewElection(next, event.day + 1); // e.g. saves from before elections existed
      }
      if (isSeasonOver(next) && !isSeasonOver(state)) {
        const top = computeStandings(next.league.teams, Object.values(next.results))[0];
        const t = next.league.teams.find((x) => x.id === top.teamId)!;
        next = { ...next, timeline: withTimeline(next, 'champion', `The ${t.city} ${t.name} win Season ${next.season} at ${top.wins}–${top.losses}.`, event.day) };
      }
      return next;
    }

    case 'timeSettingsChanged': {
      const settings = { ...state.settings, timeMode: event.timeMode, dayLengthMinutes: event.dayLengthMinutes };
      // Switching modes or day length restarts the clock from now.
      const clock = event.timeMode === 'living' ? { anchorMs: event.nowMs, anchorDay: state.currentDay } : null;
      return { ...state, settings, clock };
    }

    case 'clockSet':
      return state.settings.timeMode === 'living' ? { ...state, clock: event.clock } : state;

    case 'backupNoted':
      return { ...state, lastBackupDay: Math.max(state.lastBackupDay, event.day) };

    case 'weird': {
      const h = event.happening;
      const { league, weird } = applyHappening(state.league, state.weird, h, state.season, state.currentDay);
      const playerLog = { ...state.playerLog };
      const note = (id: string, text: string) => (playerLog[id] = [...(playerLog[id] ?? []), { season: state.season, day: state.currentDay, text }]);
      for (const c of h.changes) {
        if (c.kind === 'addPlayerMod') note(c.playerId, h.text);
        if (c.kind === 'ratings' && c.playerIds.length === 1) note(c.playerIds[0], h.text);
        if (c.kind === 'death') {
          note(c.playerId, `Departed: ${c.cause}`);
          note(c.replacement.id, `Called up to replace ${state.league.players[c.playerId].name}.`);
        }
      }
      const kind: TimelineKind = h.eventId === 'death' ? 'death' : 'weird';
      return { ...state, league, weird, playerLog, news: withNews(state, [h.text]), timeline: withTimeline(state, kind, h.text) };
    }

    case 'votesBought': {
      const { electionId, proposal, count } = event;
      if (voteError(state, electionId, proposal, count)) return state;
      const e = currentElection(state)!;
      const cost = marginalCost(playerVoteTotal(e), count, state.persona?.kind === 'organizer');
      const updated: Election = {
        ...e,
        playerVotes: e.playerVotes.map((v, i) => (i === proposal ? v + count : v)),
        coinsSpent: e.coinsSpent + cost,
      };
      return {
        ...state,
        coins: state.coins - cost,
        elections: state.elections.map((x) => (x.id === e.id ? updated : x)),
        ledger: withLedger(state, -cost, `${count} vote${count === 1 ? '' : 's'}: ${e.proposals[proposal].title}`),
      };
    }

    case 'personaChosen':
      if (state.persona) return state; // chosen once per universe
      return { ...state, persona: event.persona };

    case 'betPlaced': {
      const { gameId, teamId, amount } = event;
      if (betError(state, gameId, teamId, amount)) return state;
      const multMilli = offeredMultiplier(state, gameId, teamId);
      const existing = state.bets.find((b) => b.gameId === gameId && b.teamId === teamId && b.status === 'open');
      const bets: Bet[] = existing
        ? state.bets.map((b) =>
            b === existing
              ? { ...b, amount: b.amount + amount, multMilli: Math.floor((b.amount * b.multMilli + amount * multMilli) / (b.amount + amount)) }
              : b,
          )
        : [...state.bets, { id: `${state.season}-${gameId}-${teamId}`, gameId, day: state.currentDay, teamId, amount, multMilli, status: 'open', payout: 0 }];
      return { ...state, coins: state.coins - amount, bets, ledger: withLedger(state, -amount, `Bet on ${teamName(state, teamId)}`) };
    }
  }
}

export const reduceAll = (state: UniverseState, events: WorldEvent[]) => events.reduce(reduce, state);

// ---------------------------------------------------------------------------
// Commands: pure functions that run the simulation and return the events to apply.

export type Command =
  | { type: 'playGame'; gameId: string }
  | { type: 'nextGame' }
  | { type: 'endDay' }
  | { type: 'simDays'; count: number }
  | { type: 'simToSeasonEnd' };

export interface PlayByPlay {
  gameId: string;
  day: number;
  season: number;
  events: GameEvent[];
}

export interface CommandResult {
  state: UniverseState;
  events: WorldEvent[];
  /** Play-by-play for games simulated by this command (only the most recent days are kept). */
  pbp: PlayByPlay[];
}

/** How many days of play-by-play are kept (older games keep only their box score). */
export const PBP_DAYS_KEPT = 7;

export function runCommand(start: UniverseState, cmd: Command): CommandResult {
  let state = start;
  const events: WorldEvent[] = [];
  const pbp: PlayByPlay[] = [];

  const apply = (e: WorldEvent) => {
    state = reduce(state, e);
    events.push(e);
  };

  const play = (game: ScheduledGame) => {
    if (state.results[game.id]) return;
    const result = simulateGame(effectiveLeague(state.league, state.weird, game, state.season, RULES), game, state.season);
    apply({
      type: 'gamePlayed',
      summary: {
        gameId: game.id,
        day: game.day,
        awayId: result.awayId,
        homeId: result.homeId,
        awayScore: result.awayScore,
        homeScore: result.homeScore,
        innings: result.innings,
      },
      box: boxScore(result),
    });
    pbp.push({ gameId: game.id, day: game.day, season: state.season, events: result.events });
  };

  const endDay = () => {
    if (isSeasonOver(state)) return;
    unplayedToday(state).forEach(play);
    for (const happening of rollDay(rollInput(state), RULES)) apply({ type: 'weird', happening });
    apply({ type: 'dayEnded', day: state.currentDay });
  };

  switch (cmd.type) {
    case 'playGame': {
      const game = state.schedule.find((g) => g.id === cmd.gameId);
      if (!game || game.day !== state.currentDay) throw new Error(`Game ${cmd.gameId} is not playable today`);
      play(game);
      break;
    }
    case 'nextGame': {
      const next = unplayedToday(state)[0];
      if (next) play(next);
      else endDay();
      break;
    }
    case 'endDay':
      endDay();
      break;
    case 'simDays':
      for (let i = 0; i < cmd.count && !isSeasonOver(state); i++) endDay();
      break;
    case 'simToSeasonEnd':
      while (!isSeasonOver(state)) endDay();
      break;
  }

  const minDay = state.currentDay - PBP_DAYS_KEPT;
  return { state, events, pbp: pbp.filter((p) => p.day >= minDay) };
}

/** Recreate a game's play-by-play from its seed (works for any game, since the sim is deterministic). */
export function replayGame(state: UniverseState, gameId: string): GameEvent[] {
  const game = state.schedule.find((g) => g.id === gameId)!;
  return simulateGame(effectiveLeague(state.league, state.weird, game, state.season, RULES), game, state.season).events;
}

const rollInput = (s: UniverseState) => ({
  league: s.league,
  weird: s.weird,
  seed: s.settings.seed,
  season: s.season,
  day: s.currentDay,
  seasonDays: seasonDays(s),
  chaos: s.settings.chaos,
});

/** The Prophet persona's hint: what is gathering tonight (an exact preview of today's roll). */
export function prophecy(s: UniverseState): string | null {
  if (s.persona?.kind !== 'prophet' || isSeasonOver(s)) return null;
  const happenings = rollDay(rollInput(s), RULES);
  if (!happenings.length) return 'The air is still. Nothing strange is gathering tonight.';
  return happenings
    .map((h) => {
      const t = s.league.teams.find((x) => x.id === h.teamId)!;
      return h.eventId === 'death'
        ? `A cold wind blows through the ${t.city} ${t.name} dugout. Someone may not see tomorrow.`
        : `Something strange is gathering around the ${t.city} ${t.name} tonight.`;
    })
    .join(' ');
}
