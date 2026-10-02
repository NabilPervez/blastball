import { useEffect, useState } from 'react';
import { exportUniverse, leagueFileName } from '../../storage/exportImport';
import { DAY_LENGTHS, DEFAULT_FIRST_PITCH_PCT, firstPitchMs, formatDuration, msUntilNextDay } from '../../world/clock';
import { gamesOn, isSeasonOver, unplayedToday } from '../../world/universe';
import { shareOrDownload } from '../pwa';
import { useGame } from '../store';
import { LinkedText } from './LinkedText';

/** Ticks every `ms` so time-based UI stays fresh. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function LivingClock() {
  const u = useGame((s) => s.u)!;
  const now = useNow();
  if (!u.clock || isSeasonOver(u)) return null;
  const len = DAY_LENGTHS.find((d) => d.minutes === u.settings.dayLengthMinutes)?.label ?? `${u.settings.dayLengthMinutes} min`;
  return (
    <p className="living-clock">
      <span className="live-dot" aria-hidden="true" /> Living time · 1 day = {len} · day {u.currentDay} ends in{' '}
      <strong>{formatDuration(msUntilNextDay(u.clock, u.settings.dayLengthMinutes, u.dayCount, now))}</strong>
      <FirstPitch now={now} />
    </p>
  );
}

/** " · first pitch in 4 min" while today's betting window is open (Living mode). */
export function FirstPitch({ now }: { now: number }) {
  const u = useGame((s) => s.u)!;
  if (!u.clock || u.settings.timeMode !== 'living' || isSeasonOver(u)) return null;
  const start = firstPitchMs(u.clock, u.settings.dayLengthMinutes, u.dayCount, u.settings.firstPitchPct ?? DEFAULT_FIRST_PITCH_PCT);
  if (now >= start) return null;
  return (
    <>
      {' '}
      · first pitch in <strong>{formatDuration(start - now)}</strong>
    </>
  );
}

const clockText = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

/**
 * Where today stands, with a live countdown: bets lock in… → games in progress → day complete,
 * next day in…. Living mode only (Manual moves when you press a button).
 */
export function DayCountdown() {
  const u = useGame((s) => s.u)!;
  const now = useNow(1000);
  const running = useGame((s) => s.running);
  if (!u.clock || u.settings.timeMode !== 'living' || isSeasonOver(u)) return null;
  const todays = gamesOn(u, u.currentDay);
  if (!todays.length) return null;
  const lock = firstPitchMs(u.clock, u.settings.dayLengthMinutes, u.dayCount, u.settings.firstPitchPct ?? DEFAULT_FIRST_PITCH_PCT);
  const dayEnd = now + msUntilNextDay(u.clock, u.settings.dayLengthMinutes, u.dayCount, now);
  const left = unplayedToday(u);
  const anyStarted = left.some((g) => running[g.id] || u.started.includes(g.id));

  if (!left.length) {
    return (
      <div className="day-countdown done" role="status">
        <span className="dc-label">Day {u.currentDay} complete ✓</span>
        <span className="dc-time">
          Day {u.currentDay + 1} in <strong>{clockText(dayEnd - now)}</strong>
        </span>
      </div>
    );
  }
  if (now < lock && !anyStarted) {
    const total = lock - (dayEnd - u.settings.dayLengthMinutes * 60_000);
    const pct = Math.max(0, Math.min(100, 100 - ((lock - now) / total) * 100));
    const urgent = lock - now < 60_000;
    return (
      <div className={`day-countdown ${urgent ? 'urgent' : ''}`} role="timer" aria-label={`Bets lock in ${formatDuration(lock - now)}`}>
        <span className="dc-label">🔒 Bets lock in</span>
        <strong className="dc-big">{clockText(lock - now)}</strong>
        <span className="dc-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      </div>
    );
  }
  return (
    <div className="day-countdown live" role="status">
      <span className="dc-label">
        <span className="live-dot" aria-hidden="true" /> {left.length} game{left.length === 1 ? '' : 's'} in progress · bets locked
      </span>
      <span className="dc-time">
        Day ends in <strong>{clockText(dayEnd - now)}</strong>
      </span>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  death: 'Departed',
  return: 'Returned',
  election: 'Election',
  paused: 'Paused',
  team: 'Your team',
  bets: 'Your bets',
  moment: 'Moment',
  weird: 'Strange',
  standings: 'Standings',
  coins: 'Coins',
};

export function WhileYouWereGone() {
  const digest = useGame((s) => s.digest);
  const dismiss = useGame((s) => s.dismissDigest);
  if (!digest) return null;
  const span = digest.toDay > digest.fromDay ? `days ${digest.fromDay}–${digest.toDay}` : `day ${digest.fromDay}`;
  return (
    <section className="card digest" aria-labelledby="digest-title">
      <header className="digest-head">
        <div>
          <p className="eyebrow">While you were gone</p>
          <h2 id="digest-title" className="digest-title">
            {span} · {digest.games} games
          </h2>
        </div>
        <button className="chip" onClick={dismiss}>
          Got it
        </button>
      </header>
      {digest.items.length === 0 ? (
        <p className="muted">A quiet stretch. Nothing remarkable happened.</p>
      ) : (
        <ol className="digest-list">
          {digest.items.map((item, i) => (
            <li key={i} className={`digest-item k-${item.kind}`}>
              <span className="digest-kind">{KIND_LABEL[item.kind]}</span>
              <span><LinkedText text={item.text} /></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CatchUpOverlay() {
  const progress = useGame((s) => s.catchingUp);
  if (!progress) return null;
  return (
    <div className="catchup" role="status" aria-live="polite">
      <div className="card pad">
        <p className="eyebrow">Catching up</p>
        <p>
          The league kept playing without you… day {progress.done} of {progress.total}
        </p>
        <progress max={progress.total} value={progress.done} />
      </div>
    </div>
  );
}

/** Gentle backup reminder every couple of in-game weeks (PRD §10). */
export const BACKUP_EVERY_DAYS = 14;

export function BackupReminder() {
  const u = useGame((s) => s.u)!;
  const dispatch = useGame((s) => s.dispatch);
  const [status, setStatus] = useState<string | null>(null);
  if (u.currentDay - u.lastBackupDay < BACKUP_EVERY_DAYS) return null;
  const note = () => dispatch({ type: 'backupNoted', day: u.currentDay });
  return (
    <div className="card banner" role="region" aria-label="Backup reminder">
      <div>
        <strong>Export a backup?</strong>
        <p className="muted small">Your league lives only on this device. One tap saves a .league file you can restore anywhere.</p>
        {status && <p className="small">{status}</p>}
      </div>
      <div className="row">
        <button
          className="btn primary inline"
          onClick={async () => {
            try {
              const blob = await exportUniverse(u.id, { includePlayByPlay: false });
              await shareOrDownload(blob, leagueFileName(u.settings.name));
              await note();
            } catch (e) {
              setStatus(`Export failed: ${(e as Error).message}`);
            }
          }}
        >
          Export backup
        </button>
        <button className="chip" onClick={note}>
          Later
        </button>
      </div>
    </div>
  );
}
