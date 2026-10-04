# PRD: Blastball — Feature Update 2 ("Deeper Games, Living Stadiums, Fans Who Grow")

| | |
|---|---|
| **Status** | Draft v1 |
| **Builds on** | `blastball-prd_1.md` (v3) and the shipped state through Sprint 9 (partial) + PWA/TWA |
| **Current save version** | v10 (`SAVE_VERSION` in `src/world/universe.ts`) |
| **Sprints** | 11–18, see `SPRINT_PLAN_2.md` |
| **Content** | `content/narrative/templates.json`, `content/weird/environment.json`, `content/personas/personas.json`, `content/achievements/achievements.json`, `content/audio/cues.json` |

---

## 0. Summary

This update makes each game more interesting to watch, makes stadiums feel alive, and gives the player long-term goals. There are 11 workstreams.

| # | Workstream | Type | Sprint |
|---|---|---|---|
| E1 | Richer engine events (steals, errors, double plays, wild pitches, HBP, pickoffs) | Extension | 12 |
| E3 | Pick streaks & slot upgrades | Extension | 14 |
| E4 | Persona evolution + 5 new personas | Extension | 14 |
| E9 | Card binder (collection layer) | Extension | 16 |
| E10 | Narrative templates v2 (~300, context-aware) | Extension | 11 |
| E11 | Stadium environment events, attributed in the game log | Extension | 13 |
| N3 | Achievements | New | 15 |
| N5 | Player stories & journals | New | 16 |
| N6 | Shareable moments | New | 17 |
| N9 | Audio & haptics | New | 18 |

**Why this order.** Narrative v2 comes first because three other workstreams write text through it: environment events, stories, and share captions. Engine v2 comes second because environment events and new pick lines hook into its new event kinds.

---

## 1. Problem Statement

The simulation produces good underlying stories, but three things hide them from the player.

1. **The play-by-play is thin.** There are about 2–3 lines per outcome and no context, so a walk-off home run reads the same as a 9-run blowout homer. The PRD calls the text feed "the magic," and right now it is the weakest layer.
2. **Weirdness is invisible during play.** Stadium mods are static rating deltas applied before the game (`weird.ts` builds a modified league). A player can't point at a moment and say "the tornado did that."
3. **Long-term motivation stops at elections.** Coins buy votes, but nothing tracks mastery, collection, or identity over many seasons. Personas never change after creation.

The cost of not solving this: check-ins become "read the digest, close the app." The PRD's goal of "stories worth retelling" stays unmet.

## 2. Goals

1. **A game the player wants to watch.** Each game produces at least one line a player would screenshot. This is measured as the share rate in §N6.
2. **Visible weirdness.** At Normal chaos or higher, at least 1 in 3 games contains an environment event that visibly changes a play, and the log says so.
3. **Multi-season goals.** Every universe has progress to chase (achievements, binder completion, persona level) that survives season rollover.
4. **No determinism regressions.** Same seed + same rules + same engine version ⇒ identical games. Every new system is pure and seeded.
5. **Still static, offline, and fast.** There is no backend. The total new content payload is under 150 KB gzipped, and catch-up of 7 days stays under 3 s on a mid-range phone.

## 3. Non-Goals

| Non-goal | Why |
|---|---|
| Player-controlled plays | Core identity: the league plays itself. |
| Online leaderboards / cloud achievements | No backend (PRD v3 §3). Achievements are local and travel with the `.league` export. |
| Recorded audio assets / music tracks | Size and licensing. Audio is synthesized (Web Audio). |
| AI-generated stories as a requirement | Templates stay the default. The BYOK provider (Sprint 10 of plan 1) may *rewrite* stories later. |
| Rebalancing betting odds math | Odds stay public-info. New bet types are a separate PRD. |

## 4. Target Users (unchanged) and new stories

- **The Check-in Fan (mobile, 2–5 min):** wants one surprising moment and one reason to come back tomorrow.
- **The Deep Sim Fan (desktop):** wants box scores that mean something, collection completion, and long arcs.
- **The Storyteller:** wants to show other people what happened.

---

## E1. Richer Engine Events

