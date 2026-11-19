// Progress lives in localStorage: cash, the story stage reached, and whether the story
// is finished. Saved on every mission turn and on pause; the menu's Continue button
// appears when a save exists.
const KEY = 'neonharbor-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function writeSave(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: play unsaved */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
