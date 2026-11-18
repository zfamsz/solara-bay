// SOLARA BAY boot and the one loop: a fixed 60 Hz simulation feeding a render
// at the display's rate. All state lives in G; modules own one job each.
// ?shot=start|play|chase|mission with &seed=N stages a deterministic frame,
// renders it twice, freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { makeRng, clamp, angleDelta, distance2D } from './rng.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createPlayer, createCameraRig } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createEffects, createEnemies, createCombat } from './combat.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const SAVE_KEY = 'solara-bay-save-v1';
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Sunset over the bay: a pink-orange sky, warm haze, and a low sun hanging
// over the sea to the south, so the long shadows point back into the city.
scene.background = new THREE.Color(0xff9d7a);
scene.fog = new THREE.Fog(0xf7a98c, 90, 320);
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 600);

// Low golden-hour sun over the bay.
const sun = new THREE.DirectionalLight(0xffb37a, 2.6);
sun.position.set(-70, 55, 170);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -170;
sun.shadow.camera.right = 170;
sun.shadow.camera.top = 170;
sun.shadow.camera.bottom = -170;
sun.shadow.camera.far = 420;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffc9a3, 0x6b4a3a, 0.85));

// The sun itself: a bright disc with a warm glow, low over the sea, fog-free
// so it stays visible from anywhere in the city.
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(18, 32),
  new THREE.MeshBasicMaterial({ color: 0xffe3b0, fog: false }),
);
sunDisc.position.set(-160, 42, 320);
sunDisc.rotation.y = Math.PI;
scene.add(sunDisc);
const sunGlow = new THREE.Mesh(
  new THREE.CircleGeometry(34, 32),
  new THREE.MeshBasicMaterial({ color: 0xff9d7a, transparent: true, opacity: 0.35, fog: false }),
);
sunGlow.position.set(-160, 42, 321);
sunGlow.rotation.y = Math.PI;
scene.add(sunGlow);

const rng = makeRng(seed);
const city = createCity(scene, rng);
const player = createPlayer(scene, city);
const cameraRig = createCameraRig(camera);
const vehicles = createVehicles(scene, city, rng);
const peds = createPedestrians(scene, city, rng);
const police = createPolice(scene, city, vehicles, rng);
const effects = createEffects(scene);
const enemies = createEnemies(scene, rng);
const combat = createCombat(scene, effects);
const hud = createHud();
const audio = createAudio();
const input = createInput(renderer.domElement);

const G = {
  time: 0, rng,
  screen: 'start',
  cash: 250, missionsDone: 0,
  player, playerCar: null, cameraRig,
  frozen: false, autopilot: null, aimOffset: { x: 0, z: 0 }, cameraDistance: 0,
  saveTimer: 0, bustedTimer: 0,
};

const missions = createMissions(city, {
  onWanted(n) { police.setWanted(n); },
  onSpawnEnemies() {
    const docks = city.landmarks.docks;
    for (let i = 0; i < 3; i++) {
      enemies.addEnemy(docks.x + (i - 1) * 6, docks.z + (i % 2 === 0 ? 6 : -6));
    }
    return 3;
  },
  onMissionComplete(m) {
    G.cash += m.reward;
    G.missionsDone += 1;
    audio.missionDone();
    audio.cash();
    hud.showToast(`${m.title} — complete`, `+$${m.reward.toLocaleString('en-US')} · ${G.missionsDone} of 3 missions done`, 'good');
    hud.setCash(G.cash, G.missionsDone);
    saveGame();
    if (G.missionsDone < 3) {
      window.setTimeout(() => { if (G.screen === 'play') missions.startMission(G.missionsDone); }, 4500);
    } else {
      hud.showToast('SOLARA BAY IS YOURS', 'All missions complete — free roam, cause trouble, build your legend', 'gold');
    }
  },
  onObjective(title, text) { hud.setObjective(title, text, ''); },
  onDialogue(line) { hud.setDialogue(line); },
  onToast(title, sub, kind) { hud.showToast(title, sub, kind); },
});

