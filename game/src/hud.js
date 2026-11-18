// The HUD: cash, health and armor bars, wanted stars, mission objective,
// speedometer, weapon line, dialogue box, toasts, and the live minimap — a
// round canvas that draws the avenue grid, the beach, and blips for the
// player, the police, traffic and the mission target every frame.
import { AVENUES, CITY_HALF } from './city.js';

const RANKS = ['ROOKIE', 'HUSTLER', 'STREET BOSS', 'BAY LEGEND'];

export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('cash');
  const respectEl = el('respect');
  const hpFill = el('hp-fill');
  const armorFill = el('armor-fill');
  const starsEl = el('stars');
  const objectiveTitle = el('objective-title');
  const objectiveText = el('objective-text');
  const objectiveDist = el('objective-dist');
  const speedNum = el('speed-num');
  const vehicleName = el('vehicle-name');
  const weaponLine = el('weapon-line');
  const crosshair = el('crosshair');
  const dialogue = el('dialogue');
  const dialogueName = el('dialogue-name');
  const dialogueText = el('dialogue-text');
  const toast = el('toast');
  const toastTitle = el('toast-title');
  const toastSub = el('toast-sub');
  const hint = el('hint');
  const overlay = el('overlay');
  const overlayCopy = el('overlay-copy');
  const overlayTitle = el('overlay-title');
  const playBtn = el('play');
  const continueBtn = el('continue');
  const hud = el('hud');
  const dmg = el('dmg');
  const wasted = el('wasted');
  const wastedText = el('wasted-text');
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');

  let toastTimer = null;
  let hintTimer = null;

  function showToast(title, sub, kind) {
    toastTitle.textContent = title;
    toastSub.textContent = sub || '';
    toast.className = kind || '';
    toast.hidden = false;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function showHint(text, ms = 3500) {
    hint.textContent = text;
    hint.hidden = false;
    if (hintTimer) window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => { hint.hidden = true; }, ms);
  }

  function setDialogue(line) {
    if (!line) { dialogue.hidden = true; return; }
    dialogueName.textContent = line[0];
    dialogueText.textContent = line[1];
    dialogue.hidden = false;
  }

  function setStars(n) {
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="${i < n ? '' : 'off'}">★</span>`;
    starsEl.innerHTML = html;
  }

  function setCash(cash, missionsDone) {
    cashEl.textContent = `$${cash.toLocaleString('en-US')}`;
    const rank = RANKS[Math.min(missionsDone, RANKS.length - 1)];
    respectEl.textContent = `SOLARA BAY · ${rank}`;
  }

  function setHealth(health, armor) {
    hpFill.style.width = `${Math.max(0, health)}%`;
    armorFill.style.width = `${Math.max(0, armor)}%`;
  }

  function setObjective(title, text, distText) {
    objectiveTitle.textContent = title;
    objectiveText.textContent = text;
    objectiveDist.textContent = distText || '';
  }

  function setSpeed(mph, name, weaponText, showCrosshair) {
    speedNum.textContent = String(Math.round(mph));
    vehicleName.textContent = name;
    weaponLine.textContent = weaponText;
    crosshair.hidden = !showCrosshair;
  }

  function flashDamage() {
    dmg.style.opacity = '0.6';
    window.setTimeout(() => { dmg.style.opacity = '0'; }, 160);
  }

  function showOverlay(mode, copy) {
    overlay.hidden = false;
    if (mode === 'start') {
      overlayTitle.innerHTML = 'SOLARA <em>BAY</em>';
      overlayCopy.textContent = 'Sun, salt and stolen cars. You are Ren Maro — tall, red-haired, in a long maroon robe with a gold hex on his chest — fresh off the night bus with $250 and a name to make. Marla Reyes runs the Marina Row garage — do her jobs, dodge the Bay PD, and own this city one street at a time.';
      playBtn.textContent = 'Start the story';
    } else if (mode === 'paused') {
      overlayTitle.innerHTML = 'PAUSED';
      overlayCopy.textContent = copy || 'The city waits. Your save is safe — progress is stored on this machine.';
      playBtn.textContent = 'Keep playing';
    } else if (mode === 'busted') {
      overlayTitle.innerHTML = 'BUSTED';
      overlayCopy.textContent = copy || 'The Bay PD caught up with you.';
      playBtn.textContent = 'Back on the streets';
    }
  }

  function hideOverlay() { overlay.hidden = true; }
  function showHud() { hud.hidden = false; }
  function hideHud() { hud.hidden = true; }
  function showWasted(text) { wastedText.textContent = text; wasted.hidden = false; }
  function hideWasted() { wasted.hidden = true; }

  // Minimap: north is up, the player stays centered, the world rotates around
  // them. Drawn at 196 px, clipped to a circle by the CSS border-radius.
  function drawMinimap(state) {
    const size = 196;
    const range = 150; // metres shown from edge to edge
    const scale = size / (range * 2);
    const px = (x) => size / 2 + (x - state.playerX) * scale;
    const pz = (z) => size / 2 + (z - state.playerZ) * scale;
    mctx.clearRect(0, 0, size, size);
    mctx.fillStyle = '#274b5c';
    mctx.fillRect(0, 0, size, size);
    // Beach + sea to the south.
    mctx.fillStyle = '#e8c98a';
    mctx.fillRect(0, pz(150), size, size - pz(150));
    mctx.fillStyle = '#1b8a9e';
    mctx.fillRect(0, pz(172), size, size - pz(172));
    // Roads.
    mctx.strokeStyle = '#3a3f46';
    mctx.lineWidth = 9;
    for (const a of AVENUES) {
      mctx.beginPath(); mctx.moveTo(px(-CITY_HALF), pz(a)); mctx.lineTo(px(CITY_HALF), pz(a)); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(px(a), pz(-CITY_HALF)); mctx.lineTo(px(a), pz(CITY_HALF)); mctx.stroke();
    }
    mctx.strokeStyle = '#ffd23f';
    mctx.lineWidth = 1;
    for (const a of AVENUES) {
      mctx.beginPath(); mctx.moveTo(px(-CITY_HALF), pz(a)); mctx.lineTo(px(CITY_HALF), pz(a)); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(px(a), pz(-CITY_HALF)); mctx.lineTo(px(a), pz(CITY_HALF)); mctx.stroke();
    }
    // Landmarks.
    mctx.fillStyle = '#ff6b4a';
    for (const lm of state.landmarks) {
      mctx.beginPath(); mctx.arc(px(lm.x), pz(lm.z), 3, 0, Math.PI * 2); mctx.fill();
    }
    // Mission target: pulsing yellow diamond.
    if (state.missionTarget) {
      const pulse = 5 + Math.sin(state.time * 4) * 2;
      mctx.fillStyle = '#ffd23f';
      mctx.save();
      mctx.translate(px(state.missionTarget.x), pz(state.missionTarget.z));
      mctx.rotate(Math.PI / 4);
      mctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      mctx.restore();
    }
    // Traffic: white dots. Police: red dots. Enemies: dark red.
    // The parked Vanta GT hero car: a gold dot, so the player can find it.
    mctx.fillStyle = '#ffffff';
    for (const c of state.traffic) { mctx.beginPath(); mctx.arc(px(c.x), pz(c.z), 2.5, 0, Math.PI * 2); mctx.fill(); }
    if (state.heroCar) {
      mctx.fillStyle = '#ffd23f';
      mctx.beginPath(); mctx.arc(px(state.heroCar.x), pz(state.heroCar.z), 4, 0, Math.PI * 2); mctx.fill();
    }
    mctx.fillStyle = '#ff3b30';
    for (const c of state.policeCars) { mctx.beginPath(); mctx.arc(px(c.x), pz(c.z), 3.5, 0, Math.PI * 2); mctx.fill(); }
    mctx.fillStyle = '#ff9d00';
    for (const e of state.enemies) { mctx.beginPath(); mctx.arc(px(e.x), pz(e.z), 3, 0, Math.PI * 2); mctx.fill(); }
    // Player: white arrow pointing where they face.
    mctx.save();
    mctx.translate(size / 2, size / 2);
    mctx.rotate(state.playerHeading);
    mctx.fillStyle = '#ffffff';
    mctx.strokeStyle = '#111';
    mctx.lineWidth = 1.5;
    mctx.beginPath();
    mctx.moveTo(0, -9); mctx.lineTo(6, 7); mctx.lineTo(0, 3); mctx.lineTo(-6, 7); mctx.closePath();
    mctx.fill(); mctx.stroke();
    mctx.restore();
  }

  return {
    showToast, showHint, setDialogue, setStars, setCash, setHealth,
    setObjective, setSpeed, flashDamage, showOverlay, hideOverlay,
    showHud, hideHud, showWasted, hideWasted, drawMinimap,
    onPlayClick(handler) { playBtn.addEventListener('click', handler); },
    onContinueClick(handler) { continueBtn.addEventListener('click', handler); },
    showContinue() { continueBtn.hidden = false; },
    hideContinue() { continueBtn.hidden = true; },
  };
}
