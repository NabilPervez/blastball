import type { Team } from '../../engine/types';
import { PERSONAS, type Persona, type PersonaKind } from '../../world/persona';

/** Controlled persona form, used on universe creation and for saves made before personas existed. */
export function PersonaPicker({ value, onChange, teams }: { value: Persona; onChange(p: Persona): void; teams: Team[] }) {
  const set = (p: Partial<Persona>) => onChange({ ...value, ...p });
  return (
    <div className="persona-picker">
      <fieldset className="choice">
        <legend>Your fan persona</legend>
        <div className="persona-grid">
          {(Object.keys(PERSONAS) as PersonaKind[]).map((k) => (
            <button type="button" key={k} className="persona-option card" aria-pressed={value.kind === k} onClick={() => set({ kind: k })}>
              <strong className="display">{PERSONAS[k].label}</strong>
              <span className="muted small">{PERSONAS[k].flavor}</span>
              <span className="small perk">{PERSONAS[k].perk}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Your fan name
        <input className="field" value={value.fanName} maxLength={32} onChange={(e) => set({ fanName: e.target.value })} placeholder="e.g. Section 12 Sam" />
      </label>
      <label>
        Favorite team {value.kind === 'diehard' ? <span className="muted small">(required for the Diehard bonus)</span> : <span className="muted small">(optional)</span>}
        <select className="field" value={value.favoriteTeamId ?? ''} onChange={(e) => set({ favoriteTeamId: e.target.value || null })}>
          <option value="">— none —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.city} {t.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export const personaReady = (p: Persona) => p.fanName.trim().length > 0 && (p.kind !== 'diehard' || !!p.favoriteTeamId);
