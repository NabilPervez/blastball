// Captures the store/install-prompt screenshots from the real production build.
// Usage: npm run build && node scripts/capture-screenshots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 4180;
const URL = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync('public/screenshots', { recursive: true });

// Serve the production build.
const server = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(URL)).ok) break;
  } catch {
    /* not up yet */
  }
  await sleep(500);
}

// Google Fonts are fetched here and handed to the page, so text renders in the real typefaces.
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const fontCssUrl = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&family=Inter:wght@400;600&display=swap';
const fontCss = await (await fetch(fontCssUrl, { headers: { 'User-Agent': ua } })).text();
const fontFiles = new Map();
for (const url of new Set(fontCss.match(/https:[^)]+\.woff2/g) ?? [])) fontFiles.set(url, Buffer.from(await (await fetch(url)).arrayBuffer()));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });

async function session(viewport) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.startsWith('https://fonts.googleapis.com/')) return req.respond({ status: 200, contentType: 'text/css', headers: { 'Access-Control-Allow-Origin': '*' }, body: fontCss });
    if (fontFiles.has(u)) return req.respond({ status: 200, contentType: 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' }, body: fontFiles.get(u) });
    return req.continue();
  });
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(800);
  return page;
}

/** Runs in the page: small helpers for clicking by text and filling React inputs. */
const helpers = `
  window.__click = (text) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().includes(text)); if (!b) throw new Error('no button ' + text); b.click(); };
  window.__set = (el, v) => { const p = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  window.__tab = (name) => [...document.querySelectorAll('.nav-item')].find((b) => b.textContent.includes(name)).click();
`;

async function setUpLeague(page) {
  await page.evaluate(helpers);
  await page.evaluate(() => window.__click('Skip intro'));
  await sleep(400);
  await page.evaluate(() => {
    const form = document.querySelector('.create-form');
    window.__set(form.querySelector('input'), 'The Ember League');
    window.__set(form.querySelectorAll('input')[1], 'ember-flux-777');
    window.__click('Manual — you advance it');
    window.__click('Weird');
  });
  await sleep(200);
  await page.evaluate(() => {
    window.__set(document.querySelector('input[placeholder="e.g. Section 12 Sam"]'), 'Sam');
    window.__set(document.querySelector('select.field'), 't3');
  });
  await sleep(200);
  await page.evaluate(() => window.__click('Create universe'));
  await sleep(1200);
  await page.evaluate(helpers);
  // Two weeks in, with a bet and some votes, so the league has a story to show.
  await page.evaluate(() => window.__click('+7 days'));
  await sleep(2500);
  await page.evaluate(() => window.__click('Got it'));
  await page.evaluate(() => {
    const v = document.querySelector('.proposal');
    if (v) return;
  });
  await page.evaluate(() => window.__tab('Vote'));
  await sleep(400);
  await page.evaluate(async () => {
    const card = document.querySelectorAll('.proposal')[1];
    for (let i = 0; i < 4; i++) card.querySelector('[aria-label="One more vote"]').click();
    await new Promise((r) => setTimeout(r, 100));
    card.querySelector('button[type=submit]').click();
  });
  await sleep(400);
  await page.evaluate(() => window.__tab('Today'));
  await sleep(300);
  await page.evaluate(() => window.__click('+7 days'));
  await sleep(2500);
  await page.evaluate(() => {
    window.__click('Got it');
    const hide = [...document.querySelectorAll('.checklist button')].find((b) => b.textContent.includes('Hide'));
    hide?.click();
    const later = [...document.querySelectorAll('.banner button')].find((b) => b.textContent.includes('Later') || b.textContent.includes('Not now'));
    later?.click();
  });
  await sleep(300);
  await page.evaluate(async () => {
    window.__click('Bet');
    await new Promise((r) => setTimeout(r, 200));
    window.__click('Place bet');
  });
  await sleep(400);
  await page.evaluate(() => window.scrollTo(0, 0));
}

const shot = (page, name) => page.screenshot({ path: `public/screenshots/${name}.png`, type: 'png' });

// Phone: 390×844 CSS px at 3× → 1170×2532.
{
  const page = await session({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await setUpLeague(page);
  await shot(page, 'phone-today');

  await page.evaluate(() => [...document.querySelectorAll('.gc-main')].find((b) => b.textContent.includes('Watch')).click());
  await sleep(500);
  await page.evaluate(() => window.__click('5×'));
  await sleep(9000);
  await page.evaluate(() => window.__click('Pause'));
  await sleep(200);
  await shot(page, 'phone-game');

  await page.evaluate(() => window.__tab('Vote'));
  await sleep(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'phone-vote');

  await page.evaluate(() => window.__tab('League'));
  await sleep(300);
  await page.evaluate(() => document.querySelector('.team-tile').click());
  await sleep(300);
  await page.evaluate(() => document.querySelector('button.player-card').click());
  await sleep(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'phone-player');
}

// Desktop: 1280×800 CSS px at 1.5× → 1920×1200.
{
  const page = await session({ width: 1280, height: 800, deviceScaleFactor: 1.5 });
  await setUpLeague(page);
  await shot(page, 'desktop-today');
  await page.evaluate(() => window.__tab('League'));
  await sleep(500);
  await shot(page, 'desktop-league');
}

await browser.close();
server.kill();
console.log('screenshots written to public/screenshots/');
process.exit(0);