// The orange Solano GT for mission 1, parked on Marina Row.
let missionCarSpawned = false;
function spawnMissionCar() {
  if (missionCarSpawned) return;
  missionCarSpawned = true;
  const car = vehicles.addCar(58, 116, Math.PI / 2, { parked: true, color: 0xff8c42, name: 'Solano GT' });
  car.isMissionCar = true;
}

// The Vanta GT hero car, parked on the Marina Row plaza under the palms.
let heroCar = null;
function spawnHeroCar() {
  if (heroCar) return heroCar;
  heroCar = vehicles.spawnHeroCar();
  return heroCar;
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.cash, health: player.state.health, armor: player.state.armor,
      missionsDone: G.missionsDone, missionIndex: missions.index,
      x: player.state.x, z: player.state.z, wanted: police.wanted,
    }));
  } catch { /* Storage can be off: the save then lasts this visit only. */ }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function startPlay(silent) {
  G.screen = 'play';
  hud.hideOverlay();
  hud.hideWasted();
  hud.showHud();
  if (!silent) audio.unlock();
  spawnMissionCar();
  spawnHeroCar();
  if (missions.index === 0 && !missions.active && G.missionsDone === 0) missions.startMission(0);
  hud.setCash(G.cash, G.missionsDone);
  hud.setHealth(player.state.health, player.state.armor);
  hud.setStars(police.wanted);
}

function startFromSave(save) {
  G.cash = save.cash ?? 250;
  player.state.health = save.health ?? 100;
  player.state.armor = save.armor ?? 0;
  G.missionsDone = save.missionsDone ?? 0;
  player.teleport(save.x ?? -52, save.z ?? -40, 0);
  startPlay(false);
  if (save.missionIndex < 3 && G.missionsDone < 3) missions.startMission(save.missionIndex);
  else missions.skipToFreeRoam();
  if (save.wanted) police.setWanted(save.wanted);
  hud.showToast('Welcome back, Ren', 'Save loaded — the city kept your spot warm', 'gold');
}

function enterCar(car, stolen) {
  car.isPlayer = true;
  car.parked = false;
  G.playerCar = car;
  player.group.visible = false;
  player.showDriver();
  audio.doorSlam();
  if (stolen) {
    police.addCrime(1);
    audio.steal();
    hud.showToast('Car stolen', `${car.name} is yours now — the PD noticed`, 'bad');
  } else {
    hud.showToast(car.name, 'Nice ride. W is gas, S is brake, Space is handbrake', 'gold');
  }
  hud.showHint('E — get out · Space — handbrake');
}

function exitCar() {
  const car = G.playerCar;
  if (!car) return;
  car.isPlayer = false;
  G.playerCar = null;
  player.hideDriver();
  player.teleport(car.x - Math.sin(car.heading) * 2.5, car.z - Math.cos(car.heading) * 2.5, car.heading);
  player.group.visible = true;
  audio.doorSlam();
}

function tryEnterCar() {
  const car = vehicles.nearestCar(player.state.x, player.state.z, 4.5, (c) => !c.isPolice && !c.isPlayer);
  if (!car) return false;
  if (car.driver) {
    // Steal it: the driver bails out and runs.
    car.driver = false;
    const ped = peds.addPed(car.x + 2, car.z + 2);
    peds.fleeFrom(ped, car.x, car.z);
    enterCar(car, true);
  } else {
    enterCar(car, false);
  }
  return true;
}

function damagePlayer(amount, fromX, fromZ) {
  if (player.state.health <= 0) return;
  let dmg = amount;
  if (player.state.armor > 0) {
    const absorbed = Math.min(player.state.armor, dmg * 0.5);
    player.state.armor -= absorbed;
    dmg -= absorbed;
  }
  player.state.health -= dmg;
  hud.flashDamage();
  effects.burst(player.state.x, 1.5, player.state.z, 0xff4d4d, 8, 3, 2);
  if (player.state.health <= 0) {
    player.state.health = 0;
    getBusted('The Bay PD dragged you out of the wreck. Bail cost you $200.');
  }
}

