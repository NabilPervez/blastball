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
export const migrations: Record<number, Migration> = {};

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
