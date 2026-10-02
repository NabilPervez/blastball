import type { ModDef } from '../../world/weird';
import { findPlayerMod, findStadiumMod, isActiveMod } from '../../world/weird';
import { RULES, type UniverseState } from '../../world/universe';
import { deltaNote, describeDelta } from '../../world/statHelp';

export interface ShownMod {
  def: ModDef;
  until: { season: number; day: number } | null;
}

export function playerModsOf(u: UniverseState, playerId: string): ShownMod[] {
  return (u.weird.playerMods[playerId] ?? [])
    .filter((m) => isActiveMod(m, u.season, u.currentDay))
    .map((m) => ({ def: findPlayerMod(RULES, m.id)!, until: m.until }))
    .filter((m) => !!m.def);
}

export function stadiumModsOf(u: UniverseState, teamId: string): ShownMod[] {
  return (u.weird.stadiums[teamId]?.mods ?? [])
    .filter((m) => isActiveMod(m, u.season, u.currentDay))
    .map((m) => ({ def: findStadiumMod(RULES, m.id)!, until: m.until }))
    .filter((m) => !!m.def);
}

/** `role` adds a note when a trait changes ratings this kind of player never uses. */
export function ModList({ mods, currentDay, role }: { mods: ShownMod[]; currentDay: number; role?: 'batter' | 'pitcher' }) {
  if (!mods.length) return <p className="muted small">Nothing unusual right now.</p>;
  return (
    <ul className="mod-list">
      {mods.map((m) => (
        <li key={m.def.id}>
          <span className="mod-icon" aria-hidden="true">
            {m.def.icon}
          </span>
          <span>
            <strong>{m.def.name}</strong> <span className="muted small">— {m.def.description}</span>
            {Object.keys(m.def.delta).length > 0 && <span className="small mod-effect"> {describeDelta(m.def.delta)}.</span>}
            {role && deltaNote(m.def.delta, role) && <span className="small mod-note"> {deltaNote(m.def.delta, role)}</span>}
            <span className="muted small">
              {' '}
              {m.until ? `(${Math.max(0, m.until.day - currentDay + 1)} more days)` : '(permanent)'}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