### Problem
`speed` and `defense` currently have narrow effects. There are no stolen bases, errors, or double plays, so a whole category of baseball drama is missing.

### Design
New `GameEvent` kinds in `src/engine/types.ts`:

```ts
| { kind: 'stealAttempt'; runnerId: string; from: 1 | 2; pitcherId: string; success: boolean }
| { kind: 'pickoff'; runnerId: string; base: 1 | 2; pitcherId: string }
| { kind: 'error'; fielderId: string; batterId: string; onKind: OutKind; bases: number }
| { kind: 'doublePlay'; batterId: string; pitcherId: string; runnerOutId: string }
| { kind: 'wildPitch'; pitcherId: string; advanced: string[] }
| { kind: 'hitByPitch'; batterId: string; pitcherId: string }
```

All new events also carry an optional `cause?: CauseRef` field (see E11) so the log can attribute them.

**Probabilities** use integer per-mille math only (no `Math.exp`/`sin`), matching the engine rules in PRD v3 §9.

| Event | When it's checked | Drivers | Target rate (per team-game, Normal chaos) |
|---|---|---|---|
| Steal attempt | Runner on 1st/2nd, next base empty, before each pitch | runner `speed` vs pitcher `control` + catcher `defense` | 0.5–0.8 attempts, ~70% success |
| Pickoff | Same trigger, before the steal check | pitcher `control`, runner `speed` (inverse) | 0.05–0.1 |
| Error | Converts an `out` into reaching base | fielder `defense` (inverse) | 0.4–0.7 |
| Double play | Groundout, runner on 1st, < 2 outs | batter `speed` (inverse), fielding team avg `defense` | 0.6–1.0 |
| Wild pitch | Any ball with runners on base | pitcher `control` (inverse), `stuff` (slight positive) | 0.2–0.4 |
| Hit by pitch | Replaces some balls | pitcher `control` (inverse) | 0.3–0.5 |

**Fielder selection:** the fielding position is picked from `OutKind` plus a seeded draw (groundouts mostly go to infielders, flyouts to outfielders). This gives errors a named fielder.

**Box score additions:** SB, CS, E, GIDP, WP, HBP. Leaderboards (`leaders.ts`) gain SB and Fielding (fewest errors per game, minimum games).

### Determinism & migration (important)
- Bump `ENGINE_VERSION` to 2. Each stored game records the `engineVersion` it was simmed with.
- **Keep the v1 engine frozen** as `src/engine/v1/` (copied once and never edited). Replays of v1 games use v1.
- **Existing saves:** engine v2 activates at the **next season start**, so a season never mixes engines. New universes start on v2. This avoids changing results mid-season, when bets and picks are already placed.
- Save migration v10 → v11 adds `engineVersion` to the universe (default 1) and to stored games.

### Requirements
- **P0:** All six event kinds, box score columns, play-by-play text, v1/v2 coexistence, rates within target bands (tested over 500 seeded games).
- **P0:** Picks gain lines: backed hitter +2 per stolen base, faded hitter +3 if caught stealing or grounded into a DP, faded pitcher +1 per wild pitch.
- **P1:** "Speedster" and "Iron Glove" auto-tags on player cards for leaders in SB and fielding.
- **P2:** Catcher arm as its own hidden rating. This would need a ratings migration, so it is deferred.

### Acceptance criteria
- Given a v10 save mid-season, when it loads on the new build, then every remaining game this season sims identically to the old build (fixture test).
- Given a new universe, when 500 games are simmed, then each new event rate falls within its band.
- Given a v1 game pinned in History, when it is opened, then its play-by-play replays exactly as before.

---

## E3. Pick Streaks & Slot Upgrades

### Problem
Picks pay per game with no memory, so there's no tension in keeping a hot player backed.

### Design
**Streaks (per pick).** Each active pick tracks `streak` = consecutive games in which that pick paid more than 0 coins.

| Streak | Payout multiplier |
|---|---|
| 0–2 | ×1.0 |
| 3–4 | ×1.25 |
| 5–9 | ×1.5 |
| 10+ | ×2.0 (cap) |

