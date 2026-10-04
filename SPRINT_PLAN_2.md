# Blastball — Sprint Plan 2 (Feature Update 2)

Spec: `blastball-prd_2.md`. This plan continues from `SPRINT_PLAN.md`, where Sprint 9 (rest) and Sprint 10 remain open.

**How this relates to the open sprints:**
- Sprint 10's "~300 narrative templates" item **moves into Sprint 11 here**. Sprint 10 keeps parallax, BYOK, accessibility/perf audit, and trademark check.
- Commissioner Mode (Sprint 9 rest) must ship **before or with Sprint 15**, because achievements depend on the Commissioner flag. If Commissioner slips, Sprint 15 ships with a stub flag that is always `false`, plus a test.

## Dependency map

```
S11 Narrative v2 ──┬──> S13 Environment events ──> S15 Achievements
S12 Engine v2 ─────┘            │                         │
        └──> S14 Streaks + Personas ──────────────────────┤
                                                          v
                    S16 Binder + Stories ──> S17 Shareable moments ──> S18 Audio & haptics
```

## Universal Definition of Done (unchanged from Plan 1, plus three additions)

Everything in Plan 1's Universal DoD still applies (tests green, lint clean including the `Math.random` ban and engine import boundary, deployed to Netlify, works offline, mobile 380px layout checked, Guide updated, status table updated). **Added for this plan:**

- [ ] **Determinism:** the seeded replay suite passes. Any new randomness uses `createRng` with a unique label.
- [ ] **Catch-up budget:** a 7-day catch-up for a 16-team league runs in ≤ 3 s in the Node perf test (and is checked once on a real mid-range Android per sprint that touches the sim).
- [ ] **Content validation:** every JSON content file loads through its validator in tests. Unknown ids, keys, or template variables fail the build.

---

## Sprint 11 — Narrative Templates v2  *(E10)*

**Scope**
- Move play-by-play text from `src/narrative/playByPlay.ts` to `content/narrative/templates.json`.
- Context builder (`narrative/context.ts`, pure): inning, late/extra, margin/close/blowout, walkoff/goAhead/tying, rivalry, mod, milestone, count, basesLoaded/risp, favorite, env.
- Specificity-first selection with seeded weighted ties. Always fall back to a no-condition template.
- Template validator (unknown `on`, `when` keys, variables).
- Grow content to ≥ 300 templates (the starter file ships the base; the rest is writing).
- Lazy-load by event-kind group.

**Definition of Done — Sprint 11**
- [ ] Universal DoD met.
- [x] Every current `GameEvent` kind has ≥ 3 fallback templates, and the E1 kinds have templates ready (unused until S12).
- [x] ≥ 300 templates total (338: 284 play-by-play, 40 story, 8 chapter titles, 6 share); validator test passes.
- [x] Test: a walk-off HR chooses a `walkoff` template; a blowout HR chooses a `blowout` or fallback template.
- [x] Test: same game rendered twice produces identical text.
- [x] Templates add ≤ 60 KB gzipped to the build (measured: the whole file is 8.6 KB gzipped; only `playByPlay` is bundled, about 6.6 KB).
- [ ] Spot check: 5 random games read aloud by Nabil — no repeated line within any single game's first 30 plays. *(Automated proxy passes: a test over 200 games, with every player holding a mod, allows ≤ 2% of games a repeat; measured 1 in 200. The read-aloud is still yours.)*

