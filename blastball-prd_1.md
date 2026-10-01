# PRD: Blastball — A Solo Absurdist Sports Simulation

| | |
|---|---|
| **Status** | Draft v3 |
| **Platform** | Web (mobile-first, responsive to desktop), installable PWA |
| **Mode** | Single-player, local-first, offline-capable |
| **Backend** | None. Static hosting only |
| **Inspiration** | Blaseball (The Game Band, 2020–2023) |

---

## 0. What changed from v1 (and why)

| Change | Reason |
|---|---|
| Removed all Blaseball names, characters (e.g. "Jessica Telephone"), terms, and the `.blaseball` file extension | Blaseball is The Game Band's IP. "Inspired by" is fine; reusing its names, characters, and lore is not. Everything in this doc is original. |
| Mobile-first instead of desktop-first | You asked for mobile and desktop; the dashboard-heavy v1 layouts don't fit a 380px screen. |
| Added storage-eviction mitigation | iOS Safari can delete site data for sites that aren't installed and haven't been used in ~7 days. A local-only game that silently loses saves is a fatal flaw. |
| Defined how time passes while you're away | v1 promised "while you were gone…" but never said how a local-only world advances when the tab is closed. |
| Defined how the player's vote matters against simulated factions | v1 had one human vote vs. thousands of simulated ones — the player would never matter. |
| Collapsed the 10-package monorepo into one app with clear folders | Overkill for a solo/small build; boundaries are enforced by lint rules instead. |
| Event log uses snapshots + per-season compaction | A pure event log grows unbounded and makes load times slow on phones. |
| Cut local in-browser LLM from the roadmap | Multi-GB model downloads are unrealistic on mobile. Templates by default, optional bring-your-own-key cloud AI later. |
| Commissioner Mode "taints" a save | Keeps Normal Mode meaningful without forbidding sandbox play. |
| Added goals, non-goals, metrics, risks, open questions | Missing in v1. |

---

## 1. Product Summary

A browser game where one player inhabits a persistent, absurd fictional sports league that **plays itself**. The player never controls a game directly. Instead they watch, bet, vote, and occasionally bend reality — and over many seasons the simulation produces emergent stories: rivalries, deaths, resurrections, cursed stadiums, rules nobody asked for.

> You aren't playing the sport. You're a fan living inside a strange sports universe.

## 2. Goals

1. A world that generates stories worth remembering and retelling, with zero writing required from the player.
2. Short, satisfying sessions on mobile (2–5 min) and deep sessions on desktop.
3. Fully playable offline after first load; no account, no server.
4. Saves the player owns: exportable, shareable, durable across app updates.

## 3. Non-Goals (v1)

- Multiplayer, shared worlds, leaderboards, accounts.
- Real money, ads, or any monetization inside the game.
- The player controlling plays (pitching/batting decisions).
- AI-generated content as a required feature.
- Recreating Blaseball's lore, names, or visual identity.

## 4. Target Player

- Fans of sim/management games (OOTP, Football Manager, Dwarf Fortress "story generators").
- Former Blaseball fans who miss the vibe.
- Casual mobile players who like checking in on something living (Tamagotchi-style rhythm).

---

## 5. Core Loop

```
Check in → Read "While You Were Gone" → Watch / skim games
   → Bet coins → Earn or lose coins → Spend coins on votes
   → Election resolves → Rules change → World gets stranger → repeat
```

The **currency → votes** link is the heart of the game. Betting is how you earn influence; influence is how you shape the world.

## 6. Time Model (decision)

The world advances on **two clocks**, and the player picks per-universe:

| Mode | How time passes | Best for |
|---|---|---|
| **Living** (default) | 1 in-game day ≈ 1 real hour. On open, the engine catches up missed days (capped at 7 days of backlog, rest summarized). | Mobile check-ins |
| **Manual** | Time only moves when the player presses advance. | Desktop deep sessions, sandbox |

Catch-up runs in the Web Worker using instant simulation, then produces a **While You Were Gone** digest ranked by narrative importance (deaths, election results, favorite-player events first).

