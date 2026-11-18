// Deterministic screenshot staging for Solara Bay. Each ?shot= scene plays
// the real rules forward a fixed number of 1/60 s steps from a seeded start,
// refreshes the HUD (so the minimap, stars and objective are actually drawn —
// the normal frame loop never runs in shot mode), renders, and sets
// window.__shotReady. No input is needed: the autopilot drives, the police
// chase, and the mission runs itself.
//
// Diagnosis notes (18 Nov): the first staging attempt never set __shotReady
// in this VM's headless Chrome because the page itself never loaded there —
// every navigation to localhost is refused with
// ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS, so no game code ran at all.
// Two code-level traps were fixed along the way so staging is robust once the
// page does load: (1) the HUD was never refreshed in shot mode, leaving the
// minimap blank and the stars/objective stale; (2) the ready flag depended
// solely on requestAnimationFrame, which never fires in a backgrounded or
// throttled tab — a setTimeout fallback now finishes the shot regardless.
const STEP = 1 / 60;

function settle(game, steps) {
  for (let i = 0; i < steps; i++) game.step(STEP, true);
}

// Staging only: tow the traffic sitting on the downtown avenue (x≈0) so the
// autopilot gets a clean run at speed instead of a 1 MPH traffic jam.
// Cross-traffic and pedestrians stay, so the street is still alive.
function clearAvenue(game) {
  for (const c of [...game.vehicles.cars]) {
    if (c.isTraffic && Math.abs(c.x) < 10 && c.z > -130 && c.z < 175) game.vehicles.removeCar(c);
  }
}

export function stageShot(name, game) {
  const G = game.state;
  console.log('[shot] staging', name);
  game.hud.hideOverlay();
  game.hud.hideWasted();
  game.hud.showHud();
  game.startPlay(true);

  if (name === 'start') {
    // Title screen over a golden-hour view down Marina Row toward the sea.
    // Ren Maro stands right of the centered title panel (aim offset), close
    // enough to read: red hair, maroon robe, gold hex emblem.
    G.player.teleport(-20, 96, Math.PI);
    G.cameraRig.rig.yaw = Math.PI;
    G.cameraRig.rig.pitch = 0.2;
    G.cameraDistance = 15;
    G.aimOffset = { x: -9, z: 0 };
    settle(game, 30);
    game.hud.showOverlay('start');
  } else if (name === 'play') {
    // Driving the Vanta GT hero car through downtown traffic, HUD and minimap live.
    // 200 steps with the overtake swing in the autopilot: mid-avenue at speed.
    const car = game.enterCarForShot(Math.PI);
    G.playerCar = car;
    clearAvenue(game);
    game.autopilot = { throttle: true, steerTo: { x: 0, z: -120 } };
    settle(game, 200);
    game.autopilot = null;
  } else if (name === 'chase') {
    // Three-star wanted level: two cruisers on the tail, siren on.
    // The getaway runs south down the downtown avenue to the beachfront —
    // steering at the marina instead cut straight through the blocks and
    // wedged the car between buildings. Heading 0: no U-turn, the car is
    // already pointing at the beachfront when the sirens start.
    const car = game.enterCarForShot(0);
    G.playerCar = car;
    game.police.setWanted(3);
    clearAvenue(game);
    game.autopilot = { throttle: true, steerTo: { x: 0, z: 116 } };
    settle(game, 200);
    game.autopilot = null;
  } else if (name === 'mission') {
    // Mission 2 in progress: the package run to Coral Pier, objective on HUD.
    game.missions.startMission(1);
    const car = game.enterCarForShot(0);
    G.playerCar = car;
    // Complete the garage pickup first, so the shot shows the pier run itself.
    game.missions.update({ x: -58, z: -58 }, car, { enemiesLeft: 0 });
    clearAvenue(game);
    game.autopilot = { throttle: true, steerTo: { x: 0, z: 168 } };
    settle(game, 170);
    game.autopilot = null;
    game.hud.setDialogue(['Marla Reyes', 'The buyer is waiting at the end of Coral Pier. Do not stop for anyone in a uniform.']);
  }
  console.log('[shot] settled', name);

  // Aim the camera at the action, refresh the HUD, then paint and freeze.
  // The ready flag is set after two animation frames, or by a timeout
  // fallback if requestAnimationFrame never fires in this tab.
  let painted = 0;
  let ready = false;
  function finish() {
    if (ready) return;
    ready = true;
    game.syncCamera(0);
    game.refreshHud();
    game.renderer.render(game.scene, game.camera);
    window.__shotReady = true;
    game.frozen = true;
    console.log('[shot] ready', name);
    // Keep presenting the frozen frame: a one-off render never reaches the
    // compositor in this VM's headless Chrome (captures came out black with
    // only the DOM HUD visible), so re-render every animation frame until
    // the tab goes away. The scene itself never advances — frozen means frozen.
    (function present() {
      if (!game.frozen) return;
      game.renderer.render(game.scene, game.camera);
      requestAnimationFrame(present);
    })();
  }
  function paint() {
    if (ready) return;
    game.syncCamera(0);
    game.refreshHud();
    game.renderer.render(game.scene, game.camera);
    painted += 1;
    if (painted >= 2) finish();
    else requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
  window.setTimeout(finish, 6000);
}