function getBusted(text) {
  G.screen = 'busted';
  police.clearAll();
  const bail = Math.min(G.cash, 200);
  G.cash -= bail;
  if (G.playerCar) { G.playerCar.isPlayer = false; G.playerCar = null; }
  player.hideDriver();
  player.group.visible = true;
  player.state.health = 100;
  player.state.armor = 0;
  player.teleport(city.landmarks.hospital.x, city.landmarks.hospital.z - 12, 0);
  audio.busted();
  audio.missionFail();
  hud.showWasted(text);
  hud.setCash(G.cash, G.missionsDone);
  window.setTimeout(() => {
    if (G.screen !== 'busted') return;
    hud.hideWasted();
    hud.showOverlay('busted', 'You woke up at St. Coral Hospital. The city is still out there.');
    G.screen = 'start';
  }, 2600);
}

function syncCamera(dt) {
  const target = G.playerCar
    ? { x: G.playerCar.x, y: 0, z: G.playerCar.z }
    : { x: player.state.x, y: 0, z: player.state.z };
  const look = input.takeLook();
  if (G.playerCar) {
    // Chase cam: settle behind the car, mouse drag adds a temporary offset.
    cameraRig.rig.yaw += angleDelta(cameraRig.rig.yaw, G.playerCar.heading) * Math.min(1, dt * 3);
    cameraRig.rig.yaw -= look.dx * 0.002;
    cameraRig.rig.pitch = clamp(cameraRig.rig.pitch + look.dy * 0.002, 0.08, 0.6);
    cameraRig.rig.distance = 12;
    camera.position.set(
      target.x - Math.sin(cameraRig.rig.yaw) * Math.cos(cameraRig.rig.pitch) * cameraRig.rig.distance,
      Math.max(2 + Math.sin(cameraRig.rig.pitch) * cameraRig.rig.distance, 1.5),
      target.z - Math.cos(cameraRig.rig.yaw) * Math.cos(cameraRig.rig.pitch) * cameraRig.rig.distance,
    );
    camera.lookAt(target.x + G.aimOffset.x, target.y + 1.6, target.z + G.aimOffset.z);
  } else {
    cameraRig.rig.distance = G.cameraDistance || 9.5;
    cameraRig.update(dt, target, look);
    // Screenshot staging can shift the aim point so the hero stands clear
    // of the centered title panel instead of behind it.
    if (G.aimOffset.x !== 0 || G.aimOffset.z !== 0) {
      camera.lookAt(target.x + G.aimOffset.x, target.y + 1.6, target.z + G.aimOffset.z);
    }
  }
}

function autopilotKeys() {
  // Drive the player car toward a waypoint: full throttle, steer to the target.
  // Overtake: if another car is dead ahead, swing around it instead of
  // pushing it down the avenue at walking pace.
  const car = G.playerCar;
  const keys = new Set(['KeyW']);
  if (!car || !G.autopilot) return keys;
  const t = G.autopilot.steerTo;
  const want = Math.atan2(t.x - car.x, t.z - car.z);
  let d = angleDelta(car.heading, want);
  const aheadX = car.x + Math.sin(car.heading) * 12;
  const aheadZ = car.z + Math.cos(car.heading) * 12;
  const blocker = vehicles.nearestCar(aheadX, aheadZ, 5, (c) => c !== car && !c.isPlayer);
  if (blocker) d += 0.9;
  if (d > 0.15) keys.add('KeyA');
  else if (d < -0.15) keys.add('KeyD');
  return keys;
}