- A game where the pick paid 0 resets the streak to 0. Games the player didn't play (off day, injury, relegated) **pause** the streak and don't reset it.
- Removing and re-adding a pick resets its streak. The UI shows a flame with a number and warns before you drop a streaking pick.
- Multipliers apply after the base `PICK_RATES` and are rounded down with integer math.

**Slot upgrades** unlock from **lifetime pick earnings** (`picksLifetime`, which never decreases):

| Lifetime pick coins | Unlock |
|---|---|
| 300 | 5th Back slot |
| 700 | 4th Fade slot |
| 1,500 | 6th Back slot |
| 3,000 | "Lock" — one pick per season can't lose its streak to a single 0-coin game (one grace game) |

### Requirements
- **P0:** Streak tracking, multipliers, pause rules, lifetime tracker, slot unlocks, migration v12 → v13 (`streak: 0`, `picksLifetime` backfilled from History where available, else 0).
- **P1:** "Hot hand" headline in the digest when a streak hits 5 or 10.
- **P2:** Streak-based achievements (already specced in N3).

### Acceptance criteria
- Given a backed hitter with streak 4, when he gets 1 hit (2 coins), then the payout is 2 (×1.25 → 2.5 → floor 2) and the streak becomes 5.
- Given a pick on a team with an off day, when the day ends, then the streak is unchanged.
- Given `picksLifetime` crosses 300, then a 5th Back slot appears with a one-time toast.

---

## E4. Persona Evolution + New Personas

### Problem
The persona is chosen once and never changes. Five options limit replay variety.

### Design
**Devotion XP.** Each persona earns XP from actions that fit its identity, for example a Gambler winning an underdog bet or an Organizer voting on the winning side. XP rules are data, defined in `content/personas/personas.json`.

| Level | XP needed | Unlock |
|---|---|---|
| 1 | 0 | Base perk (current behavior) |
| 2 | 400 | Second perk |
| 3 | 1,200 | Signature ability + a card-frame flourish on your "fan card" in Settings |

The XP rate is tuned so Level 2 takes about 1–1.5 seasons of regular play and Level 3 takes about 3–4 seasons (this is an estimate; tune it in Sprint 14 with the 60-season test harness).

**Existing personas get Level 2 and 3 perks**, for example the Prophet at Level 3 gets a weekly "forecast" of one environment event (E11). See the content file for all of them.

**Five new personas:**

| Persona | Flavor | Base perk |
|---|---|---|
| The Contrarian | Roots against the obvious | Fade payouts +25% |
| The Collector | Needs every card | Binder: new cards also give 3 coins; sees rarity before a player gains it |
| The Storm Chaser | Lives for the weather | Sees today's stadium forecast (E11), +15% on bets in games with active environment |
| The Historian | Remembers everything | Player stories unlock a chapter early; Hall of the Departed resurrection proposals appear 1 week sooner |
| The Hype Squad | Loudest in the stands | Your favorite team gets +2 to all ratings at home games when you watch live (Living mode) |

> **Balance flag:** The Hype Squad's perk changes simulated outcomes, which affects determinism. Watching must be logged as an input event (`watchedLive: gameId`) **before** the game sims, so replays stay exact. If that proves messy, fall back to "+10% bet payouts on favorite-team home games."

**Changing persona:** still once per universe. Exception: a "Rebrand" costs 1,000 coins, resets XP to 0, and logs a timeline event. This gives late-game players variety without making the choice meaningless.

### Requirements
- **P0:** XP engine (pure, `world/persona.ts`), levels, all perks for 10 personas, persona picker update, migration v12 → v13 (`xp: 0, level: 1`).
- **P0:** Every perk is listed in the Guide with locked/unlocked state.
- **P1:** Rebrand.
- **P2:** A Level 4 "Legend" tier.

### Acceptance criteria
- Given a Gambler with 390 XP, when an underdog bet wins, then XP crosses 400, Level 2 unlocks, and a celebratory card appears in the digest.
- Given any persona, when the Guide opens, then all three levels show with locked/unlocked state.

---

## E9. Card Binder

### Problem
Rarity tiers and the card visuals exist, but there is no sense of *owning* or *completing* anything.

