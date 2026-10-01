import { createRng } from '../engine/rng';
import type { GameEvent, League } from '../engine/types';

/** Template-based play-by-play text (TemplateProvider v0). Deterministic per event index. */

const HIT_TEXT = {
  single: ['{b} slaps a single into the outfield.', '{b} pokes a single through the gap.', '{b} bloops one in for a single.'],
  double: ['{b} rips a double down the line!', '{b} splits the gap — that\'s a double.', '{b} hammers it off the wall for two.'],
  triple: ['{b} legs out a triple!', '{b} sends it to the deepest corner and slides into third!'],
  homeRun: ['{b} launches it out of here! HOME RUN!', '{b} sends one into orbit. Gone!', 'BLAST! {b} clears the fence!'],
} as const;

const OUT_TEXT = {
  groundout: ['{b} grounds out.', '{b} chops one to the infield and is thrown out.'],
  flyout: ['{b} flies out to the outfield.', '{b} lifts a lazy fly ball. Caught.'],
  lineout: ['{b} lines out. Right at someone.', '{b} smokes a liner — snagged!'],
  popout: ['{b} pops up. Easy out.', '{b} skies one straight up. Caught.'],
} as const;

const ordinal = (n: number) => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th');

export function describeEvent(league: League, e: GameEvent, index: number, gameId: string): string {
  const rng = createRng(league.seed, gameId, 'text', index);
  const name = (id: string) => league.players[id]?.name ?? 'Someone';
  const team = (id: string) => {
    const t = league.teams.find((x) => x.id === id);
    return t ? `${t.city} ${t.name}` : 'Somebody';
  };
  const fill = (tpl: string, b: string) => tpl.replace('{b}', b);
  const count = `${e.balls}-${e.strikes}`;

  switch (e.kind) {
    case 'gameStart':
      return `Play ball! ${name(e.awayPitcherId)} and ${name(e.homePitcherId)} take the mound.`;
    case 'halfStart':
      return `${e.half === 'top' ? 'Top' : 'Bottom'} of the ${ordinal(e.inning)}, ${team(e.battingTeamId)} batting.`;
    case 'atBat':
      return `${name(e.batterId)} steps up to bat.`;
    case 'ball':
      return `Ball. ${count}.`;
    case 'calledStrike':
      return `Strike, looking. ${count}.`;
    case 'swingingStrike':
      return `Strike, swinging. ${count}.`;
    case 'foul':
      return `Foul ball. ${count}.`;
    case 'walk':
      return `${name(e.batterId)} draws a walk.`;
    case 'strikeout':
      return e.swinging ? `${name(e.batterId)} strikes out swinging.` : `${name(e.batterId)} strikes out looking.`;
    case 'hit':
      return fill(rng.pick(HIT_TEXT[e.hit]), name(e.batterId));
    case 'out':
      return fill(rng.pick(OUT_TEXT[e.out]), name(e.batterId)) + (e.sacrifice ? ' The runner tags up.' : '');
    case 'run':
      return `${name(e.runnerId)} scores! ${e.score.away}-${e.score.home}.`;
    case 'halfEnd':
      return `End of the ${e.half} of the ${ordinal(e.inning)}.`;
    case 'gameEnd':
      return `Game over. ${team(e.winnerId)} win ${Math.max(e.score.away, e.score.home)}-${Math.min(e.score.away, e.score.home)}.`;
  }
}

/** Events worth highlighting in the feed. */
export function isBigMoment(e: GameEvent): boolean {
  return e.kind === 'run' || e.kind === 'gameEnd' || (e.kind === 'hit' && e.hit === 'homeRun');
}