function step(dt, silent) {
  if (G.frozen) return;
  G.time += dt;
  const keys = G.autopilot && G.playerCar ? autopilotKeys() : input.keys;

  // --- Player / car ---
  const playerPos = { x: player.state.x, z: player.state.z };
  if (G.playerCar) {
    const car = G.playerCar;
    vehicles.drivePlayer(car, dt, keys, (c) => {
      audio.skid();
      effects.burst(c.x, 0.3, c.z, 0xcccccc, 6, 2, 1);
    });
    vehicles.collideCars(car, vehicles.cars);
    playerPos.x = car.x;
    playerPos.z = car.z;
    player.state.x = car.x;
    player.state.z = car.z;
    player.state.yaw = car.heading;
    player.updateDriver(car);
    audio.setEngine(Math.abs(car.speed) / 34, true);
    // Running over a pedestrian is a crime.
    const victim = peds.nearestPed(car.x, car.z, 2.2);
    if (victim && Math.abs(car.speed) > 4) {
      effects.burst(victim.x, 1, victim.z, 0xff4d4d, 14, 3, 3);
      peds.removePed(victim);
      police.addCrime(1);
      hud.showToast('Pedestrian hit', 'Witnesses called the Bay PD', 'bad');
    }
  } else {
    player.step(dt, keys, cameraRig.rig.yaw);
    audio.setEngine(0, false);
  }

  // --- Traffic, pedestrians, police ---
  for (const car of [...vehicles.cars]) {
    if (!car.isPlayer) vehicles.stepTraffic(car, dt, G.playerCar);
  }
  peds.step(dt, null);
  const busted = police.step(dt, playerPos, G.playerCar, !G.playerCar);
  if (busted === 'busted' && !silent) getBusted('An officer cuffed you on the sidewalk. Bail cost you $200.');
  audio.setSiren(police.wanted > 0);

  // --- Enemies: chase into range, shoot on a cooldown ---
  for (const enemy of [...enemies.enemies]) {
    const d = distance2D(enemy.x, enemy.z, playerPos.x, playerPos.z);
    if (d < 45 && player.state.health > 0) {
      enemy.heading = Math.atan2(playerPos.x - enemy.x, playerPos.z - enemy.z);
      enemy.group.rotation.y = enemy.heading;
      if (d > 16) {
        enemy.x += Math.sin(enemy.heading) * 3.4 * dt;
        enemy.z += Math.cos(enemy.heading) * 3.4 * dt;
        enemy.walkPhase += dt * 8;
      }
      enemy.cooldown -= dt;
      if (enemy.cooldown <= 0 && d < 40) {
        enemy.cooldown = 1.1 + rng.next() * 0.9;
        const from = new THREE.Vector3(enemy.x, 1.4, enemy.z);
        const to = new THREE.Vector3(playerPos.x, 1.4, playerPos.z);
        effects.tracer(from, to);
        audio.distantShot();
        if (rng.next() < clamp(0.75 - d / 60, 0.15, 0.6)) damagePlayer(6 + rng.next() * 7);
      }
      enemy.group.position.set(enemy.x, 0, enemy.z);
    }
  }

  // --- Missions ---
  missions.update(playerPos, G.playerCar, { enemiesLeft: enemies.enemies.length });

  // --- Combat cooldowns, effects, sea shimmer ---
  combat.step(dt);
  effects.step(dt);
  city.sea.position.y = 0.01 + Math.sin(G.time * 0.8) * 0.05;

  // --- Autosave ---
  G.saveTimer += dt;
  if (G.saveTimer > 20) { G.saveTimer = 0; saveGame(); }
}

function enterCarForShot(heading = Math.PI) {
  // The play/chase shots drive the hero car: the matte-black Vanta GT, so
  // the screenshots show the car the brief asked for, not a traffic sedan.
  // Staging parks it on the clear downtown avenue (4, 60) — from its plaza
  // spot the autopilot wedges it against the marina landmark and the shot
  // shows a parked car. Real play still finds it at the plaza:
  // spawnHeroCar() parks it on Marina Row. The heading is the caller's:
  // play drives north (PI), chase and mission drive south (0) so no
  // U-turn eats the whole staging window.
  spawnHeroCar();
  const car = heroCar;
  // x=4, not 0: the palm rows stand at x=0 on z=±58, and a chase camera
  // parked right behind the car puts a trunk dead-center in the frame.
  car.x = 4; car.z = 60; car.heading = heading;
  vehicles.syncCar(car, 0);
  player.teleport(car.x, car.z, car.heading);
  enterCar(car, false);
  return car;
}

