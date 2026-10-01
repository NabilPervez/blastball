import { useEffect } from 'react';
import { CoinBadge } from './components/Wallet';
import { useGame, type Tab } from './store';
import { Games } from './screens/Games';
import { League } from './screens/League';
import { ComingSoon, Today } from './screens/Today';
import { Settings } from './screens/Settings';
import { Vote } from './screens/Vote';
import { CreateUniverse, Picker } from './screens/Universes';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'games', label: 'Games', icon: '◆' },
  { id: 'league', label: 'League', icon: '▤' },
  { id: 'vote', label: 'Vote', icon: '✦' },
  { id: 'history', label: 'History', icon: '⧗' },
];

const SIDEBAR_ONLY: { id: Tab; label: string; icon: string }[] = [{ id: 'settings', label: 'Settings', icon: '⚙' }];

function ErrorBanner() {
  const { error, clearError } = useGame();
  if (!error) return null;
  return (
    <div className="error-banner" role="alert">
      <span>{error}</span>
      <button className="chip" onClick={clearError}>
        Dismiss
      </button>
    </div>
  );
}

function TopBar() {
  const u = useGame((s) => s.u)!;
  const { showPicker, setTab } = useGame();
  return (
    <header className="topbar">
      <button className="topbar-universe" onClick={showPicker} aria-label="Switch universe">
        <span className="brand-mini display">
          B<span>B</span>
        </span>
        <span className="topbar-name">{u.settings.name}</span>
        <span className="muted small">⇄</span>
      </button>
      <CoinBadge />
      <button className="chip topbar-gear" onClick={() => setTab('settings')} aria-label="Settings">
        ⚙
      </button>
    </header>
  );
}

export function App() {
  const { view, tab, setTab, init } = useGame();

  useEffect(() => {
    init();
  }, [init]);

  if (view === 'loading') return <p className="solo muted">Loading…</p>;
  if (view === 'picker')
    return (
      <>
        <ErrorBanner />
        <Picker />
      </>
    );
  if (view === 'create') return <CreateUniverse />;

  return (
    <div className="app">
      <ErrorBanner />
      <nav className="nav" aria-label="Main">
        <div className="brand display">
          BLAST<span>BALL</span>
        </div>
        {[...TABS, ...SIDEBAR_ONLY].map((t) => (
          <button key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''} ${t.id === 'settings' ? 'sidebar-only' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span className="nav-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <main className="main">
        <TopBar />
        {tab === 'today' && <Today />}
        {tab === 'games' && <Games />}
        {tab === 'league' && <League />}
        {tab === 'vote' && <Vote />}
        {tab === 'settings' && <Settings />}
        {tab === 'history' && <ComingSoon title="History" blurb="Season timeline, notable events, pinned games and the Hall of the Departed. Arrives in a later sprint." />}
      </main>
    </div>
  );
}
