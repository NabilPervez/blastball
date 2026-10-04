import { useState } from 'react';
import { ENVIRONMENT } from '../../world/environment';
import { LEVEL_THRESHOLDS, levelOf, perk, PERK_STUBS, PERSONA_DEFS, PERSONA_KINDS, PERSONAS, REBRAND_COST, xpOf, type PersonaKind } from '../../world/persona';
import { abilityError, currentElection, freeBetError, type Ability, type UniverseState } from '../../world/universe';
import { useGame } from '../store';

/** Level, XP bar and the three perks (locked / unlocked) for a persona. */
export function PersonaLevels({ kind, xp, compact = false }: { kind: PersonaKind; xp: number | null; compact?: boolean }) {
  const def = PERSONA_DEFS[kind];
  const level = xp === null ? 0 : levelOf(xp);
  const next = LEVEL_THRESHOLDS[level] ?? null;
  return (
    <div className={`persona-levels ${compact ? 'compact' : ''}`}>
      {xp !== null && (
        <div className="xp-row">
          <span className="small">
            Level <strong>{level}</strong> · {xp} XP{next !== null ? ` / ${next}` : ' · max level'}
          </span>
          <span className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={next ?? xp} aria-valuenow={xp} aria-label="Devotion XP">
            <span style={{ width: `${next ? Math.min(100, (100 * xp) / next) : 100}%` }} />
          </span>
        </div>
      )}
      <ol className="level-list">
        {def.levels.map((l) => {
          const open = xp !== null && l.level <= level;
          return (
            <li key={l.level} className={open ? 'open' : 'locked'}>
              <span className="lvl" aria-label={open ? `Level ${l.level}, unlocked` : `Level ${l.level}, locked`}>
                {open ? '◆' : '🔒'} L{l.level}
              </span>{' '}
              <span className="small">
                {l.perk}
                {l.xpRequired > 0 && <span className="muted"> · {l.xpRequired} XP</span>}
                {PERK_STUBS.has(l.effect.type) && <span className="muted"> · arrives with the card binder update</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const ABILITY_OF: Record<string, Ability> = {
  teamBoostOnce: 'rallyCry', doubleDown: 'doubleDown', envForecast: 'forecast', factionPledge: 'backroomDeal', jinx: 'jinx', addClimate: 'seedClouds', triggerEnv: 'wave',
};

/** Signature abilities the fan has unlocked, with whatever each needs chosen. */
export function PersonaAbilities() {
  const u = useGame((s) => s.u)!;
  const dispatch = useGame((s) => s.dispatch);
  const [target, setTarget] = useState('');
  const [proposal, setProposal] = useState(0);
  const [climate, setClimate] = useState(ENVIRONMENT.climates[0].id);
  if (!u.persona) return null;
  const sig = PERSONA_DEFS[u.persona.kind].levels[2];
  const ability = ABILITY_OF[sig.effect.type];
  const free = perk(u.persona, 'freeBet');
  const lockReady = (u.picksLifetime ?? 0) >= 3000 && u.pickLock?.season !== u.season;
  if (!ability && !free && !lockReady && !forecastToday(u)) return null;
  const unlocked = !!perk(u.persona, sig.effect.type);

  const use = (a: Ability, t?: string, p?: number, c?: string) => dispatch({ type: 'perkUsed', ability: a, target: t, proposal: p, climate: c });
  const err = ability ? abilityError(u, ability, target || undefined, proposal, climate) : null;

  return (
    <div className="card pad stack abilities">
      <p className="eyebrow">Your abilities</p>
      {free && (
        <p className="small">
          🎟 Free bet: {freeBetError(u, '', '', 1)?.startsWith('You already') ? 'used this week.' : `one bet up to ${String(free.max ?? 25)} coins this week, on the house. Tick “free bet” when you bet.`}
        </p>
      )}
      {lockReady && <p className="small">🔐 The Lock is ready: open one of your picks and lock it to protect its streak once this season.</p>}
      {forecastToday(u) && <p className="small prophecy-line">🔮 {u.forecastReveal!.text}</p>}
      {ability && unlocked && (
        <div className="stack">
          <p className="small">
            <strong>{sig.perk.split('.')[0].replace('Signature: ', '')}</strong> — {sig.perk.split('. ').slice(1).join('. ')}
          </p>
          {ability === 'doubleDown' && (
            <select className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">— a winning bet from today —</option>
              {u.bets
                .filter((b) => b.status === 'won' && b.season === u.season && b.day === u.currentDay && !b.doubled)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {u.league.teams.find((t) => t.id === b.teamId)?.name}: won {b.payout}
                  </option>
                ))}
            </select>
          )}
          {ability === 'jinx' && (
            <select className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">— one of your faded players —</option>
              {u.picks.fade.map((id) => (
                <option key={id} value={id}>
                  {u.league.players[id].name}
                </option>
              ))}
            </select>
          )}
          {ability === 'backroomDeal' && (
            <>
              <select className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">— a friendly faction (+3 or better) —</option>
                {u.factions.map((f) => (
                  <option key={f.id} value={f.id} disabled={(u.factionOpinion?.[f.id] ?? 0) < 3}>
                    {f.name} ({u.factionOpinion?.[f.id] ?? 0})
                  </option>
                ))}
              </select>
              <select className="field" value={proposal} onChange={(e) => setProposal(Number(e.target.value))}>
                {(currentElection(u)?.proposals ?? []).map((p, i) => (
                  <option key={i} value={i}>
                    {p.title}
                  </option>
                ))}
              </select>
            </>
          )}
          {ability === 'seedClouds' && (
            <>
              <select className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">— a stadium —</option>
                {u.league.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {u.weird.stadiums[t.id]?.name}
                  </option>
                ))}
              </select>
              <select className="field" value={climate} onChange={(e) => setClimate(e.target.value)}>
                {ENVIRONMENT.climates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <button className="btn inline" disabled={!!err} onClick={() => use(ability, target || undefined, proposal, climate)}>
            Use it
          </button>
          {err && <p className="small muted">{err}</p>}
        </div>
      )}
    </div>
  );
}

const forecastToday = (u: UniverseState) => !!u.forecastReveal && u.forecastReveal.season === u.season && u.forecastReveal.day === u.currentDay;

/** Change persona for coins: XP starts over. */
export function RebrandControl() {
  const u = useGame((s) => s.u)!;
  const dispatch = useGame((s) => s.dispatch);
  const [kind, setKind] = useState<PersonaKind | ''>('');
  if (!u.persona) return null;
  const cant = u.coins < REBRAND_COST ? `Costs ${REBRAND_COST} coins.` : !kind ? 'Choose a persona.' : null;
  return (
    <details className="rebrand">
      <summary className="small">Rebrand ({REBRAND_COST} coins)</summary>
      <p className="small muted">Become a different kind of fan. Your Devotion XP starts over at 0.</p>
      <select className="field" value={kind} onChange={(e) => setKind(e.target.value as PersonaKind)}>
        <option value="">— choose —</option>
        {PERSONA_KINDS.filter((k) => k !== u.persona!.kind).map((k) => (
          <option key={k} value={k}>
            {PERSONAS[k].label}
          </option>
        ))}
      </select>
      <button
        className="btn inline"
        disabled={!!cant}
        onClick={() => kind && window.confirm(`Rebrand as ${PERSONAS[kind].label} for ${REBRAND_COST} coins? Your XP resets to 0.`) && dispatch({ type: 'rebranded', kind })}
      >
        Rebrand
      </button>
      {cant && <span className="small muted"> {cant}</span>}
    </details>
  );
}

export const personaXp = (u: UniverseState) => xpOf(u.persona);
