# Blastball — Sprint Plan

Source: [`blastball-prd_1.md`](blastball-prd_1.md) (PRD Draft v3)
Repo: https://github.com/NabilPervez/blastball
Sprint length: ~1 week each (solo pace estimate — a guess, adjust as we go)

---

## PRD analysis (what drives the plan)

**What the product is:** a single-player, offline, browser-based sports league that plays itself.
The player watches, bets, votes and bends rules; the simulation produces stories.

**Key constraints pulled from the PRD**

| Constraint | Consequence for the plan |
|---|---|
| No backend, static hosting only | Everything runs in the browser. Netlify fits perfectly (see Hosting below). |
| Deterministic simulation (seeded PRNG, no `Math.random`) | The RNG + engine must be built first and covered by tests — every later feature (replays, What If, shared seeds) depends on it. |
| Local-first saves (IndexedDB/Dexie) with versioning and migrations | Save format and `saveVersion` must exist early (Sprint 2) so later sprints migrate rather than break saves. |
| Mobile-first, PWA, offline | App shell is mobile-first from Sprint 1; PWA/offline lands with MVP 1. |
| Rules/modifiers are data, not code | Weirdness system is built as a JSON-driven rule engine, not one-off hacks. |
| Engine may not import UI/storage | Folder layout + lint rule set up in Sprint 1. |

**Roadmap → sprints**

| PRD milestone | Sprints |
|---|---|
| MVP 1 — "It plays" | Sprints 1–3 |
| MVP 2 — "It's strange" | Sprints 4–7 |
| MVP 3 — "It's special" | Sprints 8–10 |
| Later / maybe | Backlog |

### Hosting decision: Netlify ✅

Netlify works with no limitations for this project:
- The app is a static Vite build (`dist/`) — no server, no functions, no database.
- SPA routing handled by a `/* → /index.html` redirect in `netlify.toml`.
- HTTPS by default, which PWAs and `navigator.storage.persist()` require.
- Service workers and Web Workers are served as plain static files — no special config.
- Free tier bandwidth (100 GB/mo) is far beyond what a ~1 MB static game needs.

The only thing to watch: make sure `sw.js` / `index.html` aren't cached aggressively, or users get stuck on old versions. Handled with cache headers in `netlify.toml` (Sprint 3, when the service worker is added).

---

## Universal Definition of Done (applies to every sprint)

- [ ] Code is TypeScript with `strict` on; `npm run typecheck` passes.
- [ ] `npm run lint` passes (including the `Math.random` ban and `engine/` import boundary).
- [ ] `npm test` passes; new logic has tests.
- [ ] `npm run build` succeeds.
- [ ] Works at 375px (phone) and 1280px (desktop) widths.
- [ ] Pushed to `main` on GitHub; Netlify deploy is green and the live URL was checked by hand.
- [ ] Nothing uses Blaseball names, characters, terms or visuals.
- [ ] This file is updated: sprint status, anything moved to a later sprint.

---

## Sprint 1 — Foundation & first playable deploy  *(MVP 1, part 1)*

**Goal:** something you can open on Netlify that generates a league from a seed and lets you watch a game play out in a text feed.

**Scope**
- Vite + React + TypeScript project with the PRD folder layout (`engine/`, `world/`, `narrative/`, `storage/`, `worker/`, `ui/`, `content/`).
- Tooling: ESLint (ban `Math.random`, block `engine/` → `ui/`/`storage/` imports), Vitest.
- Seeded PRNG (`sfc32`) + string hashing for seeds (`hash(universeSeed, seasonId, gameId)`).
- World generator: 8 teams × 13 players, original generated names, 8 hidden ratings → 4 visible star groups.
- Blastball game engine v0: innings, outs, balls/strikes, hits, walks, baserunning, scoring → `GameEvent[]` + final score.
- Narrative v0: template-based play-by-play text.
- UI shell: dark palette from §12a, bottom tab bar (mobile) / sidebar (desktop), tabs Today / Games / League (Vote & History stubbed "coming soon").
- Games tab: a schedule for Day 1, live play-by-play feed with speed controls Live / 2× / 5× / Instant.
- League tab: standings + team rosters with star ratings (basic list, not cards yet).
- "New universe" with editable seed (no persistence yet — refresh = new world unless same seed).
- `netlify.toml` + GitHub repo + first deploy.

**Definition of Done — Sprint 1**
- [ ] Universal DoD met.
- [ ] Opening the Netlify URL shows the app with no console errors.
- [ ] Same seed ⇒ identical league and identical game results (proven by a test).
- [ ] A full 9-inning game simulates to completion with a sensible score (property test over many seeds: game always ends, no negative scores, outs per half-inning = 3 unless walk-off).
- [ ] Watching a game streams play-by-play at each speed; Instant jumps to the final.
- [ ] Standings update after games are played in the session.
- [ ] Bottom tabs on mobile, sidebar on desktop.