function refreshHud() {
  hud.setCash(G.cash, G.missionsDone);
  hud.setHealth(player.state.health, player.state.armor);
  hud.setStars(police.wanted);
  const target = missions.objectiveTarget();
  const playerPos = G.playerCar
    ? { x: G.playerCar.x, z: G.playerCar.z }
    : { x: player.state.x, z: player.state.z };
  const dist = target ? `${Math.round(distance2D(playerPos.x, playerPos.z, target.x, target.z))} m` : '';
  hud.setObjective(missions.active ? (missions.current() ? missions.current().title : 'MISSION') : 'FREE ROAM',
    missions.objectiveText(), dist);
  const mph = G.playerCar ? Math.abs(G.playerCar.speed) * 2.24 : 0;
  const weaponText = G.playerCar
    ? 'E — get out · Space — handbrake'
    : combat.current === 'pistol'
      ? `Marina P9 · ${combat.mag}/12 · Click to shoot · Q fists`
      : 'Fists · Click / F to punch · Q pistol';
  hud.setSpeed(mph, G.playerCar ? G.playerCar.name : 'ON FOOT', weaponText, !G.playerCar);
  city.setBeacon(target && missions.active ? target.x : 0, target && missions.active ? target.z : 0, !!target && missions.active);
  hud.drawMinimap({
    time: G.time,
    playerX: playerPos.x, playerZ: playerPos.z,
    playerHeading: G.playerCar ? G.playerCar.heading : player.state.yaw,
    traffic: vehicles.cars.filter((c) => c.isTraffic && !c.isPlayer),
    policeCars: police.cruisers,
    enemies: enemies.enemies,
    heroCar: heroCar && !heroCar.isPlayer ? heroCar : null,
    landmarks: Object.values(city.landmarks),
    missionTarget: missions.active ? target : null,
  });
}

let accumulator = 0;
let lastTime = performance.now();
let prevFiring = false;

function frame(now) {
  requestAnimationFrame(frame);
  if (G.frozen) { renderer.render(scene, camera); return; }
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (G.screen === 'play') {
    // One-shot keys.
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      G.screen = 'paused';
      hud.showOverlay('paused');
      saveGame();
    }
    if (input.wasPressed('KeyM')) {
      const on = audio.toggleMusic();
      hud.showHint(on ? 'Music on' : 'Music off');
    }
    if (input.wasPressed('KeyR')) {
      if (!G.playerCar && combat.current === 'pistol' && combat.mag < 12) {
        combat.reload();
        audio.click();
        hud.showHint('Marina P9 reloaded');
      } else {
        const save = loadSave();
        if (save) { startFromSave(save); hud.showHint('Save reloaded'); }
      }
    }
    if (input.wasPressed('KeyQ') && !G.playerCar) {
      combat.switchWeapon();
      audio.click();
    }
    if (input.wasPressed('KeyE')) {
      if (missions.dialogueLine) {
        missions.advanceDialogue();
        audio.click();
      } else if (G.playerCar) exitCar();
      else tryEnterCar();
    }
    if (input.wasPressed('KeyF') && !G.playerCar) {
      const res = combat.punch({ x: player.state.x, z: player.state.z }, player.state.yaw,
        [...enemies.enemies, ...peds.peds, ...police.officers]);
      if (res) {
        audio.punch();
        if (res.hit) applyHit(res.hit, res.damage, 'melee');
      }
    }
    // Mouse click: punch or shoot on foot, honk in a car.
    const firing = input.firing;
    if (firing && !prevFiring && !G.playerCar && player.state.health > 0) {
      if (combat.current === 'pistol') {
        const res = combat.shoot(
          { x: player.state.x, y: 0, z: player.state.z },
          cameraRig.rig.yaw, -cameraRig.rig.pitch * 0.4,
          [...enemies.enemies, ...peds.peds, ...police.officers]);
        if (res) {
          if (res.kind === 'dry') { audio.click(); hud.showHint('Magazine empty — press R to reload'); }
          else { audio.shot(); if (res.hit) applyHit(res.hit, res.damage, 'shot'); }
        }
      } else {
        const res = combat.punch({ x: player.state.x, z: player.state.z }, player.state.yaw,
          [...enemies.enemies, ...peds.peds, ...police.officers]);
        if (res) { audio.punch(); if (res.hit) applyHit(res.hit, res.damage, 'melee'); }
      }
    }
    prevFiring = firing;

    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) { step(STEP, false); accumulator -= STEP; steps += 1; }
    if (accumulator > STEP * 5) accumulator = 0;
    syncCamera(dt);
    refreshHud();
  } else if (G.screen === 'start') {
    // Idle drift behind the title screen: slow orbit over Marina Row.
    G.time += dt;
    cameraRig.rig.yaw += dt * 0.03;
    cameraRig.rig.distance = 30;
    cameraRig.update(dt, { x: -20, y: 0, z: 60 }, { dx: 0, dy: 0 });
    peds.step(dt, null);
    effects.step(dt);
  }
  renderer.render(scene, camera);
}

