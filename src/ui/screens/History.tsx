import { useEffect, useState } from 'react';
import { listPinned } from '../../storage/db';
import type { TimelineKind, UniverseState } from '../../world/universe';
import { PlayerCard } from '../components/PlayerCard';
import { useGame } from '../store';

const FILTERS: { id: TimelineKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'election', label: 'Elections' },
  { id: 'death', label: 'Departures' },
  { id: 'return', label: 'Returns' },
  { id: 'weird', label: 'Strange' },
  { id: 'champion', label: 'Champions' },
];

const KIND_MARK: Record<TimelineKind, string> = { election: '✦', death: '✕', return: '◎', weird: '◐', champion: '★' };

function Timeline({ u }: { u: UniverseState }) {
  const [filter, setFilter] = useState<TimelineKind | 'all'>('all');
  const entries = u.timeline.filter((t) => filter === 'all' || t.kind === filter).slice().reverse();
  return (
    <>
      <div className="choice-row" role="group" aria-label="Filter the timeline">
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {entries.length === 0 ? (
        <p className="muted">Nothing here yet. History is made one day at a time.</p>
      ) : (
        <ol className="history-timeline">
          {entries.map((t, i) => (
            <li key={i} className={`ht-${t.kind}`}>
              <span className="ht-mark" aria-hidden="true">
                {KIND_MARK[t.kind]}
              </span>
              <span>
                <span className="muted small">
                  Season {t.season} · Day {t.day}
                </span>
                <span className="ht-text">{t.text}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function PinnedGames({ u }: { u: UniverseState }) {
  const watch = useGame((s) => s.watch);
  const [pinned, setPinned] = useState<{ gameId: string; season: number; day: number }[] | null>(null);
  useEffect(() => {
    listPinned(u.id).then(setPinned);
  }, [u.id, u.currentDay]);
  if (!pinned) return null;
  if (!pinned.length) return <p className="muted small">Pin a game from its play-by-play to keep it forever. Otherwise feeds are kept for 7 days.</p>;
  const name = (id: string) => u.league.teams.find((t) => t.id === id)?.name ?? id;
  return (
    <ul className="card news">
      {pinned.map((p) => {
        const r = u.results[p.gameId];
        const sameSeason = p.season === u.season;
        return (
          <li key={`${p.season}-${p.gameId}`}>
            <span className="muted small">
              Season {p.season} · Day {p.day}
            </span>
            {sameSeason && r ? (
              <button className="link-btn" onClick={() => watch(p.gameId)}>
                {name(r.awayId)} {r.awayScore} – {r.homeScore} {name(r.homeId)} ▶
              </button>
            ) : (
              <span>Game {p.gameId}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function History() {
  const u = useGame((s) => s.u)!;
  const showDetail = useGame((s) => s.showDetail);
  const champions = u.timeline.filter((t) => t.kind === 'champion');
  const departed = u.weird.departed.filter((d) => u.weird.playerStatus[d.playerId] === 'departed');
  return (
    <section>
      <header className="screen-head">
        <h1>History</h1>
      </header>

      {champions.length > 0 && (
        <>
          <h2>Champions</h2>
          <ul className="card news">
            {champions.map((c, i) => (
              <li key={i}>
                <span className="muted small">Season {c.season}</span>
                <strong>{c.text}</strong>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Timeline</h2>
      <Timeline u={u} />

      <h2>Pinned games</h2>
      <PinnedGames u={u} />

      <h2>Hall of the Departed</h2>
      {departed.length === 0 ? (
        <p className="muted">No one has departed{u.weird.departed.length ? ' — everyone who left has come back' : ' yet'}.</p>
      ) : (
        <div className="card-grid">
          {departed.map((d) => (
            <PlayerCard
              key={d.playerId}
              player={u.league.players[d.playerId]}
              team={u.league.teams.find((t) => t.id === d.teamId)!}
              rarity="departed"
              onOpen={() => showDetail({ kind: 'player', id: d.playerId })}
              extra={<span className="muted small">Season {d.season}, day {d.day}</span>}
            />
          ))}
        </div>
      )}
    </section>
  );
}
