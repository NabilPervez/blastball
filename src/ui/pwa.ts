import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { getSetting, setSetting } from '../storage/db';

/** Service worker, install prompt, and storage durability helpers (PRD §10 "Storage durability"). */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function startPwa() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) registerSW({ immediate: true });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export type InstallMode = 'prompt' | 'ios' | 'installed' | 'unavailable';

function installMode(): InstallMode {
  if (isStandalone()) return 'installed';
  if (deferredPrompt) return 'prompt';
  if (isIos()) return 'ios';
  return 'unavailable';
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    installMode,
  );
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === 'accepted';
}

/** Ask the browser not to evict our saves. Called once, after the first meaningful action. */
export async function requestPersistenceOnce(): Promise<void> {
  if (!navigator.storage?.persist) return;
  if (await getSetting<boolean>('persistRequested')) return;
  await setSetting('persistRequested', true);
  try {
    await navigator.storage.persist();
  } catch {
    /* not fatal: install + backups are the other safety nets */
  }
}

export interface StorageInfo {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}

export async function storageInfo(): Promise<StorageInfo> {
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted };
}

export const formatBytes = (n: number | null) =>
  n === null ? 'unknown' : n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(1)} GB`;

/** Share a file on mobile (Web Share API) or fall back to a download. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'application/gzip' });
  if (navigator.canShare?.({ files: [file] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
