import { useGame, type Tab } from './store';
import { Games } from './screens/Games';
import { League } from './screens/League';
import { ComingSoon, Today } from './screens/Today';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'games', label: 'Games', icon: '◆' },
  { id: 'league', label: 'League', icon: '▤' },
  { id: 'vote', label: 'Vote', icon: '✦' },
  { id: 'history', label: 'History', icon: '⧗' },
];

export function App() {
  const { tab, setTab } = useGame();
  return (
    <div className="app">
      <nav className="nav" aria-label="Main">
        <div className="brand display">
          BLAST<span>BALL</span>
        </div>
        {TABS.map((t) => (
          <button key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span className="nav-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <main className="main">
        {tab === 'today' && <Today />}
        {tab === 'games' && <Games />}
        {tab === 'league' && <League />}
        {tab === 'vote' && <ComingSoon title="Vote" blurb="Elections, factions and buying votes with the coins you win betting. Arrives in a later sprint." />}
        {tab === 'history' && <ComingSoon title="History" blurb="Season timeline, notable events, pinned games and the Hall of the Departed. Arrives in a later sprint." />}
      </main>
    </div>
  );
}
