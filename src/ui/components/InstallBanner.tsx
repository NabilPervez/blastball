import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '../../storage/db';
import { promptInstall, useInstallMode } from '../pwa';

/** Shown after the first session (once a day has been played): installed apps keep saves safer. */
export function InstallBanner({ ready }: { ready: boolean }) {
  const mode = useInstallMode();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    getSetting<boolean>('installDismissed').then((d) => setDismissed(!!d));
  }, []);
  if (!ready || dismissed || (mode !== 'prompt' && mode !== 'ios')) return null;
  const dismiss = () => {
    setDismissed(true);
    void setSetting('installDismissed', true);
  };
  return (
    <div className="card banner" role="region" aria-label="Install Blastball">
      <div>
        <strong>Keep your league safe — install Blastball.</strong>
        <p className="muted small">
          {mode === 'ios'
            ? 'Tap Share, then “Add to Home Screen”. Installed apps work offline and your saves are much less likely to be cleared.'
            : 'Installed, it works offline and your saves are much less likely to be cleared.'}
        </p>
      </div>
      <div className="row">
        {mode === 'prompt' && (
          <button className="btn primary inline" onClick={() => promptInstall().then((ok) => ok && dismiss())}>
            Install
          </button>
        )}
        <button className="chip" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
