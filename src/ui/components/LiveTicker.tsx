import { describeEvent, isBigMoment } from '../../narrative/playByPlay';
import { unplayedToday } from '../../world/universe';
import { useGame } from '../store';
import { BaseDiamond, Outs, TeamBadge } from './bits';

/**
 * "Now playing": today's games stream live, one after another, on every screen.
 * Tap to watch the full play-by-play; pause to stop games playing on their own.
 */
export function LiveTicker() {
  const u = useGame((s) => s.u)!;
  const live = useGame((s) => s.live);
  const enabled = useGame((s) => s.liveEnabled);
  const { setLiveEnabled, watch, tab, watchingGameId } = useGame();

  if (u.phase === 'offseason') return null;
  if (!enabled) {
    if (!unplayedToday(u).length) return null;
    return (
      <div className="live-ticker paused" role="region" aria-label="Live games">
        <span className="muted small">Live games paused.</span>
        <button className="chip" onClick={() => setLiveEnabled(true)}>
          ▶ Resume live games
        </button>
      </div>
    );
  }
  if (!live) return null;
  // Already watching this game full-screen.
  if (tab === 'games' && watchingGameId === live.gameId) return null;

  const game = u.schedule.find((g) => g.id === live.gameId);
  if (!game) return null;
  const away = u.league.teams.find((t) => t.id === game.awayId)!;
  const home = u.league.teams.find((t) => t.id === game.homeId)!;
  const idx = Math.max(0, live.shown - 1);
  const e = live.events[idx];
  const done = live.shown >= live.events.length;
  // Show the latest meaningful play, not every pitch.
  let playIdx = idx;
  while (playIdx > 0 && ['ball', 'calledStrike', 'swingingStrike', 'foul', 'atBat'].includes(live.events[playIdx].kind)) playIdx--;
  const play = live.events[playIdx];
  const remaining = unplayedToday(u).length;

  return (
    <div className={`live-ticker ${isBigMoment(e) ? 'flash' : ''}`} role="region" aria-label={`Now playing: ${away.name} ${e.score.away}, ${home.name} ${e.score.home}`}>
      <button className="lt-main" onClick={() => watch(live.gameId)} aria-label="Watch this game">
        <span className="lt-live">
          <span className="live-dot" aria-hidden="true" /> {done ? 'FINAL' : 'LIVE'}
        </span>
        <span className="lt-score">
          <TeamBadge team={away} size={22} />
          <span className="lt-team">{away.name}</span>
          <strong>{e.score.away}</strong>
          <span className="muted">–</span>
          <strong>{e.score.home}</strong>
          <span className="lt-team">{home.name}</span>
          <TeamBadge team={home} size={22} />
        </span>
        {!done && (
          <span className="lt-state">
            <span className="lt-inning">
              {e.half === 'top' ? '▲' : '▼'}
              {e.inning}
            </span>
            <BaseDiamond bases={e.bases} />
            <Outs outs={e.outs} />
          </span>
        )}
        <span className="lt-play" aria-live="polite">
          {describeEvent(u.league, play, playIdx, game.id)}
        </span>
      </button>
      <span className="lt-actions">
        <span className="muted small">{remaining > 1 ? `${remaining - 1} more today` : 'last game today'}</span>
        <button className="chip" onClick={() => setLiveEnabled(false)} aria-label="Pause live games">
          ❚❚
        </button>
      </span>
    </div>
  );
}