---

## Sprint 2 — Full season, persistence & universes  *(MVP 1, part 2)*

**Goal:** a whole season you can come back to after closing the tab.

**Scope**
- Universe creation screen (§13): name, seed, league size (4/8/12/16), season length (20/50/99), chaos level (stored, used later), time mode (Manual for now).
- Season schedule generator (round-robin) and day structure.
- Time controls: Next Game, Next Day, Until end of season.
- Event → reducer → state architecture.
- Dexie DB: `universes`, `snapshots`, `games`, `worldEvents`, `settings`.
- Autosave: end-of-day snapshot, keep last 7 daily + every season-end.
- `saveVersion` / `engineVersion` + `migrateSave()` chain (with first fixture test).
- Universe picker (save slots): create, open, delete (with confirm).

**Definition of Done — Sprint 2**
- [ ] Universal DoD met.
- [ ] Create a universe, play 5 days, close the tab, reopen → exactly where you left off.
- [ ] A 20-game season can be simulated end to end; final standings are consistent with game results (test).
- [ ] Two universes with different seeds coexist and don't affect each other.
- [ ] Snapshot retention rules covered by tests (7 daily + season-end kept).
- [ ] A saved fixture from this sprint loads through `migrateSave()` in a test.

---

## Sprint 3 — Cards, worker, PWA & export  *(MVP 1 complete)*

**Goal:** MVP 1 "It plays" is done — installable, offline, with save export.

**Scope**
- Move simulation into a Web Worker via Comlink; UI stays responsive during Instant/season sims.
- Player cards (§12a): procedural geometric art, star groups, rarity frame (Rookie/Veteran/Legend), tap-to-flip for career stats.
- Team page and player page (career stats, basic life timeline).
- League search.
- PWA: `vite-plugin-pwa`, offline caching, install prompt after first session, `navigator.storage.persist()` after first meaningful action, storage used shown in Settings.
- Export/import `.league` (gzip JSON) with schema + version validation; Web Share API on mobile.
- Settings screen. Cache headers for `sw.js`/`index.html` in `netlify.toml`.

**Definition of Done — Sprint 3**
- [ ] Universal DoD met.
- [ ] Simulating a full 99-game season does not freeze the UI (main thread stays interactive).
- [ ] After first load, the app works in airplane mode (verified on the deployed site).
- [ ] App can be installed to a phone home screen.
- [ ] Export → delete universe → import gives an identical universe (round-trip test).
- [ ] Importing a corrupt or newer-version file shows a clear error and changes nothing.
- [ ] Lighthouse PWA/accessibility checks show no critical failures.
- [ ] Cards respect `prefers-reduced-motion`; touch targets ≥ 44px.

---

## Sprint 4 — Coins, betting & fan persona  *(MVP 2, part 1)*

**Goal:** the player has skin in the game.

**Scope**
- Coin balance and ledger (as world events).
- Pre-game odds derived from public info only; bet placement and payout.
- Fan persona selection at universe creation (§7a) and perks: Diehard, Analyst, Gambler, Prophet (hook only), Organizer (hook only).
- Today tab v1: coin balance, next game card, recent results.

**Definition of Done — Sprint 4**
- [ ] Universal DoD met.
- [ ] Coins can never go negative; bets lock at game start (tests).
- [ ] Odds and payouts are deterministic for a given seed.
- [ ] Each persona's perk has a test proving its effect.
- [ ] Old (Sprint 2/3) saves migrate and get a starting coin balance.

---

## Sprint 5 — Elections & factions  *(MVP 2, part 2)*

**Goal:** coins turn into influence; the world's rules can change.

**Scope**
- Weekly elections at fixed points; proposal generation.
- Six factions (§7) with ideology, preferred rules, favorite teams, risk tolerance, fixed weighted vote budgets using public info only.
- Quadratic vote pricing (n votes ≈ n² coins), Organizer discount.
- Vote tab: proposals, faction leanings, vote purchase, results.
- Election results applied as world events.

**Definition of Done — Sprint 5**
- [ ] Universal DoD met.
- [ ] Vote cost is quadratic (test); player cannot outvote the total faction budget in a typical election (simulation test).
- [ ] A well-saved player can swing a close election (scenario test).
- [ ] Factions never read hidden attributes or RNG (enforced by the type they receive).
- [ ] Election outcome is visible on Today and persists across reloads.

---