**Sprint 11 notes**
- **Specificity is weighted, not a plain key count.** With a plain count, a generic `late + close` line beat the walk-off line. Weights: `walkoff`/`milestone` 4, `env` 3, `goAhead`/`tying`/`basesLoaded` 2, other keys 1 (also written in the content file's `notes`).
- **No repeats within a game.** A game's lines are chosen in order and skip templates the game already used until that pool runs out (cached per game). Before this, 43 of 200 games repeated a line in their first 30 plays.
- **Flavor lines are throttled.** `mod` and `favorite` apply to about 1 in 4 routine plays (always on game start/end, triples and home runs); otherwise nearly every at-bat said "(Cursed) digs in."
- **Not yet wired:** `milestone` (needs career totals while rendering) and `env` (Sprint 13) are always false. `{f}` on outs is a fielder of the right kind picked by the text (engine v1 names none) until Sprint 12's fielder selection.
- **Lazy-loading by event-kind group was skipped:** the play-by-play section is 6.6 KB gzipped, so splitting it would add async loading to every text line for no real saving. Story and share sections are not in the bundle yet.

---

## Sprint 12 — Engine v2: Richer Events  *(E1)*

**Scope**
- Freeze the current engine as `src/engine/v1/` (copy, never edit). Add `ENGINE_VERSION = 2`.
- New event kinds: stealAttempt, pickoff, error, doublePlay, wildPitch, hitByPitch, with the `cause?` field reserved for S13.
- Fielder selection for outs and errors.
- Box score: SB, CS, E, GIDP, WP, HBP. Leaderboards: SB and fielding.
- New pick lines (backed SB, faded CS/GIDP, faded pitcher WP).
- Save v10 → v11: `engineVersion` on universe and stored games; v2 activates at next season start for existing saves.

**Definition of Done — Sprint 12**
- [ ] Universal DoD met.
- [x] Fixture test: a v10 mid-season save sims the rest of its season identically to the old build (scores and every stat line; fixture captured from the pre-Sprint-12 build).
- [x] Fixture test: a pinned v1 game replays identically (50 games fingerprinted from the pre-Sprint-12 engine; the frozen copy reproduces all 50).
- [x] Rate test over 500 seeded games: every new event falls inside its PRD band.
- [x] Migration v10 → v11 has a fixture save (`tests/fixtures/save-v10.json`) and test.
- [x] New box score columns show on mobile without horizontal page scroll (scroll inside the table only). Checked at 375px in the browser.
- [x] Guide updated: new events, new pick lines (plus the rating tooltips and the pick hint on player pages).

**Sprint 12 notes**
- **Version numbers.** Saves already recorded `engineVersion` 1 or 2, and both run the same code (v2 added batters' arm/eye/bat in an earlier sprint). So the PRD's "engine v2" is **`ENGINE_VERSION = 3`** in code, and the frozen copy is `src/engine/v2/game.ts`, named after its real version. `simulateGame(..., engineVersion)` uses the frozen copy for versions ≤ 2.
- **Switching engines.** A save keeps its engine until its next season starts (`newSeason` sets the current version); new universes start on v3. Migration v10 → v11 keeps `engineVersion` (capped at 2) and fills the new stat columns with 0 in season, career and past-season stats. Stored game rows now record `engineVersion`; older rows have none, which means v2 or older.
- **Tuned rates** (per team-game over 500 games, Normal chaos; PRD band in brackets): steal attempts 0.67 [0.5–0.8] with 73% success [~70%], pickoffs 0.08 [0.05–0.1], errors 0.54 [0.4–0.7], double plays 0.73 [0.6–1.0], wild pitches 0.26 [0.2–0.4], HBP 0.39 [0.3–0.5]. Scoring rose from 4.14 to 4.24 runs per team-game.
- **Engine details.** Pickoff is checked before the steal, before each pitch, for the lead runner with an open base ahead. A third out on the bases ends the inning, and that batter leads off next inning (the unfinished trip doesn't count as a PA). Errors put the batter on first and move every runner up one base. Pickoffs count as CS. Outs in v3 also name the fielder, so play-by-play uses the real one.
- **Not done (P1/P2):** "Speedster" / "Iron Glove" card tags, catcher arm rating.
- **Perf:** 7-day catch-up for 16 teams took 49 ms in Node. Not yet checked on a real Android phone.

**PRD Open Question 1 — answered (2026-10-04):** the Hype Squad perk must **not** change game results directly. Nabil: "not game results, but player stats mods are ok." To confirm at the start of Sprint 14: does a stat mod (a rating boost, which feeds the sim) count as allowed, or only stat-display/economy effects?

---

## Sprint 13 — Stadium Environment Events  *(E11)*

**Scope**
- Climate assignment per stadium (seeded); relegated franchises roll new climates.
- Load and validate `content/weird/environment.json` (32 events, 15 effect types).
- Engine hook: one active environment per half-inning, a separate env RNG stream, effect applied at its phase, `cause` attribution on changed events.
- Two-line attributed log (play line + effect line), plus announce/fizzle lines.
- Box score footer "Environment: X (changed N plays)". Stadium page shows climates.
- Save v11 → v12.
- P1 if time allows: forecast UI, "the weather won it" digest headline, ≤ 2% odds climate adjustment.

**Definition of Done — Sprint 13**
- [ ] Universal DoD met.
- [ ] Determinism test: same seed ⇒ same env events and same changed plays.
- [ ] Isolation test: with environment disabled, games match S12 output exactly (env uses its own stream).
- [ ] Frequency test over 500 games: Calm < 15%, Normal 30–40%, Unhinged > 70% of games with an effective event.
- [ ] Every changed play has an attributed effect line in the log; test asserts no `cause` without text.
- [ ] Climate gating test: an event never fires at a stadium without a matching climate or required stadium mod.
- [ ] Migration v11 → v12 fixture test.
- [ ] Prophet hints include environment where applicable.

---

## Sprint 14 — Pick Streaks, Slots & Persona Evolution  *(E3, E4)*

**Scope**
- Pick streaks: per-pick counter, multipliers (×1 / 1.25 / 1.5 / 2), pause on non-appearance, reset on zero, warn before dropping a streak.
- `picksLifetime` and slot unlocks (5th Back at 300, 4th Fade at 700, 6th Back at 1,500, Lock at 3,000).
- Persona XP rules engine from `content/personas/personas.json`; Levels 1–3; perks for all 10 personas.
- Five new personas in the picker: Contrarian, Collector, Storm Chaser, Historian, Hype Squad. (Collector's binder hooks are stubbed until S16.)
- Resolve PRD Open Question 1 (Hype Squad perk) **before** starting.
- Save v12 → v13.
- P1: Rebrand (1,000 coins).

**Definition of Done — Sprint 14**
- [ ] Universal DoD met.
- [ ] Unit tests for every streak rule in the PRD acceptance criteria (rounding, pause, reset).
- [ ] XP balance run over 60 simulated seasons with a scripted "average player": Level 2 reached in season 1–2, Level 3 in season 3–5. Numbers recorded in this file.
- [ ] Every perk for all 10 personas has a test proving it does something.
- [ ] If Hype Squad changes outcomes: a replay test proves `watchedLive` inputs reproduce the same results.
- [ ] Persona picker fits on a 380px screen with 10 options (scroll or 2-column grid).
- [ ] Migration v12 → v13 fixture test.
- [ ] Guide lists every persona's three levels with locked/unlocked states.

---

## Sprint 15 — Achievements  *(N3)*

**Scope**
- `world/achievements.ts`: predicate engine (28 predicate types), end-of-day evaluation only.
- Load `content/achievements/achievements.json` (45 achievements).
- Achievements screen under History, unlock toasts, digest lines, timeline entries, hidden achievement handling.
- Commissioner lockout (real flag if Sprint 9 Commissioner shipped, otherwise stub).
- Save v13 → v14. Lifetime trophy shelf in settings (P1).

**Definition of Done — Sprint 15**
- [ ] Universal DoD met.
- [ ] Every achievement has a test that unlocks it from a crafted state and one proving it doesn't unlock early.
- [ ] Perf test: achievement checks add < 5% to 7-day catch-up time.
- [ ] Hidden achievements show "???" until unlocked.
- [ ] Commissioner saves unlock nothing new, and the screen says why.
- [ ] Achievements survive export → import (test).
- [ ] Migration v13 → v14 fixture test.

---

## Sprint 16 — Card Binder & Player Stories  *(E9, N5)*

**Scope**
- Collection state (collected + foil, first-seen day), backfilled from History on migration.
- Binder screen: team / season / special pages, completion meters, silhouettes, filters; virtualized.
- Collector persona hooks go live.
- Story beat extraction from timeline events, chapter assembly from the `story` templates, Story tab on the card back, epilogues and "Part Two."
- Historian early-chapter perk.
- Save v14 → v15.

**Definition of Done — Sprint 16**
- [ ] Universal DoD met.
- [ ] Binder renders a 16-team, 10-season universe in < 300 ms (measured on desktop, spot-checked on phone).
- [ ] Silhouette slots never leak a name (test).
- [ ] Story output is deterministic (same save ⇒ same text) and is not stored in the save (save size test unchanged ± 1%).
- [ ] Every story beat type has ≥ 3 templates; a player with zero beats gets a sensible one-line chapter.
- [ ] Departed players show an epilogue; Returned players show "Part Two."
- [ ] Migration v14 → v15 fixture test.

---

## Sprint 17 — Shareable Moments  *(N6)*

**Scope**
- Lazy-loaded canvas renderer, 1080×1350, game palette and fonts, no external requests.
- Moment types: play, final score, player card, achievement (P0); election and championship (P1).
- Web Share API with `File`; fallback: download PNG + copy caption.
- Captions from `templates.json → share`, including the seed.
- P1: "Moment of the Week" suggestion in the digest.

**Definition of Done — Sprint 17**
- [ ] Universal DoD met.
- [ ] Manual check on: iOS Safari installed PWA, Android Chrome / TWA, desktop Chrome. Share sheet or fallback works on each (results recorded here).
- [ ] Renderer is not in the main bundle (checked in build output).
- [ ] Rendered images pass an AA contrast check on text.
- [ ] No network requests during render (verified offline).
- [ ] Caption always includes the universe seed.

---

## Sprint 18 — Audio & Haptics  *(N9)*

**Scope**
- Web Audio synth engine reading `content/audio/cues.json` (11 cues).
- Settings: off by default, 3 volume levels plus mute, "Big moments only" mode; first-session opt-in prompt during a live game.
- Throttle: big moments only at 5× and Instant, max one cue per 400 ms.
- Haptics via `navigator.vibrate` on supported platforms; option hidden where unsupported.
- Mute when the page is hidden.

**Definition of Done — Sprint 18**
- [ ] Universal DoD met.
- [ ] With audio off, no `AudioContext` is ever created (test).
- [ ] Throttle test at 5×.
- [ ] Haptics toggle hidden on iOS, working on the Android TWA (manual check recorded).
- [ ] `prefers-reduced-motion` disables haptics.
- [ ] Audio engine + cues add ≤ 15 KB gzipped.
- [ ] Lighthouse mobile Performance stays ≥ 90 (Plan 1 Sprint 10 bar).

---

## Status

| Sprint | Status |
|---|---|
| 11 — Narrative v2 | ✅ Done (except Nabil's read-aloud spot check) — play-by-play from `content/narrative/templates.json`, pure context builder, weighted-specificity selection, per-game no-repeat, validator. Notes below. |
| 12 — Engine v2 | ✅ Done — engine v3 in code (see notes), frozen v2 engine, six new events in band, new stats/leaders/pick lines, save v11. |
| 13 — Environment events | Not started |
| 14 — Streaks & personas | Not started. Open Question 1 answered (see notes). |
| 15 — Achievements | Not started (needs Commissioner flag or stub) |
| 16 — Binder & stories | Not started |
| 17 — Shareable moments | Not started |
| 18 — Audio & haptics | Not started |