**Day length is adjustable per universe** in Living mode: 15 min, 30 min, 1 hour (default), 4 hours, or 1 real day per in-game day. Changeable anytime in Settings.

Elections happen at fixed points (e.g. end of each in-game week) so the player always has something to come back for.

## 7. Player Influence vs. Simulated Community (decision)

- Simulated factions vote with a **fixed weighted budget** each election.
- The player buys votes with coins. Vote cost rises with each vote bought in the same election (quadratic: n votes cost ~n²).
- Result: a player who saves up and bets well can swing a close election, but can't buy every outcome. This keeps factions meaningful and makes coins precious.
- Factions see only public information (standings, public stats, rules). They never see RNG, hidden attributes, or future events.

Starting factions (renameable, original): **The Statheads, The Loyalists, The Chaos Choir, The Purists, The Lore Divers, The Casuals.** Each has `ideology`, `preferredRules`, `favoriteTeams`, `riskTolerance`, and reacts in news headlines.

## 7a. Your Fan Persona

At universe creation the player picks a fan persona from preset options. It flavors news items and how factions react to them, with small mechanical effects:

| Persona | Flavor | Perk |
|---|---|---|
| **The Diehard** | Loyal to one team through anything | Bonus coins on bets for your team |
| **The Analyst** | Trusts the numbers | Sees one extra hidden stat per player |
| **The Gambler** | Lives for the long shot | Better odds payouts on underdogs |
| **The Prophet** | Senses the strange | Early hints before weird events |
| **The Organizer** | Works the factions | Votes cost slightly less |

The persona is chosen once per universe and named by the player. Factions may mention you in headlines as your influence grows.

## 8. Player Agency Ladder

| Tier | Unlock | Ability |
|---|---|---|
| Observer | Start | Watch, follow players/teams |
| Gambler | Start | Bet on games |
| Voter | First election | Buy votes |
| Patron | Season 2 | Sponsor a team (small stat blessings) |
| Commissioner | Toggle anytime | Direct world editing — **marks save as Commissioner** permanently (badge shown, excluded from any future achievements) |

---

## 9. Simulation Engine

- Pure TypeScript, no DOM/storage dependencies, runs in a Web Worker.
- **Determinism:** seeded PRNG (e.g. `sfc32` or `xoshiro128**`). Each game's seed = `hash(universeSeed, seasonId, gameId)`. `Math.random()` is banned via lint rule. Avoid `Math.sin/exp` etc. in outcome-critical math, since results can differ slightly across JS engines; prefer integer/rational arithmetic.
- Output per game: canonical `GameEvent[]`, final score, stat deltas.
- Same seed + same rules ⇒ same results. This is what makes replays, "What If?", and shared saves possible.

### Sport model (MVP)
Original baseball-like sport called **Blastball**: innings, outs, batting, pitching, baserunning, scoring. Player attributes on a 0–5 star scale across ~8 hidden ratings rolled up into 4 visible star groups.

### Weirdness system
Rules and modifiers are **data, not code**: each has `trigger`, `condition`, `effect`, `duration`. Chaos setting (Normal → Unhinged) scales event frequency. New weird content ships as JSON packs.

### Death & resurrection (decision)
- Death is rare and permanent by default. Expect roughly 1–3 per season at Normal chaos (tunable).
- Departed players join the **Hall of the Departed** and keep their card and history.
- Resurrection is never random. It only happens through an election proposal, which factions vote on, so bringing someone back is a story the player helps write.
- A returned player comes back changed (a new modifier), never exactly as they were.
- At Unhinged chaos, death and return are more frequent.

## 10. State & Persistence

### Architecture
```
Event → Reducer → State
            ↓
      IndexedDB (events + periodic snapshots)
```

- **Snapshot** full state at the end of every in-game day; keep the last 7 daily snapshots and every season-end snapshot.
- **Compaction:** at season end, play-by-play events older than one season are summarized into highlight events; raw play-by-play is dropped unless the player pins a game. World events (deaths, rule changes, elections) are kept forever.
- Library: **Dexie** over raw IndexedDB.

