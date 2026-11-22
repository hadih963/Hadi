// TV screen logic: live notes, clock, weather, painting mode and remote-control navigation.
import { connect } from '../shared/ws-client.js';
import { createNotesView } from '../shared/notes-render.js';
import { iconSvg } from '../shared/icons.js';

const $ = (id) => document.getElementById(id);
const notes = createNotesView($('notes'));

let mode = 'home';
let config = { nightDimStart: null, nightDimEnd: null, rotateMinutes: 30 };
let paintings = [];
let paintingIndex = 0;
let lastWeather = null;
const timers = { drift: null, rotate: null };

// ---------------- connection ----------------
const conn = connect({
  onStatus(online) {
    $('status').classList.toggle('online', online);
    $('status-text').textContent = online ? 'Connected' : 'Reconnecting…';
  },
  onMessage(msg) {
    switch (msg.type) {
      case 'state':
        config = { ...config, ...msg.config };
        paintings = msg.paintings || [];
        notes.set(msg.state.notes);
        setMode(msg.state.mode);
        break;
      case 'draw': notes.addPoints(msg); noteArrived(); break;
      case 'text': notes.addText(msg); noteArrived(); break;
      case 'notes': notes.set(msg.notes); updateEmpty(); break;
      case 'mode': setMode(msg.mode); break;
      case 'nextPainting': showPainting(paintingIndex + 1); break;
    }
  },
});

function updateEmpty() { $('board-empty').hidden = !notes.isEmpty(); }
function noteArrived() {
  updateEmpty();
  if (mode === 'painting') $('p-note').hidden = false;   // quiet hint, no mode change
}

// ---------------- clock (updates once a minute, exactly on the minute) ----------------
const fmtTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function tick() {
  const now = new Date();
  $('time').textContent = $('p-time').textContent = fmtTime.format(now);
  $('date').textContent = fmtDate.format(now);
  $('p-date').textContent = fmtShort.format(now);
  applyNightDim(now);
  setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
}

// ---------------- weather (server caches; we ask every 10 min) ----------------
async function loadWeather() {
  try {
    const res = await fetch('/api/weather');
    if (!res.ok) throw new Error();
    renderWeather(await res.json());
  } catch {
    if (!lastWeather) $('w-label').textContent = 'Weather unavailable';
  }
  setTimeout(loadWeather, 10 * 60_000);
}

function renderWeather(w) {
  lastWeather = w;
  $('w-icon').innerHTML = iconSvg(w.icon, w.isDay);
  $('w-temp').textContent = w.temp;
  $('w-label').textContent = w.label;
  $('w-meta').innerHTML =
    `<span><b>${w.city}</b></span><span>H <b>${w.high}°</b></span><span>L <b>${w.low}°</b></span><span>Feels <b>${w.feelsLike}°</b></span><span>Wind <b>${w.wind}</b> km/h</span>`;
  $('w-hours').innerHTML = w.hours.map((h) => `
    <div class="w-hour">
      <div class="h-time">${h.time}</div>
      <svg viewBox="0 0 64 64" aria-hidden="true">${iconSvg(h.icon, true)}</svg>
      <div>${h.temp}°</div>
      <div class="h-rain">${h.rainChance ? h.rainChance + '%' : ''}</div>
    </div>`).join('');
  $('p-weather').textContent = `${w.temp}° ${w.label}`;
}

