import { useEffect, useState } from 'react';
import { exportUniverse, leagueFileName } from '../../storage/exportImport';
import { DAY_LENGTHS, formatDuration, msUntilNextDay } from '../../world/clock';
import { isSeasonOver } from '../../world/universe';
import { shareOrDownload } from '../pwa';
import { useGame } from '../store';

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
      <strong>{formatDuration(msUntilNextDay(u.clock, u.settings.dayLengthMinutes, u.currentDay, now))}</strong>
    </p>
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
              <span>{item.text}</span>
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
