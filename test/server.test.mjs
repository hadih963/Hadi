// Run with: npm test
// Starts the real server on a spare port and checks the main flows end to end.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const STATE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tvdash-')), 'state.json');
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), STATE_FILE: STATE, WEATHER_FIXTURE: 'test/fixtures/weather.json' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve) => proc.stdout.on('data', (d) => d.toString().includes('running') && resolve()));
});
after(() => proc.kill());

function client() {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    const inbox = [];
    ws.on('message', (d) => inbox.push(JSON.parse(d)));
    ws.on('open', () => resolve({
      ws, inbox,
      send: (m) => ws.send(JSON.stringify(m)),
      next: (type) => new Promise((res) => {
        const t = setInterval(() => {
          const i = inbox.findIndex((m) => m.type === type);
          if (i >= 0) { clearInterval(t); res(inbox.splice(i, 1)[0]); }
        }, 10);
      }),
    }));
  });
}

test('pages are served', async () => {
  for (const p of ['/tv/', '/phone/', '/shared/ws-client.js']) {
    const r = await fetch(BASE + p);
    assert.equal(r.status, 200, p);
  }
});

test('path traversal is blocked', async () => {
  const r = await fetch(BASE + '/%2e%2e/package.json');
  assert.ok([403, 404].includes(r.status));
});

test('phone stroke reaches the TV live and is saved', async () => {
  const tv = await client();
  const phone = await client();
  await tv.next('state'); await phone.next('state');

  phone.send({ type: 'draw', id: 'abc', color: '#ffffff', size: 6, points: [[0.1, 0.1], [0.2, 0.2]] });
  const got = await tv.next('draw');
  assert.equal(got.id, 'abc');
  assert.deepEqual(got.points, [[0.1, 0.1], [0.2, 0.2]]);

  const st = await (await fetch(BASE + '/api/state')).json();
  assert.equal(st.state.notes.strokes[0].points.length, 2);

  // bad input is ignored, not stored
  phone.send({ type: 'draw', id: 'x', color: 'red; drop', size: 6, points: [[0, 0]] });
  phone.send({ type: 'undo' });
  const n = await tv.next('notes');
  assert.equal(n.notes.strokes.length, 0);
  tv.ws.close(); phone.ws.close();
});

test('mode can be switched over HTTP (for the laptop CLI)', async () => {
  const tv = await client(); await tv.next('state');
  const r = await fetch(BASE + '/api/action', { method: 'POST', body: JSON.stringify({ type: 'mode', mode: 'painting' }) });
  assert.equal(r.status, 200);
  assert.equal((await tv.next('mode')).mode, 'painting');
  const bad = await fetch(BASE + '/api/action', { method: 'POST', body: JSON.stringify({ type: 'mode', mode: 'nope' }) });
  assert.equal(bad.status, 400);
  tv.ws.close();
});

test('weather is simplified for the TV', async () => {
  const w = await (await fetch(BASE + '/api/weather')).json();
  assert.equal(w.city, 'Amsterdam');
  assert.equal(typeof w.temp, 'number');
  assert.equal(w.hours.length, 4);
});