// ---------------- phone link shown on the empty board ----------------
async function showPhoneUrl() {
  let base = location.origin;
  if (/^(localhost|127\.)/.test(location.hostname)) {
    try { base = (await (await fetch('/api/info')).json()).urls[0] || base; } catch {}
  }
  $('phone-url').textContent = base.replace(/^https?:\/\//, '') + '/phone/';
}

// ---------------- painting mode ----------------
function setMode(next) {
  mode = next === 'painting' ? 'painting' : 'home';
  const painting = mode === 'painting';
  document.body.classList.toggle('mode-painting', painting);
  document.body.classList.toggle('mode-home', !painting);
  $('home').hidden = painting;
  $('painting').hidden = !painting;

  clearInterval(timers.drift); clearInterval(timers.rotate);
  if (painting) {
    $('p-note').hidden = true;
    showPainting(paintingIndex);
    drift();
    timers.drift = setInterval(drift, 3 * 60_000);                      // move UI every 3 min
    timers.rotate = setInterval(() => showPainting(paintingIndex + 1), (config.rotateMinutes || 30) * 60_000);
  } else {
    notes.resize();      // canvas was hidden; measure it again
    updateEmpty();
    focusFirst();
  }
}

function showPainting(i) {
  const list = paintings.length ? paintings : ['/paintings/00-dusk-polder.svg'];
  paintingIndex = ((i % list.length) + list.length) % list.length;
  const src = list[paintingIndex];
  $('painting-img').src = src;
  $('caption').textContent = titleFromFile(src);
}

function titleFromFile(src) {
  return decodeURIComponent(src.split('/').pop())
    .replace(/\.[a-z0-9]+$/i, '').replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Anti-retention drift: shift the whole layer by up to ±12 px. No animation (saves power).
function drift() {
  const r = () => Math.round((Math.random() * 2 - 1) * 12);
  const x = r(), y = r();
  $('drift').style.transform = `translate(${x}px, ${y}px)`;
  $('painting-img').style.transform = `translate(${-x}px, ${-y}px)`;
}

const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
function inWindow(now, start, end) {
  if (!start || !end) return false;
  const n = now.getHours() * 60 + now.getMinutes(), s = toMin(start), e = toMin(end);
  return s <= e ? n >= s && n < e : n >= s || n < e;
}
function applyNightDim(now) {
  const night = inWindow(now, config.nightDimStart, config.nightDimEnd);
  document.body.classList.toggle('night', night);
  $('painting-shade').style.opacity = night ? '0.72' : '0.45';
}

// ---------------- remote control: arrow keys move focus, OK presses ----------------
const KEY = {
  LEFT: [37], UP: [38], RIGHT: [39], DOWN: [40], OK: [13],
  BACK: [8, 27, 461, 10009], RED: [403], GREEN: [404],
};
const is = (code, name) => KEY[name].includes(code);

function focusables() { return [...document.querySelectorAll('[data-nav]')].filter((el) => el.offsetParent); }
function focusFirst() { const f = focusables()[0]; if (f && !f.contains(document.activeElement)) f.focus(); }

// Spatial navigation: pick the closest element in the pressed direction.
function moveFocus(dir) {
  const items = focusables();
  const cur = document.activeElement;
  if (!items.includes(cur)) return focusFirst();
  const a = cur.getBoundingClientRect();
  const ac = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  let best = null, bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ac.x, dy = b.top + b.height / 2 - ac.y;
    const ok = { LEFT: dx < -1, RIGHT: dx > 1, UP: dy < -1, DOWN: dy > 1 }[dir];
    if (!ok) continue;
    const main = dir === 'LEFT' || dir === 'RIGHT' ? Math.abs(dx) : Math.abs(dy);
    const cross = dir === 'LEFT' || dir === 'RIGHT' ? Math.abs(dy) : Math.abs(dx);
    const score = main + cross * 2;        // prefer elements in a straight line
    if (score < bestScore) { bestScore = score; best = el; }
  }
  best?.focus();
}

function act(action) {
  if (action === 'painting') conn.send({ type: 'mode', mode: mode === 'painting' ? 'home' : 'painting' });
  if (action === 'undo') conn.send({ type: 'undo' });
  if (action === 'clear') conn.send({ type: 'clear' });
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) act(el.dataset.action);
});

document.addEventListener('keydown', (e) => {
  const k = e.keyCode;
  if (mode === 'painting') {
    // Any button wakes the dashboard, like a screensaver.
    e.preventDefault();
    conn.send({ type: 'mode', mode: 'home' });
    return;
  }
  if (is(k, 'RED') || e.key === 'p') { e.preventDefault(); act('painting'); return; }
  for (const dir of ['LEFT', 'RIGHT', 'UP', 'DOWN']) {
    if (is(k, dir)) { e.preventDefault(); moveFocus(dir); return; }
  }
  if (is(k, 'BACK')) e.preventDefault();   // don't let Back close the app/tab by accident
});

// Scale the 1920x1080 stage to fit any screen: TV, laptop window or a phone being mirrored.
function fitStage() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  $('stage').style.transform = `scale(${s})`;
  notes.resize();
}
window.addEventListener('resize', fitStage);
fitStage();

// ---------------- when a phone shows this page (to mirror it to the TV) ----------------
// 1) First tap: go full screen and turn to landscape, so the mirrored image fills the TV.
// 2) Wake lock: keep the phone screen on, because mirroring stops when the screen sleeps.
//    (Wake lock only works on https or localhost, i.e. when the server runs on that phone.)
if (matchMedia('(pointer: coarse)').matches) {
  document.addEventListener('pointerdown', async () => {
    if (document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      await screen.orientation?.lock?.('landscape');
    } catch { /* not allowed here: fine, the installed app is already full screen */ }
  });
}
async function keepAwake() {
  try { if (document.visibilityState === 'visible') await navigator.wakeLock?.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', keepAwake);
keepAwake();

// ---------------- start ----------------
tick();
loadWeather();
showPhoneUrl();
focusFirst();
