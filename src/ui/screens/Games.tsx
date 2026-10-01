import { useState } from 'react';
import type { ScheduledGame } from '../../engine/types';
import { TeamBadge } from '../components/bits';
import { lastDay, useGame } from '../store';
import { GameView } from './GameView';

export function GameCard({ game }: { game: ScheduledGame }) {
  const { league, results, watch } = useGame();
  const away = league.teams.find((t) => t.id === game.awayId)!;
  const home = league.teams.find((t) => t.id === game.homeId)!;
  const r = results[game.id];
  const winner = r ? (r.homeScore > r.awayScore ? home.id : away.id) : null;
  const row = (team: typeof away, score: number | undefined) => (
    <div className={`gc-row ${winner === team.id ? 'won' : ''}`}>
      <TeamBadge team={team} size={28} />
      <span className="gc-name">
        {team.city} <strong>{team.name}</strong>
      </span>
      <span className="gc-score">{score ?? ''}</span>
    </div>
  );
  return (
    <button className="game-card card" onClick={() => watch(game.id)} aria-label={`${away.name} at ${home.name}${r ? ', final' : ', watch'}`}>
      {row(away, r?.awayScore)}
      {row(home, r?.homeScore)}
      <span className={`gc-status ${r ? '' : 'live'}`}>{r ? (r.innings > 9 ? `Final/${r.innings}` : 'Final') : 'Watch ▶'}</span>
    </button>
  );
}

export function Games() {
  const { schedule, currentDay, watchingGameId, playDay } = useGame();
  const maxDay = lastDay(schedule);
  const [day, setDay] = useState(Math.min(currentDay, maxDay));

  if (watchingGameId) return <GameView key={watchingGameId} gameId={watchingGameId} />;

  const games = schedule.filter((g) => g.day === day);
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
        </div>
      </header>
      {day > currentDay && <p className="muted">Upcoming — these games haven't happened yet.</p>}
      <div className="game-grid">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
      {day === currentDay && (
        <button className="btn primary" onClick={() => { playDay(); setDay((d) => Math.min(maxDay, d + 1)); }}>
          Sim rest of day {day}
        </button>
      )}
    </section>
  );
}
