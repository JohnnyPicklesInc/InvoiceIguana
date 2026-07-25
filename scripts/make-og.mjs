/**
 * Renders the 1200x630 social-share image (scripts/og-image.html) to
 * site/og-image.png using a local headless Chrome/Chromium. Run: `npm run og`.
 *
 * This is a one-time build step (re-run whenever the template changes). The
 * output PNG is committed like any other static asset; the pages reference it
 * as /og-image.png and the service worker precaches it.
 *
 * Chrome is located from $CHROME_PATH or the usual install locations; set
 * CHROME_PATH explicitly if yours lives elsewhere.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const template = join(root, 'scripts', 'og-image.html');
const out = join(root, 'site', 'og-image.png');

const candidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const chrome = candidates.find((c) => existsSync(c));
if (!chrome) {
  console.error('Chrome/Chromium not found. Set CHROME_PATH to your browser binary and retry.');
  process.exit(1);
}

execFileSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1200,630',
  `--screenshot=${out}`,
  `file://${template}`,
], { stdio: 'inherit' });

console.log(`Wrote ${out} (1200x630). Referenced as /og-image.png in the pages' OG tags.`);
