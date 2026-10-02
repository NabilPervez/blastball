import { useState } from 'react';
import type { ScheduledGame } from '../../engine/types';
import { betsThisSeason, gamesOn, isSeasonOver, lastScheduledDay, seasonDays, unplayedToday } from '../../world/universe';
import { formatMult } from '../../engine/odds';
import { BetPanel } from '../components/BetPanel';
import { TeamBadge } from '../components/bits';
import { useGame } from '../store';
import { GameView } from './GameView';

export function GameCard({ game }: { game: ScheduledGame }) {
  const u = useGame((s) => s.u)!;
  const [betting, setBetting] = useState(false);
  const watch = useGame((s) => s.watch);
  const away = u.league.teams.find((t) => t.id === game.awayId)!;
  const home = u.league.teams.find((t) => t.id === game.homeId)!;
  const r = u.results[game.id];
  const today = game.day === u.currentDay;
  const started = u.started.includes(game.id);
  const winner = r ? (r.homeScore > r.awayScore ? home.id : away.id) : null;
  const row = (team: typeof away, score: number | undefined) => (
    <div className={`gc-row ${winner === team.id ? 'won' : ''}`}>
      <TeamBadge team={team} size={28} />
      <span className="gc-name">
        <span className="city">{team.city}</span> <strong>{team.name}</strong>
      </span>
      <span className="gc-score">{score ?? ''}</span>
    </div>
  );
  const status = r ? (r.innings > 9 ? `Final/${r.innings}` : 'Final') : today ? (started ? 'In progress ▶' : 'Watch ▶') : `Day ${game.day}`;
  const series = u.playoffs?.series.find((s) => s.games.includes(game.id));
  return (
    <div className="game-card card">
      <button className="gc-main" onClick={() => watch(game.id)} aria-label={`${away.name} at ${home.name}, ${status}`}>
        {row(away, r?.awayScore)}
        {row(home, r?.homeScore)}
        <span className={`gc-status ${!r && today ? 'live' : ''}`}>
          {series && <span className="pill">{series.round === u.playoffs!.finalRound ? 'Final' : 'Semifinal'} · game {series.games.indexOf(game.id) + 1}</span>} {status}
        </span>
      </button>
      <BetLine game={game} betting={betting} setBetting={setBetting} />
    </div>
  );
}

function BetLine({ game, betting, setBetting }: { game: ScheduledGame; betting: boolean; setBetting(b: boolean): void }) {
  const u = useGame((s) => s.u)!;
  const bet = betsThisSeason(u).find((b) => b.gameId === game.id);
  const open = game.day === u.currentDay && !u.results[game.id] && !u.started.includes(game.id);
  const team = bet && u.league.teams.find((t) => t.id === bet.teamId)!;
  if (betting && open) return <BetPanel game={game} onDone={() => setBetting(false)} />;
  return (
    <div className="gc-bet">
      {bet && team && (
        <span className={`bet-tag ${bet.status}`}>
          <i className="coin" aria-hidden="true" /> {bet.amount} on {team.name} @ {formatMult(bet.multMilli)}
          {bet.status === 'won' && <> · won {bet.payout}</>}
          {bet.status === 'lost' && <> · lost</>}
        </span>
      )}
      {open && (
        <button className="chip bet-btn" onClick={() => setBetting(true)} disabled={u.coins < 1}>
          {bet ? 'Add to bet' : 'Bet'}
        </button>
      )}
    </div>
  );
}

/** Next Game / Next Day / Sim 7 days / Until end of season. */
export function TimeControls() {
  const u = useGame((s) => s.u)!;
  const { run, busy } = useGame();
  if (isSeasonOver(u)) {
    return (
      <div className="time-controls" role="group" aria-label="Time controls">
        <button className="btn primary" disabled={busy} onClick={() => run({ type: 'endDay' })}>
          Start Season {u.season + 1} →
        </button>
        {u.clock && <span className="muted small">Living time will start it automatically after one day.</span>}
        {busy && <span className="muted small" role="status">Simulating…</span>}
      </div>
    );
  }
  const remaining = unplayedToday(u).length;
  const playoffs = u.phase === 'playoffs';
  return (
    <div className="time-controls" role="group" aria-label="Time controls">
      <button className="btn primary" disabled={busy} onClick={() => run({ type: 'nextGame' })}>
        {remaining ? 'Next game' : `Start day ${u.currentDay + 1}`}
      </button>
      <button className="btn" disabled={busy} onClick={() => run({ type: 'endDay' })}>
        {remaining ? `Finish day ${u.currentDay}` : 'Next day'}
      </button>
      <button className="btn" disabled={busy} onClick={() => run({ type: 'simDays', count: 7 })}>
        +7 days
      </button>
      <button
        className="btn"
        disabled={busy}
        onClick={() => {
          if (confirm(playoffs ? 'Simulate the rest of the playoffs?' : 'Simulate the rest of the season, including the playoffs?')) run({ type: 'simToSeasonEnd' });
        }}
      >
        {playoffs ? 'To the champion' : 'To season end'}
      </button>
      {busy && <span className="muted small" role="status">Simulating…</span>}
    </div>
  );
}

export function Games() {
  const u = useGame((s) => s.u)!;
  const watchingGameId = useGame((s) => s.watchingGameId);
  const maxDay = Math.max(lastScheduledDay(u), 1);
  const [day, setDay] = useState(Math.min(u.currentDay, maxDay));

  if (watchingGameId) return <GameView key={watchingGameId} gameId={watchingGameId} />;

  const games = gamesOn(u, day);
  return (
    <section>
      <header className="screen-head">
        <h1>Games</h1>
        <div className="day-picker">
          <button className="chip" onClick={() => setDay((d) => Math.max(1, d - 1))} disabled={day <= 1} aria-label="Previous day">
            ‹
          </button>
          <span>
            {day > seasonDays(u) ? `Playoffs · day ${day - seasonDays(u)}` : `Day ${day}`} <span className="muted">/ {seasonDays(u)}</span>
          </span>
          <button className="chip" onClick={() => setDay((d) => Math.min(maxDay, d + 1))} disabled={day >= maxDay} aria-label="Next day">
            ›
          </button>
          {day !== u.currentDay && !isSeasonOver(u) && (
            <button className="chip" onClick={() => setDay(u.currentDay)}>
              Today
            </button>
          )}
        </div>
      </header>
      {day > u.currentDay && <p className="muted">Upcoming — these games haven't happened yet.</p>}
      <div className="game-grid">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
      {day === u.currentDay && <TimeControls />}
    </section>
  );
}
