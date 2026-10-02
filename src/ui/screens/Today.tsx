import { useState } from 'react';
import { gamesOn, isSeasonOver, prophecy, seasonDays, standingsOf } from '../../world/universe';
import { ElectionCard } from '../components/ElectionCard';
import { InstallBanner } from '../components/InstallBanner';
import { Bracket, PatronPanel, SeasonAwards } from '../components/SeasonBits';
import { ChecklistCard } from '../components/Onboarding';
import { PicksPanel } from '../components/FanFeatures';
import { BackupReminder, LivingClock, WhileYouWereGone } from '../components/TimeBits';
import { NewsFeed } from './Vote';
import { ChoosePersona, FanCard, Ledger, OpenBets } from '../components/Wallet';
import { useGame } from '../store';
import { GameCard, TimeControls } from './Games';

export function Today() {
  const u = useGame((s) => s.u)!;
  const [copied, setCopied] = useState(false);
  const maxDay = seasonDays(u);
  const over = isSeasonOver(u);
  const todays = gamesOn(u, u.currentDay);
  const yesterday = gamesOn(u, u.currentDay - 1);
  const upNext = todays.find((g) => !u.results[g.id]);
  const leader = standingsOf(u)[0];
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
        <h1 className="display big">
          {over ? 'Offseason' : u.phase === 'playoffs' ? `Playoffs · day ${u.currentDay - maxDay}` : `Day ${u.currentDay}`}
        </h1>
        <p className="muted">
          Season {u.season} · {maxDay} days · seed <code>{u.settings.seed}</code>{' '}
          <button className="link-btn" onClick={copySeed}>
            {copied ? 'Link copied!' : 'Share seed'}
          </button>
        </p>
        <LivingClock />
      </header>

      <WhileYouWereGone />
      <InstallBanner ready={u.currentDay > 1} />
      <BackupReminder />
      <ChoosePersona />
      <FanCard />
      <ChecklistCard />
      <ElectionCard />
      {prophecy(u) && (
        <div className="card pad prophecy" role="note">
          <p className="eyebrow">The Prophet senses…</p>
          <p>{prophecy(u)}</p>
        </div>
      )}

      {u.phase !== 'regular' && <Bracket />}
      <SeasonAwards />

      {over ? (
        <TimeControls />
      ) : (
        <>
          {upNext && (
            <>
              <h2>Up next</h2>
              <div className="game-grid">
                <GameCard game={upNext} />
              </div>
            </>
          )}
          <h2>{upNext ? 'Rest of today' : "Today's games"}</h2>
          <div className="game-grid">
            {todays.filter((g) => g !== upNext).map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
          <TimeControls />
          <OpenBets />
        </>
      )}

      {u.phase === 'regular' && (
        <p className="muted small">
          Leading the league: <strong>{leaderTeam.city} {leaderTeam.name}</strong> ({leader.wins}–{leader.losses}). The top {u.league.teams.length > 4 ? 4 : 2} teams reach the playoffs after day {maxDay}.
        </p>
      )}
      {u.persona && <PicksPanel />}
      <PatronPanel />

      {yesterday.length > 0 && (
        <>
          <h2>Yesterday's results</h2>
          <div className="game-grid">
            {yesterday.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </>
      )}

      {u.news.length > 0 && (
        <>
          <h2>Breaking news</h2>
          <NewsFeed limit={4} />
        </>
      )}

      <Ledger />
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
