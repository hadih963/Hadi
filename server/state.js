// The single source of truth: what the TV should show.
// Kept in memory and saved to data/state.json (debounced) so a restart keeps your notes.
import fs from 'node:fs';
import path from 'node:path';

const MAX_STROKES = 1500;      // keeps the file and TV memory small
const MAX_POINTS = 4000;       // per stroke
const MAX_TEXTS = 100;

export function createStore(file) {
  let state = {
    mode: 'home',              // 'home' | 'painting'
    modeSource: 'manual',      // 'manual' | 'schedule'
    notes: { strokes: [], texts: [] },
  };

  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    state = { ...state, ...saved, notes: { ...state.notes, ...saved.notes } };
  } catch {
    // first run or unreadable file: start empty
  }

  let timer = null;
  function save() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, file); // atomic replace: no half-written file on crash
    }, 500);
  }

  return {
    get: () => state,

    setMode(mode, source = 'manual') {
      if (mode !== 'home' && mode !== 'painting') return false;
      state.mode = mode;
      state.modeSource = source;
      save();
      return true;
    },

    // A stroke arrives in chunks while the finger moves; merge chunks by id.
    addStrokePoints({ id, color, size, points }) {
      let s = state.notes.strokes.find((x) => x.id === id);
      if (!s) {
        s = { id, color, size, points: [], t: Date.now() };
        state.notes.strokes.push(s);
        if (state.notes.strokes.length > MAX_STROKES) state.notes.strokes.shift();
      }
      if (s.points.length + points.length <= MAX_POINTS) s.points.push(...points);
      save();
    },

    addText(text) {
      state.notes.texts.push({ ...text, t: Date.now() });
      if (state.notes.texts.length > MAX_TEXTS) state.notes.texts.shift();
      save();
    },

    // Undo removes the most recent item, stroke or text.
    undo() {
      const { strokes, texts } = state.notes;
      const ls = strokes.at(-1), lt = texts.at(-1);
      if (!ls && !lt) return;
      if (!lt || (ls && (ls.t ?? 0) >= (lt.t ?? 0))) strokes.pop();
      else texts.pop();
      save();
    },

    clear() {
      state.notes = { strokes: [], texts: [] };
      save();
    },
  };
}
