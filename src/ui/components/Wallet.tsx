import { useState } from 'react';
import { formatMult } from '../../engine/odds';
import { PERSONAS, type Persona } from '../../world/persona';
import { useGame } from '../store';
import { PersonaPicker, personaReady } from './PersonaPicker';
import { FavoriteTeamControl } from './FanFeatures';

export function CoinBadge() {
  const coins = useGame((s) => s.u?.coins ?? 0);
  return (
    <span className="coin-badge" aria-label={`${coins} coins`}>
      <i className="coin" aria-hidden="true" /> <strong>{coins}</strong>
    </span>
  );
}

/** For saves created before personas existed. */
export function ChoosePersona() {
  const u = useGame((s) => s.u)!;
  const dispatch = useGame((s) => s.dispatch);
  const [p, setP] = useState<Persona>({ kind: 'diehard', fanName: '', favoriteTeamId: null });
  if (u.persona) return null;
  const final = { ...p, fanName: p.fanName.trim() };
  return (
    <form
      className="card pad stack persona-prompt"
      onSubmit={(e) => {
        e.preventDefault();
        if (personaReady(final)) dispatch({ type: 'personaChosen', persona: final });
      }}
    >
      <p className="eyebrow">New: fan personas</p>
      <p>Pick who you are in this universe. You choose once — it flavors the world and gives you a perk.</p>
      <PersonaPicker value={p} onChange={setP} teams={u.league.teams} />
      <button className="btn primary inline" type="submit" disabled={!personaReady(final)}>
        Become {PERSONAS[p.kind].label}
      </button>
    </form>
  );
}

export function FanCard() {
  const u = useGame((s) => s.u)!;
  if (!u.persona) return null;
  const fav = u.persona.favoriteTeamId ? u.league.teams.find((t) => t.id === u.persona!.favoriteTeamId) : null;
  const settled = u.bets.filter((b) => b.status !== 'open');
  const wins = settled.filter((b) => b.status === 'won').length;
  const net = settled.reduce((s, b) => s + b.payout - b.amount, 0);
  return (
    <div className="card fan-card">
      <div>
        <p className="eyebrow">{PERSONAS[u.persona.kind].label}</p>
        <p className="display fan-name">{u.persona.fanName}</p>
        <p className="muted small">
          {fav ? `${fav.city} ${fav.name} fan · ` : ''}
          {PERSONAS[u.persona.kind].perk}
        </p>
        <FavoriteTeamControl />
      </div>
      <div className="fan-stats">
        <span>
          <strong className="display coins-big"><i className="coin" aria-hidden="true" /> {u.coins}</strong>
          <span className="muted small">coins</span>
        </span>
        <span>
          <strong>
            {wins}/{settled.length}
          </strong>
          <span className="muted small">bets won</span>
        </span>
        <span>
          <strong className={net > 0 ? 'pos' : net < 0 ? 'neg' : ''}>{net > 0 ? `+${net}` : net}</strong>
          <span className="muted small">net</span>
        </span>
      </div>
    </div>
  );
}

export function OpenBets() {
  const u = useGame((s) => s.u)!;
  const open = u.bets.filter((b) => b.status === 'open' && b.season === u.season);
  if (!open.length) return null;
  return (
    <>
      <h2>Your open bets</h2>
      <ul className="card bet-list">
        {open.map((b) => {
          const t = u.league.teams.find((x) => x.id === b.teamId)!;
          return (
            <li key={b.id}>
              <span>
                <i className="coin" aria-hidden="true" /> {b.amount} on <strong>{t.name}</strong>
              </span>
              <span className="muted small">
                {formatMult(b.multMilli)} · pays {Math.floor((b.amount * b.multMilli) / 1000)}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function Ledger() {
  const u = useGame((s) => s.u)!;
  const recent = u.ledger.slice(-6).reverse();
  if (!recent.length) return null;
  return (
    <>
      <h2>Coin activity</h2>
      <ul className="card bet-list">
        {recent.map((e, i) => (
          <li key={i}>
            <span>{e.reason}</span>
            <span className={e.amount > 0 ? 'pos' : 'neg'}>
              {e.amount > 0 ? '+' : ''}
              {e.amount} <span className="muted small">· day {e.day}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