### Stores (simplified)
`universes`, `snapshots`, `worldEvents`, `games` (incl. play-by-play), `settings`. Teams/players/rules live inside snapshots rather than separate stores — fewer moving parts, atomic saves.

### Storage durability (critical on mobile)
1. Call `navigator.storage.persist()` after the first meaningful action.
2. Prompt to **install the PWA** after the first session — installed apps get far stronger storage guarantees on iOS.
3. Gentle **backup reminder** every N in-game weeks: "Export a backup?" with one tap.
4. Show storage used in Settings.

### Save versioning
Every save has `saveVersion` and `engineVersion`. `migrateSave()` runs a chain of pure migration functions (v7→v8→v9…). Each migration has a fixture test using a real old save.

### Export / Import
- Format: gzip-compressed JSON, extension **`.league`** (original).
- Includes seed, snapshots, world events, metadata. Option to include or strip play-by-play (size).
- Import validates schema and version, then migrates.
- Mobile: use the Web Share API to send save files directly.

---

## 11. Narrative Layer

`NarrativeProvider` interface:
- **TemplateProvider** (default, offline): templates selected by event type + player personality + team context + history. ~300 templates at launch.
- **CloudProvider** (later, optional): user supplies their own API key, stored locally only. Generates headlines, recaps, bios. Never writes to world state; output is cached so text stays stable.

Faction reactions appear as short news items so the world feels populated.

---

## 12. Screens (mobile-first)

Bottom tab bar on mobile, left sidebar on desktop.

| Tab | Contents |
|---|---|
| **Today** | While You Were Gone digest, live/next game card, election countdown, coin balance, breaking news |
| **Games** | Schedule, live game view (play-by-play feed + minimal field diagram), speed controls |
| **League** | Standings, teams, players, search |
| **Vote** | Current election, proposals, faction leanings, vote purchase |
| **History** | Season timeline, notable events, pinned games, Hall of the Departed |

Plus: Universe picker (save slots), Settings, Commissioner panel.

