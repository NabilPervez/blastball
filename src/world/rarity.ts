import type { UniverseState } from './universe';

/** Card rarity reflects a player's story, not their stats. Departed/Returned arrive with death (Sprint 6). */
export type Rarity = 'rookie' | 'veteran' | 'legend';

export const RARITY_LABEL: Record<Rarity, string> = { rookie: 'Rookie', veteran: 'Veteran', legend: 'Legend' };

const VETERAN_GAMES = 60;
const LEGEND_MOMENTS = 8;

export function rarityOf(u: UniverseState, playerId: string): Rarity {
  const moments = u.playerLog[playerId]?.length ?? 0;
  const games = u.careerStats[playerId]?.g ?? 0;
  if (moments >= LEGEND_MOMENTS) return 'legend';
  if (games >= VETERAN_GAMES || moments >= 3) return 'veteran';
  return 'rookie';
}
