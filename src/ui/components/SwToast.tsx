import { useEffect } from 'react';
import { applyUpdate, dismissSw, useSwState } from '../pwa';

/** "Ready to work offline" once, and "New version available" whenever an update is waiting. */
export function SwToast() {
  const { needRefresh, offlineReady } = useSwState();

  // The offline-ready note is informational; let it fade on its own.
  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const t = setTimeout(dismissSw, 6000);
    return () => clearTimeout(t);
  }, [offlineReady, needRefresh]);

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="sw-toast card" role="status" aria-live="polite">
      {needRefresh ? (
        <>
          <span>
            <strong>A new version of Blastball is ready.</strong>
            <span className="muted small"> Your league is saved — reloading is safe.</span>
          </span>
          <span className="row">
            <button className="btn primary inline" onClick={() => void applyUpdate()}>
              Update now
            </button>
            <button className="chip" onClick={dismissSw}>
              Later
            </button>
          </span>
        </>
      ) : (
        <>
          <span>
            <strong>Ready to play offline.</strong>
            <span className="muted small"> Blastball now works without a connection.</span>
          </span>
          <button className="chip" onClick={dismissSw}>
            OK
          </button>
        </>
      )}
    </div>
  );
}
