// Audits the production build as an installable PWA using Chrome's own checks.
// Usage: npm run build && node scripts/check-pwa.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 4181;
const ORIGIN = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(ORIGIN)).ok) break;
  } catch {
    /* not up yet */
  }
  await sleep(500);
}

const problems = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  await page.goto(ORIGIN, { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'load' });
  const cdp = await page.createCDPSession();

  const manifest = await cdp.send('Page.getAppManifest');
  for (const e of manifest.errors) problems.push(`manifest: ${e.message}`);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  for (const e of installabilityErrors) problems.push(`installability: ${e.errorId}`);

  // Every file the manifest and index.html point at must exist.
  const json = JSON.parse(manifest.data ?? '{}');
  const urls = [
    ...json.icons.map((i) => i.src),
    ...json.screenshots.map((s) => s.src),
    ...json.shortcuts.flatMap((s) => s.icons.map((i) => i.src)),
    ...[...readFileSync('dist/index.html', 'utf8').matchAll(/(?:href|content)="(\/[^"]+\.(?:png|svg|ico))"/g)].map((m) => m[1]),
  ];
  for (const u of new Set(urls)) {
    const res = await fetch(new URL(u, ORIGIN));
    if (!res.ok) problems.push(`missing: ${u} (${res.status})`);
  }

  // Works offline: block the network and reload.
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'load' });
  await sleep(800);
  const offlineText = await page.evaluate(() => document.body.innerText);
  if (!/Blastball|BLASTBALL|league/i.test(offlineText)) problems.push('offline: app did not render without a network');

  console.log(`manifest: ${json.name} · ${json.icons.length} icons · ${json.screenshots.length} screenshots · ${json.shortcuts.length} shortcuts`);
  console.log(`checked ${new Set(urls).size} asset URLs`);
} finally {
  await browser.close();
  server.kill();
}

if (problems.length) {
  console.error('PWA problems:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('PWA check passed: installable, all assets present, works offline.');
process.exit(0);
