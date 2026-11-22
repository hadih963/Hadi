// TV dashboard server: serves the web pages, a small JSON API and one WebSocket.
//   http://<laptop-ip>:3000/tv/     -> the TV screen
//   http://<laptop-ip>:3000/phone/  -> the phone drawing pad
//   ws://<laptop-ip>:3000/ws        -> live updates both ways
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { createStore } from './state.js';
import { getWeather } from './weather.js';

const store = createStore(config.dataFile);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- helpers ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJsonBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}); }
      catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

export function lanUrls(port) {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${port}`);
}

function listPaintings() {
  try {
    return fs.readdirSync(path.join(config.publicDir, 'paintings'))
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .sort()
      .map((f) => `/paintings/${encodeURIComponent(f)}`);
  } catch { return []; }
}

function clientConfig() {
  const p = config.painting;
  return {
    nightDimStart: p.nightDimStart, nightDimEnd: p.nightDimEnd,
    rotateMinutes: p.rotateMinutes, city: config.weather.city,
  };
}

// ---------- input validation (never trust what arrives over the network) ----------
const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));
const isColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const isId = (id) => typeof id === 'string' && /^[\w-]{1,40}$/.test(id);

function cleanDraw(m) {
  if (!isId(m.id) || !isColor(m.color) || !Array.isArray(m.points)) return null;
  const size = Math.min(60, Math.max(1, Number(m.size) || 4));
  const points = m.points.slice(0, 500)
    .filter((p) => Array.isArray(p) && p.length === 2)
    .map(([x, y]) => [Math.round(clamp01(x) * 10000) / 10000, Math.round(clamp01(y) * 10000) / 10000]);
  return points.length ? { id: m.id, color: m.color, size, points } : null;
}

function cleanText(m) {
  const content = typeof m.content === 'string' ? m.content.trim().slice(0, 200) : '';
  if (!isId(m.id) || !content || !isColor(m.color)) return null;
  const size = Math.min(160, Math.max(16, Number(m.size) || 56));
  return { id: m.id, content, color: m.color, size, x: clamp01(m.x), y: clamp01(m.y) };
}

// ---------- WebSocket ----------
const server = http.createServer(handleHttp);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });

function broadcast(msg, except = null) {
  const data = JSON.stringify(msg);
  for (const c of wss.clients) if (c !== except && c.readyState === 1) c.send(data);
}

function fullState() {
  return { type: 'state', state: store.get(), config: clientConfig(), paintings: listPaintings() };
}

// Shared by WebSocket messages and the HTTP API, so the laptop CLI can do the same things later.
function apply(msg, from = null) {
  switch (msg?.type) {
    case 'draw': {
      const d = cleanDraw(msg); if (!d) return false;
      store.addStrokePoints(d); broadcast({ type: 'draw', ...d }, from); return true;
    }
    case 'text': {
      const t = cleanText(msg); if (!t) return false;
      store.addText(t); broadcast({ type: 'text', ...t }); return true;
    }
    case 'undo': store.undo(); broadcast({ type: 'notes', notes: store.get().notes }); return true;
    case 'clear': store.clear(); broadcast({ type: 'notes', notes: store.get().notes }); return true;
    case 'mode':
      if (!store.setMode(msg.mode, 'manual')) return false;
      log('mode ->', msg.mode); broadcast({ type: 'mode', mode: msg.mode }); return true;
    case 'nextPainting': broadcast({ type: 'nextPainting' }); return true;
    default: return false;
  }
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  log('ws connect', req.socket.remoteAddress, `(${wss.clients.size} open)`);
  ws.send(JSON.stringify(fullState()));

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'ping') { ws.send('{"type":"pong"}'); return; }
    apply(msg, ws);
  });
  ws.on('close', () => log('ws close', `(${wss.clients.size} open)`));
});

// Drop connections that vanished without saying goodbye (e.g. TV switched off).
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 30_000);

// ---------- optional painting schedule ----------
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export function inWindow(nowMin, start, end) {
  const s = toMin(start), e = toMin(end);
  return s <= e ? nowMin >= s && nowMin < e : nowMin >= s || nowMin < e; // handles overnight
}
let wasInWindow = null;
const schedule = setInterval(checkSchedule, 30_000);
function checkSchedule() {
  const { autoStart, autoEnd } = config.painting;
  if (!autoStart || !autoEnd) return;
  const d = new Date();
  const now = inWindow(d.getHours() * 60 + d.getMinutes(), autoStart, autoEnd);
  if (now === wasInWindow) return;                 // only act when the window starts or ends
  wasInWindow = now;
  const s = store.get();
  if (now && s.mode !== 'painting') { store.setMode('painting', 'schedule'); broadcast({ type: 'mode', mode: 'painting' }); log('schedule: painting on'); }
  if (!now && s.mode === 'painting' && s.modeSource === 'schedule') { store.setMode('home', 'schedule'); broadcast({ type: 'mode', mode: 'home' }); log('schedule: painting off'); }
}

// ---------- HTTP ----------
async function handleHttp(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);

  try {
    if (p === '/api/state' && req.method === 'GET') return sendJson(res, 200, fullState());
    if (p === '/api/info' && req.method === 'GET') return sendJson(res, 200, { urls: lanUrls(config.port), port: config.port });
    if (p === '/api/paintings') return sendJson(res, 200, listPaintings());
    if (p === '/api/weather') {
      try { return sendJson(res, 200, await getWeather(config.weather)); }
      catch (e) { log('weather error:', e.message); return sendJson(res, 502, { error: 'weather unavailable' }); }
    }
    // POST /api/action {type:'mode', mode:'painting'} etc. Same messages as the WebSocket.
    if (p === '/api/action' && req.method === 'POST') {
      const ok = apply(await readJsonBody(req));
      return sendJson(res, ok ? 200 : 400, { ok });
    }
    if (p.startsWith('/api/')) return sendJson(res, 404, { error: 'not found' });

    // Static files
    if (p === '/') { res.writeHead(302, { Location: '/tv/' }); return res.end(); }
    if (p === '/tv' || p === '/phone') { res.writeHead(302, { Location: p + '/' }); return res.end(); }
    let file = path.resolve(config.publicDir, '.' + p);
    if (!file.startsWith(config.publicDir + path.sep)) { res.writeHead(403); return res.end(); } // no ../ escapes
    if (p.endsWith('/')) file = path.join(file, 'index.html');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': TYPES[ext] || 'application/octet-stream',
        // pages and scripts always fresh (so updates show up), images cached a day
        'Cache-Control': IMAGE_EXT.has(ext) ? 'public, max-age=86400' : 'no-cache',
      });
      fs.createReadStream(file).pipe(res);
    });
  } catch (e) {
    sendJson(res, 400, { error: e.message });
  }
}

server.listen(config.port, '0.0.0.0', () => {
  log(`TV dashboard running on port ${config.port}`);
  for (const u of lanUrls(config.port)) log(`  TV:    ${u}/tv/\n           Phone: ${u}/phone/`);
  log(`  Local: http://localhost:${config.port}/tv/`);
  checkSchedule();
});

function shutdown() {
  clearInterval(heartbeat); clearInterval(schedule);
  wss.close(); server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
