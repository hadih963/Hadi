// Phone drawing pad. Every few milliseconds the new points of the current stroke are
// sent to the server, which forwards them to the TV: that is what makes it "live".
import { connect } from '../shared/ws-client.js';
import { createNotesView } from '../shared/notes-render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('board');
const view = createNotesView(canvas);

const COLORS = ['#ffffff', '#ffcf5c', '#ff7a7a', '#ff9de2', '#7cc4ff', '#7ee2a8', '#b69cff', '#ff9f43'];
let color = COLORS[0];
let size = 6;
let tool = 'pen';
let tvMode = 'home';

const conn = connect({
  onStatus: (online) => $('conn').classList.toggle('online', online),
  onMessage(msg) {
    if (msg.type === 'state') { view.set(msg.state.notes); setTvMode(msg.state.mode); }
    if (msg.type === 'draw') view.addPoints(msg);       // someone else drawing (2nd phone)
    if (msg.type === 'text') view.addText(msg);
    if (msg.type === 'notes') view.set(msg.notes);      // after undo / clear
    if (msg.type === 'mode') setTvMode(msg.mode);
  },
});

// ---------- tool bar ----------
const colorsEl = $('colors');
for (const c of COLORS) {
  const b = document.createElement('button');
  b.style.background = c; b.setAttribute('aria-label', c); b.dataset.color = c;
  if (c === color) b.classList.add('active');
  colorsEl.append(b);
}
colorsEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-color]'); if (!b) return;
  color = b.dataset.color;
  colorsEl.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
});
document.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => {
  size = Number(b.dataset.size);
  document.querySelectorAll('[data-size]').forEach((x) => x.classList.toggle('active', x === b));
}));
document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => {
  tool = b.dataset.tool;
  document.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('active', x === b));
  $('pen-opts').hidden = tool !== 'pen';
  $('text-opts').hidden = tool !== 'text';
  if (tool === 'text') $('text-input').focus();
}));

$('undo').onclick = () => conn.send({ type: 'undo' });
$('clear').onclick = () => { if (confirm('Clear all notes on the TV?')) conn.send({ type: 'clear' }); };
$('painting').onclick = () => conn.send({ type: 'mode', mode: tvMode === 'painting' ? 'home' : 'painting' });
$('next').onclick = () => conn.send({ type: 'nextPainting' });

function setTvMode(m) {
  tvMode = m;
  $('painting').textContent = m === 'painting' ? 'Back to dashboard' : 'Painting mode';
}

// ---------- drawing ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let current = null;      // { id, pending: [[x,y],...] }
let flushTimer = null;

function pos(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
}

function flush() {
  flushTimer = null;
  if (!current || !current.pending.length) return;
  conn.send({ type: 'draw', id: current.id, color, size, points: current.pending });
  current.pending = [];
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pos(e);
  if (tool === 'text') return placeText(p);
  canvas.setPointerCapture(e.pointerId);
  current = { id: uid(), pending: [] };
  addPoint(p);
});

canvas.addEventListener('pointermove', (e) => {
  if (!current) return;
  // getCoalescedEvents gives all touch samples between frames: smoother lines.
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of evs.length ? evs : [e]) addPoint(pos(ev));
});

const end = () => { if (current) { flush(); current = null; } };
canvas.addEventListener('pointerup', end);
canvas.addEventListener('pointercancel', end);

let last = null;
function addPoint(p) {
  // Skip points closer than ~1 TV pixel to the previous one: less data, same look.
  if (last && current.pending.length && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.0006) return;
  last = p;
  view.addPoints({ id: current.id, color, size, points: [p] });   // draw locally right away
  current.pending.push(p);
  if (!flushTimer) flushTimer = setTimeout(flush, 40);             // ~25 updates/s to the TV
}

function placeText([x, y]) {
  const content = $('text-input').value.trim();
  if (!content) { $('text-input').focus(); return; }
  conn.send({ type: 'text', id: uid(), content, color, size: Number($('text-size').value), x, y });
  $('text-input').value = '';
}

window.addEventListener('resize', () => view.resize());
