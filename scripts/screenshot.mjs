// Takes 1920x1080 screenshots of the TV page (home, notes, painting) and the phone page.
// Usage: npm run screenshots  (server must NOT already be running on SHOT_PORT)
// Needs Playwright: preinstalled in the dev container; on your laptop: npm i -D playwright && npx playwright install chromium
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = Number(process.env.SHOT_PORT || 3999);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve('screenshots');
fs.mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['server/index.js'], {
  env: {
    ...process.env, PORT: String(PORT),
    STATE_FILE: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shot-')), 'state.json'),
    WEATHER_FIXTURE: process.env.WEATHER_FIXTURE || 'test/fixtures/weather.json',
    NIGHT_DIM_START: '', NIGHT_DIM_END: '',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((r) => server.stdout.on('data', (d) => d.toString().includes('running') && r()));

const post = (m) => fetch(BASE + '/api/action', { method: 'POST', body: JSON.stringify(m) });
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on('pageerror', (e) => errors.push('tv: ' + e.message));
  tv.on('console', (m) => m.type() === 'error' && errors.push('tv console: ' + m.text()));
  await tv.goto(BASE + '/tv/');
  await tv.waitForSelector('.status.online');
  await tv.waitForFunction(() => document.getElementById('w-temp').textContent !== '--');
  await tv.screenshot({ path: `${OUT}/tv-home-empty.png` });

  // Simulate a phone: a heart, a squiggle and some text
  const heart = [];
  for (let t = 0; t <= Math.PI * 2; t += 0.05) {
    const x = 16 * Math.sin(t) ** 3, y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    heart.push([0.3 + x / 90, 0.5 + y / 55]);
  }
  await post({ type: 'draw', id: 'heart', color: '#ff7a7a', size: 18, points: heart });
  const wave = Array.from({ length: 80 }, (_, i) => [0.52 + i * 0.0045, 0.72 + Math.sin(i / 6) * 0.05]);
  await post({ type: 'draw', id: 'wave', color: '#7cc4ff', size: 10, points: wave });
  await post({ type: 'text', id: 't1', content: 'Dinner at 8?', color: '#ffcf5c', size: 130, x: 0.68, y: 0.38 });
  await tv.waitForFunction(() => document.getElementById('board-empty').hidden);
  await tv.keyboard.press('ArrowRight');       // show the remote focus ring on button 2
  await tv.screenshot({ path: `${OUT}/tv-home-notes.png` });

  await post({ type: 'mode', mode: 'painting' });
  await tv.waitForSelector('#painting:not([hidden])');
  await tv.waitForTimeout(400);
  await tv.screenshot({ path: `${OUT}/tv-painting.png` });
  await post({ type: 'mode', mode: 'home' });

  const phone = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  phone.on('pageerror', (e) => errors.push('phone: ' + e.message));
  await phone.goto(BASE + '/phone/');
  await phone.waitForSelector('.conn.online');
  await phone.waitForTimeout(300);
  await phone.screenshot({ path: `${OUT}/phone.png` });
} finally {
  await browser.close();
  server.kill();
}
if (errors.length) { console.error('Page errors:\n' + errors.join('\n')); process.exit(1); }
console.log('Screenshots written to', OUT);
