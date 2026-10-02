import type { ModDef } from '../../world/weird';
import { findPlayerMod, findStadiumMod, isActiveMod } from '../../world/weird';
import { RULES, type UniverseState } from '../../world/universe';

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

/** Modifier icons for a card. Each has a text label too, so color/icon is never the only signal. */
export function ModIcons({ mods }: { mods: ShownMod[] }) {
  if (!mods.length) return null;
  return (
    <span className="mod-icons">
      {mods.map((m) => (
        <span key={m.def.id} className="mod-icon" title={`${m.def.name}: ${m.def.description}`} aria-label={`Modifier: ${m.def.name}`}>
          {m.def.icon}
        </span>
      ))}
    </span>
  );
}

export function ModList({ mods, currentDay }: { mods: ShownMod[]; currentDay: number }) {
  if (!mods.length) return <p className="muted small">None.</p>;
  return (
    <ul className="mod-list">
      {mods.map((m) => (
        <li key={m.def.id}>
          <span className="mod-icon" aria-hidden="true">
            {m.def.icon}
          </span>
          <span>
            <strong>{m.def.name}</strong> <span className="muted small">— {m.def.description}</span>
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