## Sprint 6 — Weirdness: rules, modifiers, death  *(MVP 2, part 3)*

**Goal:** the world gets strange.

**Scope**
- Data-driven rule/modifier engine: `trigger`, `condition`, `effect`, `duration`, loaded from JSON packs in `content/`.
- Chaos level scaling (Normal → Unhinged).
- Random events, player modifiers (shown as icons), stadium effects.
- Death (rare, permanent) → Hall of the Departed list; resurrection only via election proposal; returned players get a new modifier.
- Prophet persona early hints.

**Definition of Done — Sprint 6**
- [ ] Universal DoD met.
- [ ] New rules can be added by JSON only — demonstrated with at least one rule added without engine code changes.
- [ ] Deaths per season at Normal chaos average 1–3 over many seeds (statistical test).
- [ ] Resurrection never happens outside an election (test).
- [ ] Determinism still holds with all weirdness enabled.

---

## Sprint 7 — Living time, While You Were Gone, history  *(MVP 2 complete)*

**Goal:** a world that keeps living while you're away.

**Scope**
- Living time mode with adjustable day length (15m/30m/1h/4h/1 day), changeable in Settings.
- Catch-up on open (cap 7 days of backlog, rest summarized) in the worker with a progress indicator.
- While You Were Gone digest ranked by narrative importance.
- History tab: season timeline, notable events, pinned games.
- Per-season compaction of play-by-play.
- Backup reminder every N in-game weeks.

**Definition of Done — Sprint 7**
- [ ] Universal DoD met.
- [ ] Closing the app for X hours and reopening advances the right number of days (test with mocked clock).
- [ ] Catch-up of 7 days completes in under 3s on a mid-range phone (measured on deployed site).
- [ ] Digest puts deaths/elections/favorite-team events first (test).
- [ ] Save size after a full season stays under an agreed budget (e.g. 5 MB) thanks to compaction.

---

## Sprint 8 — Playoffs, multi-season & Patron  *(MVP 3, part 1)*

**Scope**
- Playoffs and season rollover (aging, rookies, retirements, rarity progression to Veteran/Legend).
- Multi-season legacy stats.
- Patron tier (unlocks Season 2): sponsor a team for small stat blessings.
- Hall of the Departed screen with full cards.

**Definition of Done — Sprint 8**
- [ ] Universal DoD met.
- [ ] Three consecutive seasons simulate without errors; save loads after each.
- [ ] Patron unlocks only from Season 2 (test).
- [ ] Departed cards desaturate; Returned cards glow.

---

## Sprint 9 — Commissioner Mode & What If?  *(MVP 3, part 2)*

**Scope**
- Commissioner panel: direct world editing; permanently marks the save (badge).
- "What If?" branching from any kept snapshot; branches nested under parent in the picker.
- Faction news items reacting to events and to the player's persona.

**Definition of Done — Sprint 9**
- [ ] Universal DoD met.
- [ ] Commissioner flag cannot be removed, survives export/import (test).
- [ ] A branch from a snapshot replays identically to the original until the point of divergence (test).
- [ ] Deleting a parent universe clearly handles its branches (confirm dialog).

---

## Sprint 10 — Polish, parallax & launch prep  *(MVP 3 complete)*

**Scope**
- Card parallax/tilt (pointer + opt-in device orientation), foil sheen, scroll parallax on Today.
- ~300 narrative templates.
- Optional BYOK cloud narrative provider (key stored locally only, output cached).
- Accessibility audit, performance pass, originality review vs. Blaseball, trademark check on "Blastball" (PRD open question #1).

**Definition of Done — Sprint 10**
- [ ] Universal DoD met.
- [ ] Lighthouse: Performance ≥ 90 mobile, Accessibility ≥ 95.
- [ ] All motion disabled under `prefers-reduced-motion`.
- [ ] BYOK key never leaves the device except to the chosen AI provider (reviewed).
- [ ] Open questions in PRD §19 resolved or explicitly deferred.

---

## Backlog (Later / maybe)
- Shared rule packs, community seed gallery (static JSON), achievements.

## Open questions carried from the PRD
1. Trademark check on "Blastball" (before public launch — Sprint 10).
2. Card-art style: geometric, silhouette, or abstract crest? (needed by Sprint 3 — defaulting to geometric).
3. Final persona list and perk balance (needed by Sprint 4).

---

## Status

| Sprint | Status |
|---|---|
| 1 | ✅ Done — live at https://blastball-sim.netlify.app/ |
| 2 | ✅ Done — saves, universes, full season, time controls. Simulation already runs in a Web Worker (pulled forward from Sprint 3). Multi-day sims snapshot once at the end of the command, not every day. |
| 3–10 | Not started |
