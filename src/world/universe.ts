import { addLines, boxScore, emptyLine, type BoxScore, type StatLine } from '../engine/boxScore';
import { ENGINE_VERSION, simulateGame } from '../engine/game';
import { generateSchedule } from '../engine/season';
import type { GameEvent, League, ScheduledGame } from '../engine/types';
import { generateLeague } from './generate';

/**
 * A universe is one save: settings + league + season progress. All changes go through
 * `reduce(state, event)`, so the same events always produce the same state.
 */

export const SAVE_VERSION = 1;

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
}

export type WorldEvent =
  | { type: 'gameStarted'; gameId: string }
  | { type: 'gamePlayed'; summary: GameSummary; box: BoxScore }
  | { type: 'dayEnded'; day: number };

export function createUniverse(id: string, settings: UniverseSettings, now: number): UniverseState {
  const league = generateLeague({ seed: settings.seed, name: settings.name, teamCount: settings.leagueSize });
  return {
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
  };
}

export const seasonDays = (s: UniverseState) => s.settings.seasonLength;
export const isSeasonOver = (s: UniverseState) => s.currentDay > seasonDays(s);
export const gamesOn = (s: UniverseState, day: number) => s.schedule.filter((g) => g.day === day);
export const unplayedToday = (s: UniverseState) => gamesOn(s, s.currentDay).filter((g) => !s.results[g.id]);

/** Story-worthy notes for a player's life timeline, from one game's box score. */
function notesFor(line: StatLine, career: StatLine | undefined): string[] {
  const notes: string[] = [];
  if (line.hr > 0 && !(career?.hr)) notes.push('Hit their first career home run.');
  if (line.hr >= 2) notes.push(`Hit ${line.hr} home runs in one game.`);
  if (line.h >= 4) notes.push(`Went ${line.h}-for-${line.ab}.`);
  if (line.pk >= 10) notes.push(`Struck out ${line.pk} batters.`);
  if (line.gs && line.w && line.ra === 0 && line.outs >= 27) notes.push('Threw a shutout.');
  return notes;
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
      return { ...state, results: { ...state.results, [summary.gameId]: summary }, seasonStats, careerStats, playerLog };
    }

    case 'dayEnded':
      if (event.day !== state.currentDay) return state;
      return { ...state, currentDay: state.currentDay + 1 };
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
    const result = simulateGame(state.league, game, state.season);
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
  return simulateGame(state.league, game, state.season).events;
}
