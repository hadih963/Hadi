// Draws notes (strokes + texts) onto a <canvas>. Shared by the TV and the phone so
// both look identical. Coordinates are 0..1 of a 16:9 board; sizes are in
// "1920-wide board pixels" and scale with the board.
export const BOARD_W = 1920;

export function fitCanvas(canvas) {
  // Match the canvas bitmap to its on-screen size (sharp on phones with DPR 2-3).
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  return { w: canvas.width, h: canvas.height };
}

// Draw a stroke, optionally only from point index `from` (used for live updates).
export function drawStroke(ctx, stroke, w, h, from = 0) {
  const pts = stroke.points;
  if (!pts.length) return;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.size * (w / BOARD_W);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (pts.length === 1) {          // a tap = a dot
    ctx.beginPath();
    ctx.arc(pts[0][0] * w, pts[0][1] * h, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const start = Math.max(0, from - 1);   // reconnect to the previous point
  ctx.beginPath();
  ctx.moveTo(pts[start][0] * w, pts[start][1] * h);
  for (let i = start + 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
  ctx.stroke();
}

export function drawText(ctx, t, w, h) {
  ctx.fillStyle = t.color;
  ctx.font = `600 ${t.size * (w / BOARD_W)}px system-ui, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.content, t.x * w, t.y * h);
}

export function renderAll(ctx, notes, w, h) {
  ctx.clearRect(0, 0, w, h);
  // Draw in creation order so texts and strokes overlap the way they were made.
  const items = [
    ...notes.strokes.map((s) => ({ k: 's', t: s.t ?? 0, v: s })),
    ...notes.texts.map((x) => ({ k: 't', t: x.t ?? 0, v: x })),
  ].sort((a, b) => a.t - b.t);
  for (const it of items) it.k === 's' ? drawStroke(ctx, it.v, w, h) : drawText(ctx, it.v, w, h);
}

// Keeps a local copy of the notes in sync with server messages and redraws efficiently.
export function createNotesView(canvas) {
  const ctx = canvas.getContext('2d');
  let notes = { strokes: [], texts: [] };
  let size = fitCanvas(canvas);

  const redraw = () => renderAll(ctx, notes, size.w, size.h);

  return {
    get notes() { return notes; },
    isEmpty: () => !notes.strokes.length && !notes.texts.length,
    set(n) { notes = { strokes: n.strokes || [], texts: n.texts || [] }; redraw(); },
    resize() { size = fitCanvas(canvas); redraw(); },
    // Apply a chunk of points: only the new part is drawn (cheap on a slow TV).
    addPoints({ id, color, size: s, points }) {
      let st = notes.strokes.find((x) => x.id === id);
      if (!st) { st = { id, color, size: s, points: [], t: Date.now() }; notes.strokes.push(st); }
      const from = st.points.length;
      st.points.push(...points);
      drawStroke(ctx, st, size.w, size.h, from);
    },
    addText(t) {
      notes.texts.push({ ...t, t: Date.now() });
      drawText(ctx, t, size.w, size.h);
    },
  };
}
