// Keyboard + mouse state. The game polls `keys` each frame; one-shot actions go through
// `pressed` (consumed by the reader) so a tap is never seen twice.
export const keys = {};
export const pressed = {};
export const mouse = { dx: 0, dy: 0, down: false, clicked: false };

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyE', 'KeyP', 'KeyM', 'Space', 'Enter', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  addEventListener('mousemove', (e) => { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; });
}

export function takePress(code) {
  const hit = !!pressed[code];
  pressed[code] = false;
  return hit;
}

export function endFrame() {
  mouse.dx = 0; mouse.dy = 0; mouse.clicked = false;
  for (const k in pressed) pressed[k] = false;
}