### Design
- **Collected** means the player has opened the player's card at least once, **or** picked them, **or** they were on the favorite team. This is stored as a `Set<playerId>` with a first-seen day.
- **Foil** means the player earned at least 50 coins from that player through picks or bets, or you were following them when they got a Legend/Returned status. Foil cards get the existing sheen layer at full strength.
- **Binder screen** (new section under League → Binder):
  - Pages by **team** (current roster + alumni), **season** (everyone who played that season), and **special** (Departed, Returned, MVPs, Aces, Champions).
  - Completion meter per page. Uncollected slots show a silhouette and position only, with no name. That keeps the mystery.
  - Filters: tier, status, foil.
- **Retroactive backfill on migration:** anyone the player picked or favorited in History becomes collected.

### Requirements
- **P0:** Collection state, binder screen with team/season/special pages, completion %, silhouettes, migration v14 → v15.
- **P1:** Foil, the Collector persona hooks.
- **P2:** Export a binder page as an image (shares N6 renderer).

### Acceptance criteria
- Given a player card never opened, when the binder shows that team, then the slot shows a silhouette with a position and no name.
- Given a 16-team, 10-season universe, when the binder opens, then it renders in under 300 ms (virtualized list).

---

## E10. Narrative Templates v2

### Problem
`src/narrative/playByPlay.ts` has inline arrays of about 2–3 lines per outcome with no context.

### Design
Move templates to data: `content/narrative/templates.json`. Each template has:

```json
{ "id": "hr.walkoff.1", "on": "hit.homeRun", "when": { "walkoff": true }, "weight": 3,
  "text": "{b} ends it! A walk-off blast and {t} pour onto the field!" }
```

**Context** (computed once per event, pure):

