import { useMemo, useState } from 'react';
import { PersonaPicker, personaReady } from '../components/PersonaPicker';
import type { Persona } from '../../world/persona';
import { generateLeague, newSeed } from '../../world/generate';
import { LEAGUE_SIZES, SEASON_LENGTHS, type ChaosLevel, type UniverseSettings } from '../../world/universe';
import { useGame } from '../store';

const freshSeed = () => newSeed(`${Date.now()}-${crypto.randomUUID()}`);

export function Picker() {
  const { universes, openUniverse, deleteUniverse, showCreate, u } = useGame();
  return (
    <main className="solo">
      <p className="eyebrow">Blastball</p>
      <h1 className="display big">Your universes</h1>
      <p className="muted">Each universe is its own league with its own history, saved on this device.</p>
      <button className="btn primary" onClick={() => showCreate()}>
        + New universe
      </button>
      {universes.length === 0 ? (
        <p className="muted">No universes yet. Create one to begin.</p>
      ) : (
        <ul className="universe-list">
          {universes.map((m) => (
            <li key={m.id} className="card universe-row">
              <button className="universe-open" onClick={() => openUniverse(m.id)}>
                <strong className="display">{m.name}</strong>
                <span className="muted small">
                  Season {m.season} · Day {m.currentDay} · seed {m.seed} · saved {new Date(m.updatedAt).toLocaleString()}
                  {u?.id === m.id ? ' · open' : ''}
                </span>
              </button>
              <button
                className="chip danger"
                aria-label={`Delete ${m.name}`}
                onClick={() => {
                  if (confirm(`Delete "${m.name}" forever? This can't be undone. Export it first if you want a backup.`)) deleteUniverse(m.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const CHAOS: { id: ChaosLevel; label: string }[] = [
  { id: 'calm', label: 'Calm' },
  { id: 'normal', label: 'Normal' },
  { id: 'weird', label: 'Weird' },
  { id: 'unhinged', label: 'Unhinged' },
];

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange(v: T): void }) {
  return (
    <fieldset className="choice">
      <legend>{label}</legend>
      <div className="choice-row">
        {options.map((o) => (
          <button type="button" key={String(o.id)} className="chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function CreateUniverse() {
  const { createUniverse, showPicker, pendingSeed, universes } = useGame();
  const [s, setS] = useState<UniverseSettings>(() => ({
    name: 'The Blastball League',
    seed: pendingSeed ?? freshSeed(),
    leagueSize: 8,
    seasonLength: 20,
    chaos: 'normal',
    timeMode: 'manual',
  }));
  const patch = (p: Partial<UniverseSettings>) => setS((prev) => ({ ...prev, ...p }));
  const [persona, setPersona] = useState<Persona>({ kind: 'diehard', fanName: '', favoriteTeamId: null });
  // Preview the teams this seed will create, so the player can pick a favorite.
  const teams = useMemo(() => generateLeague({ seed: s.seed.trim() || 'x', teamCount: s.leagueSize }).teams, [s.seed, s.leagueSize]);
  const validFavorite = persona.favoriteTeamId && teams.some((t) => t.id === persona.favoriteTeamId) ? persona.favoriteTeamId : null;
  const finalPersona = { ...persona, favoriteTeamId: validFavorite, fanName: persona.fanName.trim() };

  return (
    <main className="solo">
      <p className="eyebrow">New universe</p>
      <h1 className="display big">Build a league</h1>
      <form
        className="create-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!personaReady(finalPersona)) return;
          createUniverse({ ...s, name: s.name.trim() || 'The Blastball League', seed: s.seed.trim() || freshSeed() }, finalPersona);
        }}
      >
        <label>
          League name
          <input value={s.name} maxLength={48} onChange={(e) => patch({ name: e.target.value })} />
        </label>
        <label>
          Seed <span className="muted small">— same seed ⇒ same starting league. Share it with friends.</span>
          <span className="row">
            <input value={s.seed} maxLength={64} onChange={(e) => patch({ seed: e.target.value })} />
            <button type="button" className="btn" onClick={() => patch({ seed: freshSeed() })}>
              Random seed
            </button>
          </span>
        </label>
        <Choice label="Teams" value={s.leagueSize} options={LEAGUE_SIZES.map((n) => ({ id: n, label: String(n) }))} onChange={(leagueSize) => patch({ leagueSize })} />
        <Choice label="Season length (games per team)" value={s.seasonLength} options={SEASON_LENGTHS.map((n) => ({ id: n, label: String(n) }))} onChange={(seasonLength) => patch({ seasonLength })} />
        <Choice label="Chaos" value={s.chaos} options={CHAOS} onChange={(chaos) => patch({ chaos })} />
        <PersonaPicker value={{ ...persona, favoriteTeamId: validFavorite }} onChange={setPersona} teams={teams} />
        <p className="muted small">Chaos takes effect when weirdness arrives (rules, modifiers, the occasional death). Time mode is Manual for now — Living mode arrives later.</p>
        <div className="row">
          <button className="btn primary" type="submit" disabled={!personaReady(finalPersona)}>
            Create universe
          </button>
          {universes.length > 0 && (
            <button className="btn" type="button" onClick={showPicker}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
