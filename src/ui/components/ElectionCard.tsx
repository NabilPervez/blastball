import { playerVoteTotal, tally, winnerOf } from '../../world/elections';
import { currentElection } from '../../world/universe';
import { useGame } from '../store';

/** Today-screen countdown to the current election. */
export function ElectionCard() {
  const u = useGame((s) => s.u)!;
  const setTab = useGame((s) => s.setTab);
  const e = currentElection(u);
  if (!e) return null;
  const leader = e.proposals[winnerOf(tally(e))];
  const daysLeft = e.closesDay - u.currentDay + 1;
  return (
    <button className="card election-card" onClick={() => setTab('vote')}>
      <span>
        <p className="eyebrow">Election #{e.id} · {daysLeft <= 1 ? 'closes today' : `${daysLeft} days left`}</p>
        <p>
          Leading: <strong>{leader.title}</strong>
        </p>
        <p className="muted small">{playerVoteTotal(e) ? `You've cast ${playerVoteTotal(e)} votes.` : 'Spend coins on votes to shape the league.'}</p>
      </span>
      <span className="chip">Vote →</span>
    </button>
  );
}
