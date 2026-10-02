/**
 * Living time (PRD §6): one in-game day passes every `dayLengthMinutes` of real time.
 * Pure functions — the current time is always passed in, never read here.
 */

export const DAY_LENGTHS = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 240, label: '4 hours' },
  { minutes: 1440, label: '1 real day' },
] as const;

export type DayLengthMinutes = (typeof DAY_LENGTHS)[number]['minutes'];

/** At most this many missed days are simulated on return; after a week away the league waits for you. */
export const MAX_CATCHUP_DAYS = 7;

export interface Clock {
  /** Real time (ms) at which in-game day `anchorDay` began. */
  anchorMs: number;
  anchorDay: number;
}

const dayMs = (minutes: number) => minutes * 60_000;

/** How many in-game days should have ended by `nowMs`, relative to `currentDay`. */
export function daysDue(clock: Clock, dayLengthMinutes: number, currentDay: number, nowMs: number): number {
  const elapsed = Math.floor((nowMs - clock.anchorMs) / dayMs(dayLengthMinutes));
  return Math.max(0, clock.anchorDay + elapsed - currentDay);
}

export interface CatchUpPlan {
  /** Days to simulate now. */
  simulate: number;
  /** Days that passed beyond the cap (the league paused instead). */
  skipped: number;
  /** Where the clock should be anchored once the simulated days are done. */
  nextClock: (dayAfter: number) => Clock;
}

export function planCatchUp(clock: Clock, dayLengthMinutes: number, currentDay: number, daysLeftInSeason: number, nowMs: number): CatchUpPlan {
  const due = daysDue(clock, dayLengthMinutes, currentDay, nowMs);
  const simulate = Math.min(due, MAX_CATCHUP_DAYS, daysLeftInSeason);
  const skipped = due - simulate;
  return {
    simulate,
    skipped,
    nextClock: (dayAfter) =>
      skipped > 0
        ? // Capped: the league paused. Restart the clock from now.
          { anchorMs: nowMs, anchorDay: dayAfter }
        : // Keep partial progress toward the next day.
          { anchorMs: clock.anchorMs + (dayAfter - clock.anchorDay) * dayMs(dayLengthMinutes), anchorDay: dayAfter },
  };
}

/** Milliseconds until the next in-game day ends. */
export function msUntilNextDay(clock: Clock, dayLengthMinutes: number, currentDay: number, nowMs: number): number {
  const nextBoundary = clock.anchorMs + (currentDay - clock.anchorDay + 1) * dayMs(dayLengthMinutes);
  return Math.max(0, nextBoundary - nowMs);
}

export function formatDuration(ms: number): string {
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