| Key | Meaning |
|---|---|
| `inning`, `late` (≥ 7th), `extra` (≥ 10th) | Timing |
| `margin` (from batting team's view, before the play), `blowout` (\|margin\| ≥ 6), `close` (\|margin\| ≤ 1) | Score state |
| `walkoff`, `goAhead`, `tying` | Leverage outcomes of this play |
| `rivalry` | The two teams are rivals (`teams.ts`) |
| `mod` | Batter or pitcher has a named active mod (`{mod}` filled with its name) |
| `milestone` | Career milestone hit this play (10th/25th/50th/100th HR, 100th hit, etc.) |
| `count` | `full`, `0-2`, `3-0` |
| `basesLoaded`, `risp` | Base state |
| `favorite` | Involves the player's favorite team |
| `env` | Play was changed by an environment event (E11) |

**Selection:** from all templates for the event kind, keep those whose `when` matches. Pick the **most specific** (most `when` keys) and draw by weight among ties, using the existing seeded `createRng(seed, gameId, 'text', index)`. There is always a no-condition fallback.

**Variables:** `{b}` batter, `{p}` pitcher, `{r}` runner, `{f}` fielder, `{t}` batting team, `{opp}` fielding team, `{stadium}`, `{mod}`, `{env}`, `{n}` milestone number, `{score}`.

**Loader validation** (same pattern as `weird.ts`): unknown `on`, unknown `when` keys, or unknown variables fail on load in dev and in tests.

The content file ships a large starter set covering every event kind, including all of E1's new kinds. The rest of the ~300 target is a content task in Sprint 11.

### Requirements
- **P0:** Data-driven templates, context builder, specificity selection, validation, every event kind covered, an identical-output test for the no-context fallback (old saves read the same unless context applies).
- **P0:** ≥ 300 templates by end of Sprint 11.
- **P1:** "Announcer voices" per stadium. Each stadium picks a voice tag that weights some templates.

### Acceptance criteria
- Given a home run that ends the game in the bottom of the 9th or later, then a `walkoff` template is chosen.
- Given an event with no matching context, then a fallback template is chosen, never an empty string.
- Given the validation test, when a template references `{xyz}`, then the test fails.

---

## E11. Stadium Environment Events (with game-log attribution)

### Problem
Stadium mods are static deltas. The player sees "Tornado Alley: +X power" on a stadium page, but never sees the tornado *do* anything.

### Design
Add a second layer on top of existing stadium mods: **environment events** that fire *during* a plate appearance and **change a specific play**, and the log names the cause.

**Data** (`content/weird/environment.json`) has two parts:

1. **Climates:** each stadium is assigned 1–2 climate tags at creation (`windy`, `coastal`, `haunted`, `volcanic`, `cosmic`, `swampy`, `frigid`, `desert`), seeded from `(seed, 'climate', teamId)`. Relegation's new franchise rolls fresh climates. Climates show on the stadium page.
2. **Environment events:** each has `id`, `name`, `icon`, `climates` (where it can occur; `any` allowed), `requiresStadiumMod` (optional, e.g. only with `tornado-alley`), `minChaos`, `chancePerMille` (per plate appearance), `phase`, `effect`, and three text strings:
   - `announce`: logged when it begins ("A crosswind kicks up off the bay.")
   - `effectText`: logged on the play it changes, attributing it ("The crosswind holds it up — what should've been a flyout drops in for a double.")
   - `fizzle` (optional): logged when it ends without affecting anything.

**Phases & effect types** are kept small so the engine stays readable:

| Phase | Effect types |
|---|---|
| `prePitch` | `forceBall`, `forceStrike`, `wildPitch`, `runnersAdvance`, `pickoff` |
| `onContact` | `upgradeHit`, `downgradeHit`, `outToHit`, `hitToOut`, `induceError`, `homeRunToOut`, `outToHomeRun` |
| `afterPlay` | `extraRun`, `runnerHome`, `runnerRemoved` |

**Engine integration (pure):**
1. Before each PA, the engine checks the stadium's active environment (at most **one active event per half-inning**) with a seeded roll `createRng(gameSeed, 'env', paIndex)`.
2. If one is active, its effect is applied at its phase to the outcome the engine already rolled. **This changes the outcome, not the RNG stream:** the base outcome roll happens first with the same stream as without the environment, then a separate env stream decides whether the event applies. That keeps the effect of environment isolated and testable.
3. Any changed event gets `cause: { type: 'env', id, original: <what would have happened> }`. The play-by-play shows two lines: the normal play line with the `env` context, followed by the `effectText`. Example:

```
🌬 Crosswind — a hard wind kicks up off the bay.
Marisol Okafor lifts a lazy fly ball to left…
🌬 The crosswind holds it up! What should have been a flyout drops for a double.
```

4. Events last for the rest of the half-inning by default (`durationPA` can override), with at most one effect per event unless `maxEffects` is set.

**Chaos scaling:** chance is multiplied by the existing chaos factor (`calm` ×0.4, `normal` ×1, `weird` ×1.8, `unhinged` ×3). Target: about 35% of games at Normal see at least one *effective* environment event.

**Where else it shows:**
- Box score footer: "Environment: Crosswind (changed 1 play)".
- Digest: "The weather won it" headline when an env effect produced the winning run.
- Storm Chaser and Prophet see the stadium **forecast**, which lists events likely today (the stadium's climate list, not a guarantee).
- Achievements (N3): e.g. "Act of God: win a bet decided by an environment effect."

**Betting fairness:** odds stay public-info. Climate tags are public (shown on the stadium page), so the odds model may apply a small (≤ 2%) climate adjustment. Rolled events are never visible before the game.

### Requirements
- **P0:** Climates, ≥ 30 environment events (content ships 32), all 15 effect types, `cause` attribution, two-line log, box-score footer, chaos scaling, determinism tests, migration v11 → v12 (climates assigned to existing stadiums).
- **P1:** Forecast UI, digest headline, odds climate adjustment.
- **P2:** Election proposals that add or remove climates ("Dome the Gloam City Stadium").

### Acceptance criteria
- Given a game simmed twice with the same seed, then environment events and changed plays are identical.
- Given an env effect converted a flyout to a double, then the log shows the play line and an attributed effect line, and the box score footer counts 1 changed play.
- Given Calm chaos over 500 games, then effective-event frequency is below 15% of games; at Unhinged it is above 70%.
- Given a stadium with no matching climate for an event, then that event never fires there.

---

## N3. Achievements

### Design
- Local only. They travel inside `.league` exports. They are per-universe, with a lifetime "trophy shelf" across universes stored in `settings`.
- **Commissioner saves:** achievements stop unlocking once the Commissioner flag is set (PRD v3 §8). Ones already earned stay, marked with the badge.
- Each achievement is data: `id`, `name`, `description`, `category`, `tier` (bronze/silver/gold/platinum), `hidden` (description revealed on unlock), and `check`, a predicate type plus params.
- **Predicate engine** (`world/achievements.ts`, pure): 28 predicate types (`betWon`, `electionSwing`, `pickStreak`, `binderCompletion`, `envDecided`, `seasonsPlayed`, …) evaluated at end of day over that day's world events and current state. **Never** evaluated per pitch, to protect catch-up speed.
- Unlock shows a toast, a digest line, and an entry in History's timeline.
- The content file ships 45 achievements.

### Requirements
- **P0:** Predicate engine, 45 achievements, Achievements screen (under History), toasts, migration v13 → v14, Commissioner lockout.
- **P1:** Trophy shelf across universes; progress bars for countable achievements.
- **P2:** Seasonal "challenge" achievements.

### Acceptance criteria
- Given catch-up of 7 days, then achievement checks add less than 5% to catch-up time.
- Given a hidden achievement, then its description shows "???" until unlocked.
- Given a Commissioner save, then no new achievements unlock and the screen explains why.

---

## N5. Player Stories & Journals

### Design
Every player's life is told as **chapters** in prose, generated from timeline events by templates (`templates.json` → `story` section).

- **Beats** are drawn from events the game already records: debut, first hit/HR/K, milestones, mods gained/lost, combos, rivalry heroics, awards, championships, relegation, death, resurrection, retirement, plus new E1/E11 beats (first steal, environment moment).
- **Chapters:** one per season the player appears in. The title is picked from that season's biggest beat ("The Year of the Glasses"). The chapter is 2–5 sentences long, and the lead sentence uses the biggest beat.
- **Card flip side** gets a "Story" tab next to stats. Departed players get an epilogue; Returned players get "Part Two."
- Story text is generated on demand (deterministic from seed + events), so it is **not stored** and adds nothing to save size. Only pinned/edited stories would be stored (P2).
- The Historian persona unlocks the in-progress chapter (current season) early; everyone else sees it at season end.

### Requirements
- **P0:** Beat extraction, chapter assembly, ≥ 60 story templates, Story tab, epilogues, deterministic output test.
- **P1:** "Notable players" carousel on Today linking to stories.
- **P2:** BYOK AI "rewrite this chapter" (stored when used).

### Acceptance criteria
- Given the same save, when a story is rendered twice, then the text is identical.
- Given a player with no notable beats, then the chapter is still one sensible sentence ("A quiet season at second base for the Foghorns.").

---

## N6. Shareable Moments

### Design
One-tap sharing of an image that looks like the game's card style.

- **Moment types:** a single play (from a play-by-play line, long-press → Share), a final score, a player card (front, or back with story excerpt), an election result, a championship, an achievement unlock.
- **Renderer:** offscreen `<canvas>` at 1080×1350 (portrait, fits most social feeds) using the existing palette and fonts. It runs on the main thread but is lazy-loaded. There are no external requests.
- **Sharing:** Web Share API Level 2 with a `File` where supported; fallback is download PNG plus copy caption.
- **Caption** comes from `templates.json` → `share` section and includes the universe seed so others can play the same world: "Play this league: seed `MOTH-4471`".
- **Privacy:** nothing leaves the device unless the player shares it.

### Requirements
- **P0:** 4 moment types (play, final, card, achievement), renderer, Web Share + fallback, seed in caption.
- **P1:** Election and championship moments; a "Moment of the Week" auto-suggestion in the digest.
- **P2:** Animated share (short WebM).

### Acceptance criteria
- Given iOS Safari installed as a PWA, when Share is tapped on a play, then the share sheet opens with an image and caption.
- Given a browser without file sharing, then a PNG downloads and the caption is copied, with a toast confirming both.
- Given reduced-transparency or high-contrast settings, then the render still meets AA contrast.

---

## N9. Audio & Haptics

### Design
- **Synthesized audio only** (Web Audio API oscillators + noise buffers). This means zero asset downloads, full offline support, and no licensing questions. Cue definitions live in `content/audio/cues.json` as small synth recipes.
- **Cues:** crowd swell (hit, bigger for HR), bat crack, glove pop (strikeout), organ sting (environment event begins), low drone (death), choir pad (resurrection), cash register (bet/pick payout), ballot thunk (vote), fanfare (achievement, championship).
- **Haptics:** `navigator.vibrate` patterns (Android/TWA). iOS Safari doesn't support `vibrate`, so iOS gets audio only. That's a platform limit; don't promise iOS haptics.
- **Defaults:** audio **off** until the player turns it on (first-session prompt during a live game). Haptics follow the same toggle. Respect `prefers-reduced-motion` for haptics, and mute when the page is hidden.
- **Volume** has 3 levels plus mute. A "Big moments only" mode plays HR, walk-off, environment, death, resurrection, and achievement cues only.
- **Speed handling:** at 5× and Instant speeds, only big-moment cues play, with at most one cue per 400 ms.

### Requirements
- **P0:** Audio engine, 11 cues, toggle/volume/big-moments mode, speed throttling, haptics on Android.
- **P1:** Per-stadium crowd "tone" from climate.
- **P2:** Spatialized crowd on desktop.

### Acceptance criteria
- Given audio off (default), then no `AudioContext` is created.
- Given 5× speed, then at most one cue plays per 400 ms.
- Given an iPhone, then the haptics option is hidden instead of shown and broken.

---

## 5. Save Migrations (summary)

| Version | Sprint | Adds |
|---|---|---|
| v10 → v11 | 12 | `engineVersion` on universe + games (default 1); v2 activates next season |
| v11 → v12 | 13 | Stadium `climates` assigned deterministically |
| v12 → v13 | 14 | Pick `streak`, `picksLifetime`, slot unlocks; persona `xp`, `level` |
| v13 → v14 | 15 | `achievements` (per universe), lifetime shelf in settings |
| v14 → v15 | 16 | `collection` (collected/foil sets), backfilled from History |

Each migration needs a fixture save and a test, per the existing convention in `src/storage/migrate.ts`.

## 6. Success Metrics

There is no analytics backend, so measurement uses an **opt-in, local-only stats page** (Settings → "Your stats") and playtests. Targets are hypotheses to check in playtests, not benchmarks.

| Metric | Type | Target |
|---|---|---|
| Games with ≥ 1 context-specific template line | Leading | ≥ 80% |
| Games at Normal chaos with an effective env event | Leading | 30–40% |
| Playtesters who can name a specific play an env event changed after one session | Leading | ≥ 4 of 5 |
| Universes reaching persona Level 2 by end of Season 2 | Lagging | ≥ 60% of playtest saves |
| Shares per 10 sessions (local counter) | Lagging | ≥ 1 |
| 7-day catch-up time on a mid-range Android | Guardrail | ≤ 3 s |
| Determinism suite | Guardrail | 100% pass |

## 7. Risks

| Risk | Mitigation |
|---|---|
| Engine v2 changes results mid-season for existing saves | v2 activates only at season start; v1 frozen for replay |
| Environment events feel random or unfair for bets | Public climates, max 1 event per half-inning, clear attribution |
| Hype Squad perk breaks determinism | Log `watchedLive` as an input before sim, or fall back to a payout perk |
| Template bloat slows load | Lazy-load templates by event kind; budget 60 KB gzipped |
| Audio annoys players | Off by default, big-moments mode, throttling |
| Achievements slow catch-up | End-of-day evaluation only; perf test in DoD |

## 8. Open Questions

1. **(Design, blocking S14)** Is the Hype Squad's outcome-changing perk wanted, or should every perk be economy/info-only?
2. **(Design, non-blocking)** Should foil cards be purely cosmetic, or give a small pick bonus?
3. **(Engineering, blocking S12)** Is a frozen `engine/v1` copy acceptable for repo hygiene, or should v1 behavior live behind a version switch in one file? The recommendation is the copy, since it's safer.
4. **(Content, non-blocking)** Should story chapters use the player's own name for the fan ("Nabil's favorite shortstop…")? This is a fun idea but needs a name field on the persona.
