import { create } from 'zustand';
import type { GameEvent } from '../engine/types';
import * as store from '../storage/db';
import { sim } from '../worker/client';
import { requestPersistenceOnce } from './pwa';
import type { Persona } from '../world/persona';
import { createUniverse, reduce, type Command, type UniverseSettings, type UniverseState, type WorldEvent } from '../world/universe';

export type Tab = 'today' | 'games' | 'league' | 'vote' | 'history' | 'settings';
export type View = 'loading' | 'picker' | 'create' | 'app';

const LAST_UNIVERSE = 'lastUniverseId';

interface State {
  view: View;
  universes: store.UniverseMeta[];
  u: UniverseState | null;
  tab: Tab;
  watchingGameId: string | null;
  /** Team / player detail pages inside the League tab. */
  detail: { kind: 'team' | 'player'; id: string } | null;
  busy: boolean;
  error: string | null;
  /** Seed prefilled on the create screen (e.g. from a shared ?seed= link). */
  pendingSeed: string | null;

  init(): Promise<void>;
  showPicker(): Promise<void>;
  showCreate(seed?: string): void;
  createUniverse(settings: UniverseSettings, persona: Persona): Promise<void>;
  openUniverse(id: string): Promise<void>;
  deleteUniverse(id: string): Promise<void>;
  setTab(tab: Tab): void;
  showDetail(detail: State['detail']): void;
  run(cmd: Command): Promise<void>;
  /** Apply a single player-driven event (bets, watching…) and save it. */
  dispatch(event: WorldEvent): Promise<void>;
  watch(gameId: string | null): Promise<void>;
  playByPlay(gameId: string): Promise<GameEvent[]>;
  clearError(): void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useGame = create<State>((set, get) => ({
  view: 'loading',
  universes: [],
  u: null,
  tab: 'today',
  watchingGameId: null,
  detail: null,
  busy: false,
  error: null,
  pendingSeed: null,

  init: async () => {
    try {
      const seed = new URLSearchParams(location.search).get('seed');
      if (seed) {
        history.replaceState(null, '', location.pathname);
        set({ universes: await store.listUniverses() });
        get().showCreate(seed);
        return;
      }
      const last = await store.getSetting<string>(LAST_UNIVERSE);
      const u = last ? await store.loadUniverse(last) : null;
      if (u) set({ u, view: 'app' });
      else await get().showPicker();
    } catch (e) {
      set({ error: message(e) });
      await get().showPicker();
    }
  },

  showPicker: async () => {
    set({ universes: await store.listUniverses(), view: 'picker', watchingGameId: null, detail: null });
  },

  showCreate: (seed) => set({ view: 'create', pendingSeed: seed ?? null }),

  createUniverse: async (settings, persona) => {
    const u = createUniverse(crypto.randomUUID(), settings, Date.now(), persona);
    await store.saveUniverse(u);
    await store.setSetting(LAST_UNIVERSE, u.id);
    set({ u, view: 'app', tab: 'today', watchingGameId: null, detail: null });
  },

  openUniverse: async (id) => {
    try {
      const u = await store.loadUniverse(id);
      if (!u) throw new Error('That universe no longer exists.');
      await store.setSetting(LAST_UNIVERSE, id);
      set({ u, view: 'app', tab: 'today', watchingGameId: null, detail: null });
    } catch (e) {
      set({ error: message(e) });
    }
  },

  deleteUniverse: async (id) => {
    await store.deleteUniverse(id);
    if (get().u?.id === id) set({ u: null });
    await get().showPicker();
  },

  setTab: (tab) => set({ tab, watchingGameId: null, detail: null }),
  showDetail: (detail) => set({ detail, tab: 'league', watchingGameId: null }),

  run: async (cmd) => {
    const { u, busy } = get();
    if (!u || busy) return;
    set({ busy: true });
    try {
      const result = await sim().runCommand(u, cmd);
      await store.persistCommand(u, result);
      set({ u: result.state });
      void requestPersistenceOnce();
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },

  dispatch: async (event) => {
    const { u } = get();
    if (!u) return;
    const next = reduce(u, event);
    if (next === u) return;
    set({ u: next });
    try {
      await store.appendEvent(next, event);
    } catch (e) {
      set({ error: message(e) });
    }
  },

  watch: async (gameId) => {
    set({ watchingGameId: gameId, tab: gameId ? 'games' : get().tab, detail: null });
    const u = get().u;
    if (gameId && u && !u.results[gameId]) await get().dispatch({ type: 'gameStarted', gameId });
  },

  playByPlay: async (gameId) => {
    const u = get().u!;
    return (await store.loadPlayByPlay(u.id, u.season, gameId)) ?? (await sim().replayGame(u, gameId));
  },

  clearError: () => set({ error: null }),
}));
