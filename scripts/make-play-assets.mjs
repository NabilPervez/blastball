// Generates the Google Play listing graphics into store/play/: the 512×512 store icon and the
// 1024×500 feature graphic. Screenshots come from: PLAY=1 node scripts/capture-screenshots.mjs
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { featureGraphicHtml, iconSvg } from './brand.mjs';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const tab = await browser.newPage();
mkdirSync('store/play', { recursive: true });

// Play masks the icon itself, so upload the full-bleed square.
await tab.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
await tab.setContent(`<!doctype html><html><body style="margin:0">${iconSvg({ maskable: true })}</body></html>`);
await tab.screenshot({ path: 'store/play/icon-512.png', type: 'png', clip: { x: 0, y: 0, width: 512, height: 512 } });

// Feature graphic must have no transparency: JPEG guarantees that.
await tab.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
await tab.setContent(featureGraphicHtml(), { waitUntil: 'networkidle0' });
await tab.evaluate(() => document.fonts.ready);
await tab.screenshot({ path: 'store/play/feature-graphic.jpg', type: 'jpeg', quality: 92 });

await browser.close();
console.log('Play graphics written to store/play/');
