import { useEffect, useRef, useState } from 'react';
import { exportUniverse, importLeague, leagueFileName } from '../../storage/exportImport';
import { formatBytes, promptInstall, shareOrDownload, storageInfo, useInstallMode, type StorageInfo } from '../pwa';
import { useGame } from '../store';

export function InstallHelp() {
  const mode = useInstallMode();
  if (mode === 'installed') return <p className="muted">✓ Installed as an app.</p>;
  if (mode === 'prompt')
    return (
      <button className="btn" onClick={() => promptInstall()}>
        Install Blastball
      </button>
    );
  if (mode === 'ios') return <p className="muted">On iPhone/iPad: tap Share, then “Add to Home Screen”.</p>;
  return <p className="muted">Use your browser's menu to install this site as an app (e.g. “Install app” or “Add to Home Screen”).</p>;
}

export function Settings() {
  const u = useGame((s) => s.u)!;
  const { showPicker, openUniverse } = useGame();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [withPbp, setWithPbp] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => storageInfo().then(setInfo);
  useEffect(() => {
    refresh();
  }, []);

  const doExport = async () => {
    setStatus('Exporting…');
    try {
      const blob = await exportUniverse(u.id, { includePlayByPlay: withPbp });
      const how = await shareOrDownload(blob, leagueFileName(u.settings.name));
      setStatus(`${how === 'shared' ? 'Shared' : 'Downloaded'} ${leagueFileName(u.settings.name)} (${formatBytes(blob.size)}).`);
    } catch (e) {
      setStatus(`Export failed: ${(e as Error).message}`);
    }
  };

  const doImport = async (file: File) => {
    setStatus('Importing…');
    try {
      const id = await importLeague(file);
      setStatus(null);
      await openUniverse(id);
    } catch (e) {
      setStatus(`Import failed: ${(e as Error).message} Nothing was changed.`);
    }
  };

  return (
    <section className="settings">
      <header className="screen-head">
        <h1>Settings</h1>
      </header>

      <h2>This universe</h2>
      <dl className="card kv">
        <dt>Name</dt>
        <dd>{u.settings.name}</dd>
        <dt>Seed</dt>
        <dd>
          <code>{u.settings.seed}</code>
        </dd>
        <dt>League</dt>
        <dd>
          {u.settings.leagueSize} teams · {u.settings.seasonLength}-game season
        </dd>
        <dt>Chaos</dt>
        <dd className="cap">{u.settings.chaos}</dd>
        <dt>Time</dt>
        <dd>Manual (Living mode arrives later)</dd>
      </dl>
      <button className="btn" onClick={showPicker}>
        Switch / manage universes
      </button>

      <h2>Backup</h2>
      <div className="card pad stack">
        <p className="muted small">Saves live only on this device. Export a .league file to back up or move your universe.</p>
        <label className="check">
          <input type="checkbox" checked={withPbp} onChange={(e) => setWithPbp(e.target.checked)} /> Include recent play-by-play (bigger file)
        </label>
        <div className="row">
          <button className="btn primary inline" onClick={doExport}>
            Export .league
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Import .league
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".league,application/gzip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) doImport(f);
            }}
          />
        </div>
        {status && (
          <p role="status" className="small">
            {status}
          </p>
        )}
      </div>

      <h2>Storage</h2>
      <div className="card pad stack">
        <p>
          Using <strong>{formatBytes(info?.usage ?? null)}</strong>
          {info?.quota ? <span className="muted"> of {formatBytes(info.quota)} available</span> : null}
        </p>
        <p>
          Protected from automatic cleanup:{' '}
          <strong>{info?.persisted === null || !info ? 'unknown' : info.persisted ? 'yes' : 'not yet'}</strong>
        </p>
        {info && info.persisted === false && (
          <button className="btn" onClick={() => navigator.storage.persist().then(refresh)}>
            Ask to protect my saves
          </button>
        )}
      </div>

      <h2>Install</h2>
      <div className="card pad stack">
        <p className="muted small">Installed apps work offline and get stronger storage guarantees (important on iPhone).</p>
        <InstallHelp />
      </div>

      <h2>About</h2>
      <p className="muted small">
        Blastball · save v{u.saveVersion} · engine v{u.engineVersion}. An original game inspired by absurdist sports sims.
      </p>
    </section>
  );
}
