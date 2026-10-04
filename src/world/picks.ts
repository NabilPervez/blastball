import type { BoxScore } from '../engine/boxScore';
import type { League } from '../engine/types';

/**
 * Player picks: back players you believe in, fade players you expect to struggle.
 * After every game, picks pay out coins based on the box score. Pure and deterministic.
 */

export type PickKind = 'back' | 'fade';

export interface Picks {
  back: string[];
  fade: string[];
}

export const MAX_BACKED = 4;
export const MAX_FADED = 3;

/** Coins per event. */
export const PICK_RATES = {
  backHit: 2, // backed hitter: per hit
  backHomeRun: 4, // backed hitter: bonus per home run
  backStrikeout: 2, // backed pitcher: per strikeout thrown
  fadeStrikeout: 2, // faded hitter: per strikeout
  fadeHitless: 4, // faded hitter: hitless game with 3+ at-bats
  fadeHitAllowed: 1, // faded pitcher: per hit allowed
  fadeRunAllowed: 2, // faded pitcher: per run allowed
  backSteal: 2, // backed hitter: per stolen base
  fadeCaught: 3, // faded hitter: per caught stealing / picked off, or grounded into a double play
  fadeWildPitch: 1, // faded pitcher: per wild pitch
} as const;

export const emptyPicks = (): Picks => ({ back: [], fade: [] });

export interface PickLine {
  playerId: string;
  amount: number;
  why: string;
}

/** What the player's picks earned from one game. */
export function pickPayout(picks: Picks, box: BoxScore, league: League): PickLine[] {
  const lines: PickLine[] = [];
  const add = (playerId: string, amount: number, why: string) => amount > 0 && lines.push({ playerId, amount, why });
  for (const id of picks.back) {
    const s = box[id];
    const p = league.players[id];
    if (!s || !p) continue;
    if (p.role === 'pitcher') add(id, s.pk * PICK_RATES.backStrikeout, `${s.pk} K`);
    else {
      const sb = s.sb ?? 0;
      const why = [`${s.h} H`, s.hr ? `${s.hr} HR` : '', sb ? `${sb} SB` : ''].filter(Boolean).join(', ');
      add(id, s.h * PICK_RATES.backHit + s.hr * PICK_RATES.backHomeRun + sb * PICK_RATES.backSteal, why);
    }
  }
  for (const id of picks.fade) {
    const s = box[id];
    const p = league.players[id];
    if (!s || !p) continue;
    if (p.role === 'pitcher') {
      const wp = s.wp ?? 0;
      add(id, s.ha * PICK_RATES.fadeHitAllowed + s.ra * PICK_RATES.fadeRunAllowed + wp * PICK_RATES.fadeWildPitch, `${s.ha} H, ${s.ra} R allowed${wp ? `, ${wp} WP` : ''}`);
    } else {
      const hitless = s.ab >= 3 && s.h === 0;
      const caught = (s.cs ?? 0) + (s.gidp ?? 0);
      const why = [hitless ? `0-for-${s.ab}` : '', `${s.k} K`, s.cs ? `${s.cs} CS` : '', s.gidp ? `${s.gidp} GIDP` : ''].filter(Boolean).join(', ');
      add(id, s.k * PICK_RATES.fadeStrikeout + (hitless ? PICK_RATES.fadeHitless : 0) + caught * PICK_RATES.fadeCaught, why);
    }
  }
  return lines;
}

export const pickOf = (picks: Picks, playerId: string): PickKind | null =>
  picks.back.includes(playerId) ? 'back' : picks.fade.includes(playerId) ? 'fade' : null;
