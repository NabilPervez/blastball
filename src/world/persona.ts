import { createRng } from '../engine/rng';
import type { Player, RatingKey } from '../engine/types';

/** Fan personas (PRD §7a). Chosen once per universe. */
export type PersonaKind = 'diehard' | 'analyst' | 'gambler' | 'prophet' | 'organizer';

export interface Persona {
  kind: PersonaKind;
  fanName: string;
  /** The Diehard's team (others may pick one too, for flavor). */
  favoriteTeamId: string | null;
}

export const PERSONAS: Record<PersonaKind, { label: string; flavor: string; perk: string; available: boolean }> = {
  diehard: { label: 'The Diehard', flavor: 'Loyal to one team through anything.', perk: '+25% bonus coins on winning bets for your team.', available: true },
  analyst: { label: 'The Analyst', flavor: 'Trusts the numbers.', perk: 'Sees one extra hidden stat on every player card.', available: true },
  gambler: { label: 'The Gambler', flavor: 'Lives for the long shot.', perk: '+20% payout odds when betting on underdogs.', available: true },
  prophet: { label: 'The Prophet', flavor: 'Senses the strange.', perk: 'Early hints before weird events (when weirdness arrives).', available: true },
  organizer: { label: 'The Organizer', flavor: 'Works the factions.', perk: 'Votes cost less (when elections arrive).', available: true },
};

export const DIEHARD_BONUS_PCT = 25;
export const GAMBLER_UNDERDOG_PCT = 20;

/** Multiplier offered to this player, after persona perks. `pm` = the backed team's win chance. */
export function personaMultiplier(persona: Persona | null, baseMult: number, pm: number): number {
  if (persona?.kind === 'gambler' && pm < 500) return Math.floor((baseMult * (100 + GAMBLER_UNDERDOG_PCT)) / 100);
  return baseMult;
}

/** Coins returned for a winning bet (stake included), after persona perks. */
export function winningPayout(persona: Persona | null, amount: number, multMilli: number, teamId: string): number {
  const base = Math.floor((amount * multMilli) / 1000);
  if (persona?.kind === 'diehard' && persona.favoriteTeamId === teamId) {
    return base + Math.floor((amount * DIEHARD_BONUS_PCT) / 100);
  }
  return base;
}

const RATING_LABEL: Record<RatingKey, string> = {
  contact: 'Contact', power: 'Power', discipline: 'Discipline', velocity: 'Velocity',
  control: 'Control', stuff: 'Stuff', speed: 'Speed', defense: 'Glove',
};

/** The Analyst's extra hidden stat for a player: one of the ratings rolled up inside the stars. */
export function analystReveal(player: Player): { label: string; value: number } {
  const keys: RatingKey[] = player.role === 'pitcher' ? ['velocity', 'control', 'stuff'] : ['contact', 'power', 'discipline'];
  const key = createRng(player.id, 'analyst').pick(keys);
  return { label: RATING_LABEL[key], value: player.ratings[key] };
}
