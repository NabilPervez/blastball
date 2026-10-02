import { useState } from 'react';
import type { Series } from '../../world/seasons';
import { PATRON_BLESSING, PATRON_COST, PATRON_FROM_SEASON, patronError, type UniverseState } from '../../world/universe';
import { useGame } from '../store';
import { TeamBadge } from './bits';

function SeriesRow({ u, s, isFinal }: { u: UniverseState; s: Series; isFinal: boolean }) {
  const team = (id: string) => u.league.teams.find((t) => t.id === id)!;
  const line = (id: string) => (
    <div className={`series-team ${s.winner === id ? 'won' : s.winner ? 'lost' : ''}`}>
      <TeamBadge team={team(id)} size={24} />
      <span className="series-name">{team(id).name}</span>
      <strong>{s.wins[id] ?? 0}</strong>
    </div>
  );
  return (
    <div className="card series">
      <p className="eyebrow">
        {isFinal ? 'Final' : 'Semifinal'} · best of {s.bestOf}
      </p>
      {line(s.highSeed)}
      {line(s.lowSeed)}
    </div>
  );
}

export function Bracket() {
  const u = useGame((s) => s.u)!;
  if (!u.playoffs) return null;
  const champ = u.playoffs.championId && u.league.teams.find((t) => t.id === u.playoffs!.championId);
  return (
    <>
      <h2>Playoffs</h2>
      {champ && (
        <div className="card callout champion">
          <p className="eyebrow">Blastball Cup champions · Season {u.season}</p>
          <p className="display big-ish">
            {champ.city} {champ.name}
          </p>
        </div>
      )}
      <div className="bracket">
        {u.playoffs.series.map((s) => (
          <SeriesRow key={s.id} u={u} s={s} isFinal={s.round === u.playoffs!.finalRound} />
        ))}
      </div>
    </>
  );
}

/** Awards from the season that just finished. */
export function SeasonAwards() {
  const u = useGame((s) => s.u)!;
  const showDetail = useGame((s) => s.showDetail);
  const rec = u.archive.find((a) => a.season === u.season);
  if (!rec || u.phase !== 'offseason') return null;
  const award = (label: string, id: string | null) =>
    id && (
      <button className="card award" onClick={() => showDetail({ kind: 'player', id })}>
        <span className="eyebrow">{label}</span>
        <strong className="display">{u.league.players[id].name}</strong>
        <span className="muted small">{u.league.teams.find((t) => t.id === u.league.players[id].teamId)?.name}</span>
      </button>
    );
  return (
    <>
      <h2>Season {u.season} awards</h2>
      <div className="awards">
        {award('MVP', rec.mvpId)}
        {award('Ace — best pitcher', rec.aceId)}
      </div>
      <p className="muted small">In the offseason everyone ages a year: young players improve, veterans fade, and some retire for rookies.</p>
    </>
  );
}

/** Patron tier: sponsor one team per season from Season 2 (PRD §8). */
export function PatronPanel({ teamId }: { teamId?: string }) {
  const u = useGame((s) => s.u)!;
  const dispatch = useGame((s) => s.dispatch);
  const [pick, setPick] = useState(teamId ?? u.persona?.favoriteTeamId ?? u.league.teams[0].id);
  const target = teamId ?? pick;
  const current = u.patron?.season === u.season ? u.league.teams.find((t) => t.id === u.patron!.teamId) : null;

  if (u.season < PATRON_FROM_SEASON) {
    return teamId ? null : (
      <div className="card pad stack patron locked">
        <p className="eyebrow">Patron · locked</p>
        <p className="muted small">From Season {PATRON_FROM_SEASON} you can sponsor a team for {PATRON_COST} coins: +{PATRON_BLESSING} to all its players' ratings for that season.</p>
      </div>
    );
  }
  if (current) {
    if (teamId && teamId !== current.id) return null;
    return (
      <div className="card pad stack patron">
        <p className="eyebrow">You are Patron</p>
        <p>
          You sponsor the <strong>{current.city} {current.name}</strong> this season (+{PATRON_BLESSING} to every player).
        </p>
      </div>
    );
  }
  const error = patronError(u, target);
  return (
    <div className="card pad stack patron">
      <p className="eyebrow">Become a Patron</p>
      <p className="muted small">
        Sponsor one team for Season {u.season}: +{PATRON_BLESSING} to all its players' ratings. Costs <i className="coin" aria-hidden="true" /> {PATRON_COST}. Once per season.
      </p>
      <div className="row">
        {!teamId && (
          <select className="field" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Team to sponsor">
            {u.league.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.city} {t.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn primary inline" disabled={!!error} onClick={() => dispatch({ type: 'patronSponsored', teamId: target })}>
          Sponsor
        </button>
      </div>
      {error && <p className="small muted">{error}</p>}
    </div>
  );
}
