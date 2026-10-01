import { useState } from 'react';
import { computeStandings } from '../../engine/season';
import { gamesOn, isSeasonOver, seasonDays } from '../../world/universe';
import { InstallBanner } from '../components/InstallBanner';
import { useGame } from '../store';
import { GameCard, TimeControls } from './Games';

export function Today() {
  const u = useGame((s) => s.u)!;
  const [copied, setCopied] = useState(false);
  const maxDay = seasonDays(u);
  const over = isSeasonOver(u);
  const todays = gamesOn(u, u.currentDay);
  const yesterday = gamesOn(u, u.currentDay - 1);
  const leader = computeStandings(u.league.teams, Object.values(u.results))[0];
  const leaderTeam = u.league.teams.find((t) => t.id === leader.teamId)!;

  const shareLink = `${location.origin}/?seed=${encodeURIComponent(u.settings.seed)}`;
  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the seed is still visible */
    }
  };

  return (
    <section>
      <header className="screen-head hero">
        <p className="eyebrow">{u.settings.name}</p>
        <h1 className="display big">{over ? 'Season complete' : `Day ${u.currentDay}`}</h1>
        <p className="muted">
          Season {u.season} · {maxDay} days · seed <code>{u.settings.seed}</code>{' '}
          <button className="link-btn" onClick={copySeed}>
            {copied ? 'Link copied!' : 'Share seed'}
          </button>
        </p>
      </header>

      <InstallBanner ready={u.currentDay > 1} />

      {over ? (
        <div className="card callout">
          <p className="eyebrow">Champions</p>
          <p className="display big-ish">
            {leaderTeam.city} {leaderTeam.name}
          </p>
          <p className="muted">
            {leader.wins}–{leader.losses}. Playoffs and new seasons arrive in a later sprint.
          </p>
        </div>
      ) : (
        <>
          <h2>Today's games</h2>
          <div className="game-grid">
            {todays.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
          <TimeControls />
        </>
      )}

      {yesterday.length > 0 && (
        <>
          <h2>{over ? 'Final day' : "Yesterday's results"}</h2>
          <div className="game-grid">
            {yesterday.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <section>
      <header className="screen-head">
        <h1>{title}</h1>
      </header>
      <div className="card coming-soon">
        <p className="eyebrow">Coming soon</p>
        <p>{blurb}</p>
      </div>
    </section>
  );
}
