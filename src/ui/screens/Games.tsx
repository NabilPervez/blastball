import { useState } from 'react';
import type { ScheduledGame } from '../../engine/types';
import { gamesOn, isSeasonOver, seasonDays, unplayedToday } from '../../world/universe';
import { TeamBadge } from '../components/bits';
import { useGame } from '../store';
import { GameView } from './GameView';

export function GameCard({ game, children }: { game: ScheduledGame; children?: React.ReactNode }) {
  const u = useGame((s) => s.u)!;
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
  return (
    <div className="game-card card">
      <button className="gc-main" onClick={() => watch(game.id)} aria-label={`${away.name} at ${home.name}, ${status}`}>
        {row(away, r?.awayScore)}
        {row(home, r?.homeScore)}
        <span className={`gc-status ${!r && today ? 'live' : ''}`}>{status}</span>
      </button>
      {children}
    </div>
  );
}

/** Next Game / Next Day / Sim 7 days / Until end of season. */
export function TimeControls() {
  const u = useGame((s) => s.u)!;
  const { run, busy } = useGame();
  if (isSeasonOver(u)) return null;
  const remaining = unplayedToday(u).length;
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
          if (confirm('Simulate the rest of the season?')) run({ type: 'simToSeasonEnd' });
        }}
      >
        To season end
      </button>
      {busy && <span className="muted small" role="status">Simulating…</span>}
    </div>
  );
}

export function Games() {
  const u = useGame((s) => s.u)!;
  const watchingGameId = useGame((s) => s.watchingGameId);
  const maxDay = seasonDays(u);
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
            Day {day} <span className="muted">/ {maxDay}</span>
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
