import { useEffect } from 'react';
import { CoinBadge } from './components/Wallet';
import { useGame, type Tab } from './store';
import { Games } from './screens/Games';
import { League } from './screens/League';
import { Today } from './screens/Today';
import { Settings } from './screens/Settings';
import { Vote } from './screens/Vote';
import { History } from './screens/History';
import { CatchUpOverlay } from './components/TimeBits';
import { Onboarding } from './components/Onboarding';
import { Guide } from './screens/Guide';
import { CreateUniverse, Picker } from './screens/Universes';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'games', label: 'Games', icon: '◆' },
  { id: 'league', label: 'League', icon: '▤' },
  { id: 'vote', label: 'Vote', icon: '✦' },
  { id: 'history', label: 'History', icon: '⧗' },
];

const SIDEBAR_ONLY: { id: Tab; label: string; icon: string }[] = [
  { id: 'guide', label: 'Guide', icon: '?' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

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
      <button className="chip topbar-help topbar-gear" onClick={() => setTab('guide')} aria-label="Guide">
        ?
      </button>
      <button className="chip topbar-gear" onClick={() => setTab('settings')} aria-label="Settings">
        ⚙
      </button>
    </header>
  );
}

export function App() {
  const { view, tab, setTab, init, catchUp, finishIntro } = useGame();

  useEffect(() => {
    init();
  }, [init]);

  // Living mode: keep the world turning while the app is open, and catch up when it comes back into view.
  useEffect(() => {
    const tick = () => void catchUp();
    const t = setInterval(tick, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [catchUp]);

  if (view === 'loading') return <p className="solo muted">Loading…</p>;
  if (view === 'picker')
    return (
      <>
        <ErrorBanner />
        <Picker />
      </>
    );
  if (view === 'create') return <CreateUniverse />;
  if (view === 'intro') return <Onboarding onDone={finishIntro} />;

  return (
    <div className="app">
      <ErrorBanner />
      <CatchUpOverlay />
      <nav className="nav" aria-label="Main">
        <div className="brand display">
          BLAST<span>BALL</span>
        </div>
        {[...TABS, ...SIDEBAR_ONLY].map((t) => (
          <button key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''} ${SIDEBAR_ONLY.includes(t) ? 'sidebar-only' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
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
        {tab === 'guide' && <Guide />}
        {tab === 'history' && <History />}
      </main>
    </div>
  );
}
