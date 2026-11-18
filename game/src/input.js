// Keyboard + mouse input for Solara Bay. WASD drive and walk, mouse drag orbits
// the third-person camera, click attacks. Edge-triggered "pressed" keys are
// consumed once per frame by the game loop. E near a parked car gets in —
// the Vanta GT on Marina Row is fair game, driver and all.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const look = { dx: 0, dy: 0 };
  let firing = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); pressed.clear(); firing = false; dragging = false; });

  canvas.addEventListener('mousedown', (event) => {
    dragging = true; lastX = event.clientX; lastY = event.clientY;
    firing = true;
  });
  window.addEventListener('mouseup', () => { dragging = false; firing = false; });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    look.dx += event.clientX - lastX;
    look.dy += event.clientY - lastY;
    lastX = event.clientX; lastY = event.clientY;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys,
    get firing() { return firing; },
    takeLook() { const out = { dx: look.dx, dy: look.dy }; look.dx = 0; look.dy = 0; return out; },
    wasPressed(code) {
      if (pressed.has(code)) { pressed.delete(code); return true; }
      return false;
    },
    consumePressed() { pressed.clear(); },
  };
}
