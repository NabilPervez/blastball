import { useEffect, useMemo, useRef, useState } from 'react';
import { simulateGame } from '../../engine/game';
import { describeEvent, isBigMoment } from '../../narrative/playByPlay';
import { BaseDiamond, Outs, TeamBadge } from '../components/bits';
import { useGame } from '../store';

const SPEEDS = [
  { label: 'Live', ms: 1500 },
  { label: '2×', ms: 750 },
  { label: '5×', ms: 300 },
] as const;

/** Play-by-play events that change the visible situation are shown; pitch-level noise is kept but de-emphasized. */
export function GameView({ gameId }: { gameId: string }) {
  const { league, schedule, results, playGame, watch } = useGame();
  const game = schedule.find((g) => g.id === gameId)!;
  const alreadyPlayed = !!results[gameId];
  // Pure + deterministic, so computing it here gives the same result the store will record.
  const result = useMemo(() => results[gameId] ?? simulateGame(league, game), [league, game, results, gameId]);
  const total = result.events.length;

  const [shown, setShown] = useState(alreadyPlayed ? total : 1);
  const [speed, setSpeed] = useState<number>(SPEEDS[0].ms);
  const [paused, setPaused] = useState(false);
  const done = shown >= total;

  useEffect(() => {
    if (done || paused) return;
    const t = setTimeout(() => setShown((n) => Math.min(n + 1, total)), speed);
    return () => clearTimeout(t);
  }, [shown, done, paused, speed, total]);

  // Record the result once the player has seen the final out.
  const recorded = useRef(alreadyPlayed);
  useEffect(() => {
    if (done && !recorded.current) {
      recorded.current = true;
      playGame(gameId);
    }
  }, [done, gameId, playGame]);

  const away = league.teams.find((t) => t.id === game.awayId)!;
  const home = league.teams.find((t) => t.id === game.homeId)!;
  const current = result.events[shown - 1];
  const feed = result.events.slice(0, shown).map((e, i) => ({ e, i })).reverse();

  return (
    <section className="game-view" aria-label={`${away.name} at ${home.name}`}>
      <button className="link-btn" onClick={() => watch(null)}>
        ← All games
      </button>

      <div className="scoreboard card">
        <div className="sb-team">
          <TeamBadge team={away} size={40} />
          <span className="sb-name">{away.name}</span>
          <span className="sb-score">{current.score.away}</span>
        </div>
        <div className="sb-mid">
          <span className="sb-inning">
            {done ? 'FINAL' : `${current.half === 'top' ? '▲' : '▼'} ${current.inning}`}
          </span>
          {!done && (
            <>
              <BaseDiamond bases={current.bases} />
              <span className="sb-count">
                {current.balls}-{current.strikes} <Outs outs={current.outs} />
              </span>
            </>
          )}
        </div>
        <div className="sb-team">
          <TeamBadge team={home} size={40} />
          <span className="sb-name">{home.name}</span>
          <span className="sb-score">{current.score.home}</span>
        </div>
      </div>

      {!done && (
        <div className="speed-controls" role="group" aria-label="Playback speed">
          <button className="chip" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? '▶ Play' : '❚❚ Pause'}
          </button>
          {SPEEDS.map((s) => (
            <button key={s.label} className="chip" aria-pressed={!paused && speed === s.ms} onClick={() => { setSpeed(s.ms); setPaused(false); }}>
              {s.label}
            </button>
          ))}
          <button className="chip" onClick={() => setShown(total)}>
            Instant
          </button>
        </div>
      )}

      <ol className="feed" aria-live={done ? 'off' : 'polite'} aria-label="Play-by-play">
        {feed.map(({ e, i }) => (
          <li key={i} className={`feed-item ${isBigMoment(e) ? 'big' : ''} k-${e.kind}`}>
            {describeEvent(league, e, i, game.id)}
          </li>
        ))}
      </ol>
    </section>
  );
}
