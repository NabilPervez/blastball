import { expose } from 'comlink';
import { replayGame, runCommand } from '../world/universe';

/** The simulation runs here, off the main thread, so long sims never freeze the UI. */
const api = { runCommand, replayGame };

export type SimApi = typeof api;

expose(api);
