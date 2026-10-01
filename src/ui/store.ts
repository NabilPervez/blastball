import { create } from 'zustand';
import { simulateGame } from '../engine/game';
import { generateSchedule } from '../engine/season';
import type { GameResult, League, ScheduledGame } from '../engine/types';
import { generateLeague, newSeed } from '../world/generate';

/** Sprint 1: session-only state. Persistence (Dexie) arrives in Sprint 2. */

export type Tab = 'today' | 'games' | 'league' | 'vote' | 'history';

const SEASON_CYCLES = 2;

interface State {
  league: League;
  schedule: ScheduledGame[];
  results: Record<string, GameResult>;
  currentDay: number;
  tab: Tab;
  watchingGameId: string | null;
  setTab(tab: Tab): void;
  newUniverse(seed?: string): void;
  watch(gameId: string | null): void;
  /** Simulate a game (if not already) and record it. */
  playGame(gameId: string): GameResult;
  /** Play every unplayed game on the current day, then move to the next day. */
  playDay(): void;
}

function build(seed: string) {
  const league = generateLeague({ seed });
  return { league, schedule: generateSchedule(league.teams, SEASON_CYCLES), results: {}, currentDay: 1, watchingGameId: null };
}

const initialSeed = () => {
  const fromUrl = new URLSearchParams(location.search).get('seed');
  return fromUrl || newSeed(String(Date.now()));
};

export const lastDay = (schedule: ScheduledGame[]) => schedule.reduce((m, g) => Math.max(m, g.day), 0);

export const useGame = create<State>((set, get) => ({
  ...build(initialSeed()),
  tab: 'today',
  setTab: (tab) => set({ tab, watchingGameId: null }),
  newUniverse: (seed) => set({ ...build(seed?.trim() || newSeed(String(Date.now()))), tab: 'today' }),
  watch: (gameId) => set({ watchingGameId: gameId, tab: gameId ? 'games' : get().tab }),
  playGame: (gameId) => {
    const { league, schedule, results } = get();
    const existing = results[gameId];
    if (existing) return existing;
    const game = schedule.find((g) => g.id === gameId)!;
    const result = simulateGame(league, game);
    set({ results: { ...results, [gameId]: result } });
    return result;
  },
  playDay: () => {
    const { league, schedule, results, currentDay } = get();
    if (currentDay > lastDay(schedule)) return;
    const next = { ...results };
    for (const g of schedule.filter((x) => x.day === currentDay)) {
      if (!next[g.id]) next[g.id] = simulateGame(league, g);
    }
    set({ results: next, currentDay: currentDay + 1 });
  },
}));
