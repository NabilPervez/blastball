import { createFactions } from '../world/factions';
import { initialAge } from '../world/seasons';
import { createStadiums } from '../world/weird';
import { SAVE_VERSION, type UniverseState } from '../world/universe';

/** Raised when a save was written by a newer version of the game than this one. */
export class NewerSaveError extends Error {
  constructor(version: number) {
    super(`This save is from a newer version of Blastball (save v${version}, this app reads up to v${SAVE_VERSION}). Update the app first.`);
  }
}

export class InvalidSaveError extends Error {}

type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/**
 * migrations[n] upgrades a save from version n to n+1. Never edit a shipped migration —
 * add a new one and bump SAVE_VERSION. Each needs a fixture test with a real old save.
 */
export const migrations: Record<number, Migration> = {
  // v1 → v2 (Sprint 4): coins, betting, fan persona. Old saves get the starting balance and pick a persona later.
  1: (save) => ({ ...save, coins: 100, bets: [], persona: null, ledger: [] }),
  // v2 → v3 (Sprint 5): factions and elections. The first election opens at the next day's start.
  2: (save) => {
    const settings = save.settings as { seed: string };
    const league = save.league as { teams: { id: string }[] };
    return { ...save, factions: createFactions(settings.seed, league.teams.map((t) => t.id)), elections: [], news: [] };
  },
  // v3 → v4 (Sprint 6): weirdness — modifiers, stadiums, the Departed.
  3: (save) => {
    const settings = save.settings as { seed: string };
    const league = save.league as Parameters<typeof createStadiums>[1];
    return { ...save, weird: { playerStatus: {}, playerMods: {}, stadiums: createStadiums(settings.seed, league), departed: [] } };
  },
  // v4 → v5 (Sprint 7): Living time, permanent timeline, backup reminders.
  // The timeline is backfilled from past elections and the Departed.
  4: (save) => {
    type E = { season: number; closesDay: number; id: number; proposals: { title: string }[]; result: { winner: number; totals: number[] } | null };
    type D = { playerId: string; season: number; day: number; cause: string };
    const players = (save.league as { players: Record<string, { name: string }> }).players;
    const timeline = [
      ...(save.elections as E[])
        .filter((e) => e.result)
        .map((e) => ({ season: e.season, day: e.closesDay, kind: 'election', text: `Election #${e.id}: “${e.proposals[e.result!.winner].title}” wins with ${e.result!.totals[e.result!.winner]} votes.` })),
      ...(save.weird as { departed: D[] }).departed.map((d) => ({ season: d.season, day: d.day, kind: 'death', text: `${players[d.playerId]?.name ?? 'A player'} ${d.cause}` })),
    ].sort((a, b) => a.season - b.season || a.day - b.day);
    return {
      ...save,
      settings: { ...(save.settings as object), dayLengthMinutes: 60 },
      clock: null,
      timeline,
      lastBackupDay: save.currentDay,
    };
  },
  // v5 → v6 (Sprint 8): playoffs, multiple seasons, aging, Patron. A finished season goes
  // straight to the offseason (its playoffs were never played) and rolls into Season 2.
  5: (save) => {
    const players = (save.league as { players: Record<string, unknown> }).players;
    const settings = save.settings as { seasonLength: number };
    const currentDay = save.currentDay as number;
    return {
      ...save,
      phase: currentDay > settings.seasonLength ? 'offseason' : 'regular',
      dayCount: currentDay,
      ages: Object.fromEntries(Object.keys(players).map((id) => [id, initialAge(id)])),
      playoffs: null,
      patron: null,
      archive: [],
      statsBySeason: {},
      bets: (save.bets as object[]).map((b) => ({ ...b, season: 1 })),
    };
  },
};

export function migrateSave(raw: unknown): UniverseState {
  if (!raw || typeof raw !== 'object') throw new InvalidSaveError('Save is empty or not an object.');
  let save = raw as Record<string, unknown>;
  let version = save.saveVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new InvalidSaveError('Save has no valid saveVersion.');
  }
  if (version > SAVE_VERSION) throw new NewerSaveError(version);
  while (version < SAVE_VERSION) {
    const step = migrations[version];
    if (!step) throw new InvalidSaveError(`No migration from save v${version}.`);
    save = { ...step(save), saveVersion: version + 1 };
    version += 1;
  }
  for (const key of ['id', 'settings', 'league', 'schedule', 'results', 'currentDay'] as const) {
    if (!(key in save)) throw new InvalidSaveError(`Save is missing "${key}".`);
  }
  return save as unknown as UniverseState;
}
