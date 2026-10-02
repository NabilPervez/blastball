import { create } from 'zustand';
import type { GameEvent } from '../engine/types';
import * as store from '../storage/db';
import { sim } from '../worker/client';
import { requestPersistenceOnce } from './pwa';
import { planCatchUp } from '../world/clock';
import { buildDigest, type Digest } from '../world/digest';
import type { Persona } from '../world/persona';
import { createUniverse, reduce, seasonDays, type Command, type UniverseSettings, type UniverseState, type WorldEvent } from '../world/universe';

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
  /** What happened over the last stretch of simulated days, shown until dismissed. */
  digest: Digest | null;
  /** Living-mode catch-up progress. */
  catchingUp: { done: number; total: number } | null;

  catchUp(): Promise<void>;
  dismissDigest(): void;

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
  /** Play-by-play for a game, or null if it was played long ago and its feed has been archived. */
  playByPlay(gameId: string): Promise<GameEvent[] | null>;
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
  digest: null,
  catchingUp: null,

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
      if (u) {
        set({ u, view: 'app' });
        await get().catchUp();
      }
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
      set({ u, view: 'app', tab: 'today', watchingGameId: null, detail: null, digest: null });
      await get().catchUp();
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
      let next = result.state;
      // In Living mode, advancing by hand restarts the clock from the new day.
      if (next.clock && next.currentDay !== u.currentDay) {
        const ev = { type: 'clockSet' as const, clock: { anchorMs: Date.now(), anchorDay: next.currentDay } };
        next = reduce(next, ev);
        await store.appendEvent(next, ev);
      }
      const multiDay = (cmd.type === 'simDays' && cmd.count > 1) || cmd.type === 'simToSeasonEnd';
      set({ u: next, digest: multiDay ? buildDigest(u, next, result.events) : get().digest });
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
    const saved = await store.loadPlayByPlay(u.id, u.season, gameId);
    if (saved) return saved;
    // Unplayed games can be previewed exactly (deterministic). Played games can't be replayed
    // once elections have changed the league, so their feed is gone after compaction.
    return u.results[gameId] ? null : sim().replayGame(u, gameId);
  },

  catchUp: async () => {
    const start = get().u;
    if (!start?.clock || get().busy || get().catchingUp) return;
    const plan = planCatchUp(start.clock, start.settings.dayLengthMinutes, start.currentDay, Math.max(0, seasonDays(start) - start.currentDay + 1), Date.now());
    if (!plan.simulate && !plan.skipped) return;
    set({ busy: true, catchingUp: plan.simulate ? { done: 0, total: plan.simulate } : null });
    try {
      let u = start;
      const events: WorldEvent[] = [];
      for (let i = 0; i < plan.simulate; i++) {
        const result = await sim().runCommand(u, { type: 'simDays', count: 1 });
        await store.persistCommand(u, result);
        events.push(...result.events);
        u = result.state;
        set({ u, catchingUp: { done: i + 1, total: plan.simulate } });
      }
      const clockEvent = { type: 'clockSet' as const, clock: plan.nextClock(u.currentDay) };
      u = reduce(u, clockEvent);
      await store.appendEvent(u, clockEvent);
      set({ u, digest: plan.simulate ? buildDigest(start, u, events, plan.skipped) : get().digest });
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: false, catchingUp: null });
    }
  },

  dismissDigest: () => set({ digest: null }),

  clearError: () => set({ error: null }),
}));