### Key UI details
- Live game: text-feed-first (Blaseball's text feed was the magic), with play speed **Live / 2× / 5× / Instant**.
- Time controls: Next Game, Next Day, Until Election, Until Playoffs.
- Player page: status, modifiers as icons, career stats, life timeline.
- Accessibility: `prefers-reduced-motion`, color is never the only signal, 44px touch targets, screen-reader-friendly play-by-play (it's text already — a strength).

## 12a. Visual Identity

**Direction:** modern collectible sports cards. Think a premium baseball card crossed with a modern trading-card game, with subtle parallax depth. Sleek, not retro or cartoonish.

**Palette**
| Role | Color | Use |
|---|---|---|
| Base | Near-black `#0B0B0F` | Backgrounds |
| Surface | Charcoal `#16161D` | Cards, panels |
| Primary | Blast Orange `#FF7A1A` | Actions, live states, highlights |
| Secondary | Ember Yellow `#FFC93C` | Wins, coins, rarity accents |
| Accent | Electric Blue `#2E8BFF` | Info, links, elections, the "strange" |
| Text | Off-white `#F2F2F5` / muted `#9A9AA8` | Body, secondary |

Hex values are starting points to tune for contrast (WCAG AA on black).

**Player cards (the signature element)**
- Every player is a card: portrait area, name, team, position, star ratings, modifier icons, and a rarity frame.
- Rarity frame reflects story, not stats: Rookie → Veteran → Legend → Departed → Returned. Status changes visibly alter the card (Departed cards desaturate, Returned cards gain a blue glow).
- Tap/click flips the card to show career stats and life timeline.
- Card art is procedurally generated (geometric silhouettes + team colors), so it works offline and scales to thousands of players.

**Parallax & motion**
- Cards tilt with pointer (desktop) or device orientation (mobile, opt-in) with 3–4 depth layers: background pattern, portrait, frame, foil sheen.
- Section headers and the Today screen use gentle scroll parallax.
- All motion respects `prefers-reduced-motion` (falls back to static cards with a subtle sheen) and stays on GPU-friendly `transform`/`opacity` only.

**Type**
- Display: a condensed, bold sports face for scores and names.
- Body: a clean sans for the play-by-play feed (readability first).

**Avoid:** copying Pokémon card layouts, energy symbols, or frame designs, and Blaseball's visual style. The *feel* of collecting is the inspiration, not the trade dress.

---

## 13. Universe Creation

Name · Seed (random, editable, shareable) · League size (4/8/12/16) · Chaos level · Season length (20/50/99 games) · Time mode (Living/Manual).

Same seed ⇒ same starting world. "Share your seed" is a free, tiny form of community.

---

## 14. Tech Stack (decision)

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript | Shared types between engine and UI |
| Build | Vite | Fast, simple static output |
| UI | React | Ecosystem, familiarity |
| State | Zustand | Light, works well with worker messages |
| Worker bridge | Comlink | Makes the worker feel like an async function call |
| Storage | Dexie | Sane IndexedDB API, migrations |
| PWA | vite-plugin-pwa (Workbox) | Offline caching, install prompt |
| Tests | Vitest + fast-check | Property tests for determinism |
| Hosting | Any static host (Netlify, Cloudflare Pages) | No backend |

### Repo layout
```
src/
  engine/      # pure sim: rng, game, rules, events (no DOM, no storage)
  world/       # generator: teams, players, stadiums, factions
  narrative/   # templates + provider interface
  storage/     # dexie, snapshots, export/import, migrations
  worker/      # comlink entry for engine
  ui/          # react screens & components
content/       # rule packs, name lists, templates (JSON)
tests/
```
Lint rule: `engine/` may not import from `ui/` or `storage/`.

---

## 15. Roadmap

**MVP 1 — It plays (4–6 wks solo est., a guess)**
8 teams × 13 players, generated names/stats, one season, sim engine, live text feed, standings, team/player pages, autosave, export/import, PWA offline.

**MVP 2 — It's strange**
Coins, betting, elections with factions, modifiers, random events, deaths/resurrections, stadium effects, Living time mode, While You Were Gone, history timeline.

**MVP 3 — It's special**
Patron tier, Commissioner Mode, "What If?" branching from snapshots (branches nest under their parent universe in the picker), faction news, playoffs & multi-season legacy, Hall of the Departed, optional BYOK AI narrative.

**Later / maybe**
Shared rule packs, community seed gallery (static JSON, still no backend), achievements.

---

## 16. Success Metrics (local, privacy-preserving)

No analytics required. If added, opt-in only. Proxies:
- D7 return rate (players who come back after a week).
- Median seasons played per universe.
- % of sessions that include a vote or bet.
- Exports per active universe (are people sharing/backing up?).

## 17. Risks

| Risk | Mitigation |
|---|---|
| Mobile storage eviction | `persist()`, install prompt, backup reminders |
| Sim feels random, not narrative | Weight events toward existing storylines; recurring characters; importance-ranked digests |
| Save size bloat | Snapshots + compaction |
| Determinism breaks across updates | Engine version in save; replays only guaranteed within the same engine major version |
| Too similar to Blaseball | Original names, sport, lore, visual identity; review before launch |
| Living mode catch-up slow on old phones | Instant sim in worker, 7-day cap, progress indicator |

## 18. Decisions Log

1. **Name:** Blastball. Visual identity in §12a.
2. **Living day length:** adjustable per universe (§6).
3. **Fan persona:** chosen from presets (§7a).
4. **Death:** rare and permanent; resurrection only by election (§9).
5. **"What If?" branches:** nested under their parent universe.

## 19. Open Questions

1. Trademark check on "Blastball" before any public launch.
2. Procedural card-art style: geometric, silhouette, or abstract crest?
3. Final persona list and perk balance.
