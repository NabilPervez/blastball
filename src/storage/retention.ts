/** Pure retention rules, kept separate from Dexie so they're easy to test. */

export const DAILY_SNAPSHOTS_KEPT = 7;

export interface SnapshotRef {
  id: number;
  season: number;
  day: number;
  kind: 'daily' | 'seasonEnd';
}

/** Keep the newest 7 daily snapshots and every season-end snapshot; return the ids to delete. */
export function snapshotsToPrune(snaps: SnapshotRef[]): number[] {
  const daily = snaps
    .filter((s) => s.kind === 'daily')
    .sort((a, b) => b.season - a.season || b.day - a.day);
  return daily.slice(DAILY_SNAPSHOTS_KEPT).map((s) => s.id);
}

export interface GameRef {
  gameId: string;
  season: number;
  day: number;
  pinned: boolean;
}

/**
 * Play-by-play older than `keepDays` in the current season (or from past seasons) is dropped unless
 * pinned. `extraKept` spares that many of the most recent ones (the Historian's Archive).
 */
export function gamesToPrune(games: GameRef[], season: number, currentDay: number, keepDays: number, extraKept = 0): string[] {
  return games
    .filter((g) => !g.pinned && (g.season < season || g.day < currentDay - keepDays))
    .sort((a, b) => b.season - a.season || b.day - a.day || b.gameId.localeCompare(a.gameId))
    .slice(extraKept)
    .map((g) => g.gameId);
}
