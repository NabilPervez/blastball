import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '../../storage/db';
import { MAX_BACKED, MAX_FADED } from '../../world/picks';
import { BAILOUT_COINS, DAILY_STIPEND, FAVORITE_LOCKS_AFTER_SEASON, FAVORITE_WIN_BONUS, STARTING_COINS } from '../../world/universe';
import { useGame, type Tab } from '../store';

const SLIDES: { eyebrow: string; title: string; body: string[] }[] = [
  {
    eyebrow: 'Welcome',
    title: 'A league that plays itself',
    body: [
      'Blastball is a strange sports league that runs on its own. You never swing a bat or throw a pitch.',
      "You're a fan living inside it: you watch, bet, back your favorites, vote, and slowly bend the rules of reality.",
    ],
  },
  {
    eyebrow: '1 · Watch',
    title: 'Every game, live',
    body: [
      'Today’s games play live in the “Now playing” bar at the top of every screen — score, inning, bases and the latest play. Tap it to watch pitch by pitch, or pause it.',
      'In Living time the league keeps playing even when the app is closed. Come back to a “While You Were Gone” summary.',
    ],
  },
  {
    eyebrow: '2 · Bet',
    title: 'Coins come from good calls',
    body: [
      `You start with ${STARTING_COINS} coins and get ${DAILY_STIPEND} more every day. Bet on today’s games — odds come from what any fan can see.`,
      `Pick a favorite team during Season 1 and earn +${FAVORITE_WIN_BONUS} every time they win. Your fan persona adds a perk. Go broke? The league office tops you back up with ${BAILOUT_COINS}.`,
    ],
  },
  {
    eyebrow: '3 · Back & fade',
    title: 'Back your heroes, fade the slumpers',
    body: [
      `Back up to ${MAX_BACKED} players: hitters pay you for hits and home runs, pitchers for strikeouts.`,
      `Fade up to ${MAX_FADED} players: you earn when they strike out, go hitless, or give up hits and runs. The League tab’s leaderboards show who’s hot.`,
    ],
  },
  {
    eyebrow: '4 · Vote',
    title: 'Coins become power',
    body: [
      'Every week there’s an election. Six fan factions vote, and so can you — spend coins on votes. Each extra vote costs more than the last.',
      'What wins really changes the league. Factions react in the news, warm to you or turn on you, and once you matter they’ll know your name.',
    ],
  },
  {
    eyebrow: '5 · Get strange',
    title: 'Things will go wrong. Beautifully.',
    body: [
      'Players get cursed or blessed. Stadiums change overnight. Very rarely, someone departs forever — unless the fans vote them back.',
      'Seasons end in playoffs for the Blastball Cup. Players age, retire and are replaced by rookies, and from Season 2 you can become a team’s Patron.',
    ],
  },
  {
    eyebrow: 'Before you start',
    title: 'Your league lives on this device',
    body: [
      'There are no accounts. Your saves stay in this browser, work offline, and can be exported as a .league file any time.',
      'Install Blastball to your home screen to keep your saves safest. You can reread all of this in the Guide.',
    ],
  },
];

export function Onboarding({ onDone }: { onDone(): void }) {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const finish = async () => {
    await setSetting('onboarded', true);
    onDone();
  };
  return (
    <main className="solo onboarding" aria-labelledby="ob-title">
      <div className="ob-progress" aria-hidden="true">
        {SLIDES.map((_, k) => (
          <span key={k} className={k <= i ? 'on' : ''} />
        ))}
      </div>
      <p className="eyebrow">{slide.eyebrow}</p>
      <h1 id="ob-title" className="display big">
        {slide.title}
      </h1>
      {slide.body.map((p, k) => (
        <p key={k} className="ob-body">
          {p}
        </p>
      ))}
      <p className="muted small" aria-live="polite">
        Step {i + 1} of {SLIDES.length}
      </p>
      <div className="row ob-actions">
        {i > 0 && (
          <button className="btn" onClick={() => setI(i - 1)}>
            Back
          </button>
        )}
        <button className="btn primary inline" onClick={() => (last ? finish() : setI(i + 1))}>
          {last ? 'Build my league →' : 'Next'}
        </button>
        {!last && (
          <button className="link-btn" onClick={finish}>
            Skip intro
          </button>
        )}
      </div>
    </main>
  );
}

/** First steps on the Today screen. Disappears when done or dismissed. */
export function ChecklistCard() {
  const u = useGame((s) => s.u)!;
  const { setTab } = useGame();
  const [dismissed, setDismissed] = useState(true);
  const [guideRead, setGuideRead] = useState(false);
  useEffect(() => {
    getSetting<boolean>('checklistDismissed').then((d) => setDismissed(!!d));
    getSetting<boolean>('guideOpened').then((g) => setGuideRead(!!g));
  }, []);

  const steps: { done: boolean; label: string; tab: Tab }[] = [
    { done: !!u.persona, label: 'Choose your fan persona', tab: 'today' },
    { done: u.started.length > 0 || u.season > 1, label: 'Watch a game live', tab: 'games' },
    { done: u.bets.length > 0, label: 'Place a bet', tab: 'today' },
    { done: !!u.persona?.favoriteTeamId || u.season > FAVORITE_LOCKS_AFTER_SEASON, label: 'Pick a favorite team', tab: 'today' },
    { done: u.picks.back.length + u.picks.fade.length > 0, label: 'Back or fade a player', tab: 'league' },
    { done: u.elections.some((e) => e.playerVotes.some((v) => v > 0)), label: 'Buy a vote in an election', tab: 'vote' },
    { done: guideRead, label: 'Skim the Guide', tab: 'guide' },
  ];
  const left = steps.filter((s) => !s.done).length;
  if (dismissed || left === 0) return null;
  return (
    <section className="card pad checklist" aria-labelledby="cl-title">
      <div className="digest-head">
        <div>
          <p className="eyebrow">Getting started</p>
          <h2 id="cl-title" className="digest-title">
            {steps.length - left} of {steps.length} done
          </h2>
        </div>
        <button
          className="chip"
          onClick={() => {
            setDismissed(true);
            void setSetting('checklistDismissed', true);
          }}
        >
          Hide
        </button>
      </div>
      <ul className="checklist-items">
        {steps.map((s) => (
          <li key={s.label} className={s.done ? 'done' : ''}>
            <span className="check-mark" aria-hidden="true">
              {s.done ? '✓' : ''}
            </span>
            {s.done ? (
              <span>{s.label}</span>
            ) : (
              <button className="link-btn" onClick={() => setTab(s.tab)}>
                {s.label} →
              </button>
            )}
            <span className="sr-only">{s.done ? '(done)' : '(to do)'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
