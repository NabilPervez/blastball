import type { GameResult } from './types';

/** Counting stats. Batting and pitching live in one line so any player can do either. */
export interface StatLine {
  g: number; // games appeared
  pa: number;
  ab: number;
  h: number;
  d: number; // doubles
  t: number; // triples
  hr: number;
  r: number;
  bb: number;
  k: number;
  // pitching
  gs: number;
  outs: number;
  ha: number; // hits allowed
  ra: number; // runs allowed
  pk: number; // strikeouts thrown
  pbb: number; // walks allowed
  w: number;
  l: number;
}

export const emptyLine = (): StatLine => ({
  g: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, r: 0, bb: 0, k: 0,
  gs: 0, outs: 0, ha: 0, ra: 0, pk: 0, pbb: 0, w: 0, l: 0,
});

export function addLines(a: StatLine, b: Partial<StatLine>): StatLine {
  const out = { ...a };
  for (const k of Object.keys(b) as (keyof StatLine)[]) out[k] += b[k] ?? 0;
  return out;
}

export type BoxScore = Record<string, StatLine>;

/** Per-player stat lines for one game, derived purely from its events. */
export function boxScore(result: GameResult): BoxScore {
  const box: BoxScore = {};
  const line = (id: string) => (box[id] ??= emptyLine());
  let pitcherId = '';
  for (const e of result.events) {
    switch (e.kind) {
      case 'gameStart':
        for (const id of [e.awayPitcherId, e.homePitcherId]) {
          line(id).g = 1;
          line(id).gs = 1;
        }
        break;
      case 'atBat':
        pitcherId = e.pitcherId;
        line(e.batterId).g = 1;
        line(e.batterId).pa++;
        break;
      case 'walk':
        line(e.batterId).bb++;
        line(e.pitcherId).pbb++;
        break;
      case 'strikeout':
        line(e.batterId).ab++;
        line(e.batterId).k++;
        line(e.pitcherId).pk++;
        line(e.pitcherId).outs++;
        break;
      case 'hit': {
        const b = line(e.batterId);
        b.ab++;
        b.h++;
        if (e.hit === 'double') b.d++;
        if (e.hit === 'triple') b.t++;
        if (e.hit === 'homeRun') b.hr++;
        line(e.pitcherId).ha++;
        break;
      }
      case 'out':
        if (!e.sacrifice) line(e.batterId).ab++;
        line(e.pitcherId).outs++;
        break;
      case 'run':
        line(e.runnerId).r++;
        if (pitcherId) line(pitcherId).ra++;
        break;
      case 'gameEnd': {
        const start = result.events[0];
        if (start.kind === 'gameStart') {
          const winnerIsHome = e.winnerId === result.homeId;
          line(winnerIsHome ? start.homePitcherId : start.awayPitcherId).w = 1;
          line(winnerIsHome ? start.awayPitcherId : start.homePitcherId).l = 1;
        }
        break;
      }
      default:
        break;
    }
  }
  return box;
}

export const avg = (s: StatLine) => (s.ab ? (s.h / s.ab).toFixed(3).replace(/^0/, '') : '.000');
export const era = (s: StatLine) => (s.outs ? ((s.ra * 27) / s.outs).toFixed(2) : '—');
export const inningsPitched = (s: StatLine) => `${Math.floor(s.outs / 3)}.${s.outs % 3}`;
