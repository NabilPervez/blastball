import { useState } from 'react';
import { lastDay, useGame } from '../store';
import { GameCard } from './Games';

export function Today() {
  const { league, schedule, currentDay, results, playDay, newUniverse } = useGame();
  const [seedInput, setSeedInput] = useState('');
  const [copied, setCopied] = useState(false);
  const maxDay = lastDay(schedule);
  const seasonOver = currentDay > maxDay;
  const todays = schedule.filter((g) => g.day === currentDay);
  const yesterday = schedule.filter((g) => g.day === currentDay - 1 && results[g.id]);

  const shareLink = `${location.origin}/?seed=${encodeURIComponent(league.seed)}`;
  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the link is still visible */
    }
  };

  return (
    <section>
      <header className="screen-head hero">
        <p className="eyebrow">{league.name}</p>
        <h1 className="display big">{seasonOver ? 'Season complete' : `Day ${currentDay}`}</h1>
        <p className="muted">
          Season 1 · {maxDay} days · seed <code>{league.seed}</code>{' '}
          <button className="link-btn" onClick={copySeed}>
            {copied ? 'Link copied!' : 'Share seed'}
          </button>
        </p>
      </header>

      {!seasonOver && (
        <>
          <h2>Today's games</h2>
          <div className="game-grid">
            {todays.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
          <button className="btn primary" onClick={playDay}>
            Sim day {currentDay} →
          </button>
        </>
      )}

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

      <h2>New universe</h2>
      <form
        className="card new-universe"
        onSubmit={(e) => {
          e.preventDefault();
          newUniverse(seedInput);
          setSeedInput('');
        }}
      >
        <label htmlFor="seed">Seed (leave blank for random). Same seed ⇒ same league.</label>
        <div className="row">
          <input id="seed" value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="e.g. ember-flux-123" maxLength={64} />
          <button className="btn" type="submit">
            Create
          </button>
        </div>
        <p className="muted small">Saving arrives in Sprint 2 — for now a refresh starts fresh (use a seed link to get the same league back).</p>
      </form>
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