function applyHit(target, damage, kind) {
  if (target.hp !== undefined) {
    // Enemy: damage it, pay a bounty when it drops.
    target.hp -= damage;
    if (target.hp <= 0) {
      effects.burst(target.x, 1.4, target.z, 0xffd23f, 16, 4, 3);
      enemies.removeEnemy(target);
      G.cash += 150;
      hud.setCash(G.cash, G.missionsDone);
      hud.showToast('Rival down', '+$150 bounty', 'good');
      audio.cash();
    }
    return;
  }
  if (target.group && target.walkPhase !== undefined && !target.isOfficer) {
    // Pedestrian: they go down and the PD hears about it.
    effects.burst(target.x, 1, target.z, 0xff4d4d, 12, 3, 2);
    peds.removePed(target);
    police.addCrime(1);
    hud.showToast(kind === 'shot' ? 'Pedestrian shot' : 'Pedestrian down', 'Witnesses called the Bay PD', 'bad');
    return;
  }
  // Police officer: a serious crime.
  effects.burst(target.x, 1.4, target.z, 0xff4d4d, 12, 3, 2);
  police.addCrime(2);
  hud.showToast('Officer down', 'The whole Bay PD is coming for you', 'bad');
}

const game = {
  state: G, scene, camera, renderer, hud, police, missions, vehicles,
  cameraRig, step, syncCamera, refreshHud, startPlay, enterCarForShot,
  get frozen() { return G.frozen; },
  set frozen(v) { G.frozen = v; },
  get autopilot() { return G.autopilot; },
  set autopilot(v) { G.autopilot = v; },
};

// --- Boot ---
vehicles.spawnTraffic(10);
peds.spawn(22);
hud.onPlayClick(() => {
  if (G.screen === 'paused' || G.screen === 'start') {
    if (G.screen === 'start') startPlay(false);
    else { G.screen = 'play'; hud.hideOverlay(); }
    audio.unlock();
  }
});
hud.onContinueClick(() => {
  const save = loadSave();
  if (save) startFromSave(save);
});
if (loadSave()) hud.showContinue();
hud.showOverlay('start');
hud.showHud();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (shot) {
  try {
    stageShot(shot, game);
  } catch (err) {
    console.error('[shot] staging failed:', err);
    window.__shotError = String(err && err.message ? err.message : err);
  }
} else {
  requestAnimationFrame(frame);
}
