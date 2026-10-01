import { useState } from 'react';
import { marginalCost, playerVoteTotal, tally, winnerOf, type Election } from '../../world/elections';
import { ORGANIZER_DISCOUNT_PCT } from '../../world/elections';
import { currentElection, voteError, type UniverseState } from '../../world/universe';
import { TeamBadge } from '../components/bits';
import { useGame } from '../store';

function ProposalCard({ u, e, index }: { u: UniverseState; e: Election; index: number }) {
  const dispatch = useGame((s) => s.dispatch);
  const [count, setCount] = useState(1);
  const p = e.proposals[index];
  const totals = tally(e);
  const sum = totals.reduce((a, b) => a + b, 0) || 1;
  const leading = winnerOf(totals) === index;
  const organizer = u.persona?.kind === 'organizer';
  const cost = marginalCost(playerVoteTotal(e), count, organizer);
  const error = voteError(u, e.id, index, count);
  const backers = u.factions
    .map((f) => ({ f, votes: e.factionVotes[f.id][index] }))
    .filter((x) => x.votes > 0)
    .sort((a, b) => b.votes - a.votes);

  return (
    <article className={`card proposal ${leading ? 'leading' : ''}`}>
      <header className="proposal-head">
        <h3 className="display">{p.title}</h3>
        {leading && <span className="pill">Leading</span>}
      </header>
      <p className="muted">{p.description}</p>
      <div className="vote-bar" role="img" aria-label={`${totals[index]} votes, ${Math.round((totals[index] * 100) / sum)}% of all votes`}>
        <span style={{ width: `${(totals[index] * 100) / sum}%` }} />
      </div>
      <p className="small">
        <strong>{totals[index]}</strong> votes · {Math.round((totals[index] * 100) / sum)}%
        {e.playerVotes[index] > 0 && <span className="your-votes"> · {e.playerVotes[index]} yours</span>}
      </p>
      <ul className="backers">
        {backers.map(({ f, votes }) => (
          <li key={f.id} className="small">
            <span>{f.name}</span>
            <span className="muted">{votes}</span>
          </li>
        ))}
      </ul>
      <form
        className="buy-votes row"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!error) dispatch({ type: 'votesBought', electionId: e.id, proposal: index, count }).then(() => setCount(1));
        }}
      >
        <button type="button" className="chip" aria-label="One fewer vote" onClick={() => setCount((c) => Math.max(1, c - 1))}>
          −
        </button>
        <span className="vote-count" aria-live="polite">
          {count} vote{count === 1 ? '' : 's'}
        </span>
        <button type="button" className="chip" aria-label="One more vote" onClick={() => setCount((c) => c + 1)}>
          +
        </button>
        <button className="btn primary inline" type="submit" disabled={!!error}>
          Buy · <i className="coin" aria-hidden="true" /> {cost}
        </button>
      </form>
      {error && count > 1 && <p className="small neg">{error}</p>}
      {organizer && <p className="small muted">Organizer discount: {ORGANIZER_DISCOUNT_PCT}% off.</p>}
    </article>
  );
}

function PastElections({ u }: { u: UniverseState }) {
  const past = u.elections.filter((e) => e.result).reverse();
  if (!past.length) return null;
  return (
    <>
      <h2>Past elections</h2>
      <ul className="card past-elections">
        {past.map((e) => {
          const r = e.result!;
          return (
            <li key={e.id}>
              <span className="muted small">
                #{e.id} · Season {e.season}, days {e.openedDay}–{e.closesDay}
              </span>
              <strong>{e.proposals[r.winner].title}</strong>
              <span className="small muted">
                {r.totals.map((t, i) => `${e.proposals[i].title}: ${t}`).join(' · ')}
                {playerVoteTotal(e) > 0 && ` · you cast ${playerVoteTotal(e)} (${e.coinsSpent} coins)`}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function NewsFeed({ limit = 8 }: { limit?: number }) {
  const u = useGame((s) => s.u)!;
  const items = u.news.slice(-limit).reverse();
  if (!items.length) return null;
  return (
    <ul className="card news">
      {items.map((n, i) => (
        <li key={i}>
          <span className="muted small">
            Season {n.season} · Day {n.day}
          </span>
          <span>{n.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function Vote() {
  const u = useGame((s) => s.u)!;
  const e = currentElection(u);
  const organizer = u.persona?.kind === 'organizer';
  const have = e ? playerVoteTotal(e) : 0;
  const teamOf = (id: string) => u.league.teams.find((t) => t.id === id)!;

  return (
    <section>
      <header className="screen-head">
        <h1>Vote</h1>
      </header>

      {e ? (
        <>
          <div className="card pad election-head">
            <p className="eyebrow">Election #{e.id}</p>
            <p>
              Closes at the end of <strong>day {e.closesDay}</strong>
              {e.closesDay === u.currentDay ? ' — today!' : ` — ${e.closesDay - u.currentDay + 1} days left`}.
            </p>
            <p className="muted small">
              Votes get pricier the more you buy: your next vote costs <i className="coin" aria-hidden="true" /> {marginalCost(have, 1, organizer)} (you have {have}). Ties go
              to the status quo.
            </p>
          </div>
          <div className="proposals">
            {e.proposals.map((_, i) => (
              <ProposalCard key={i} u={u} e={e} index={i} />
            ))}
          </div>
        </>
      ) : (
        <div className="card pad">
          <p>No election is open right now. {u.currentDay > u.settings.seasonLength ? 'The season is over.' : 'The next one opens tomorrow.'}</p>
        </div>
      )}

      <h2>League news</h2>
      <NewsFeed />

      <PastElections u={u} />

      <h2>The factions</h2>
      <div className="faction-grid">
        {u.factions.map((f) => (
          <div key={f.id} className="card pad faction">
            <strong className="display">{f.name}</strong>
            <p className="muted small">{f.ideology}</p>
            <p className="small faction-favs">
              Favorite{f.favoriteTeams.length > 1 ? 's' : ''}:{' '}
              {f.favoriteTeams.map((id) => (
                <span key={id} className="team-cell">
                  <TeamBadge team={teamOf(id)} size={18} /> {teamOf(id).name}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
