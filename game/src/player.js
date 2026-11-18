// Ren Maro on foot: an original tall figure in a long dark-maroon robe with
// long red hair falling past the shoulders and across part of the face, pale
// skin, a high collar lined in cream, a vertical zipper down the robe front,
// wide sleeves, and ringed purple eyes, built from Three.js primitives only.
// WASD movement relative to the camera, sprint, a robe-sway walk cycle,
// hands together in a standby pose when idle, and a third-person camera rig
// the main loop aims with the mouse drag. A separate seated driver figure
// shows Ren Maro at the wheel while driving.
import * as THREE from 'three';
import { clamp } from './rng.js';

const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.6;

const ROBE = 0x571b26;       // long dark-maroon robe
const ROBE_DARK = 0x3d1219;  // hem and belt
const ROBE_LIGHT = 0x7a2a35; // shoulders and collar
const COLLAR_LINING = 0xd9c9a8; // cream/beige inside the high collar
const SKIN = 0xf2d7c9;       // pale skin
const HAIR = 0xd23b2a;       // red long hair
const EMBLEM = 0xffd23f;     // gold hexagonal chest emblem
const EYE_PURPLE = 0x8a5cff; // ringed purple eyes
const EYE_RING = 0x4a2a8a;

function buildRenMaro() {
  const group = new THREE.Group();
  const robeMat = new THREE.MeshLambertMaterial({ color: ROBE });
  const robeDarkMat = new THREE.MeshLambertMaterial({ color: ROBE_DARK });
  const robeLightMat = new THREE.MeshLambertMaterial({ color: ROBE_LIGHT });
  const skinMat = new THREE.MeshLambertMaterial({ color: SKIN });
  const hairMat = new THREE.MeshLambertMaterial({ color: HAIR });
  const emblemMat = new THREE.MeshBasicMaterial({ color: EMBLEM });

  // Long tapered robe: flared skirt, torso, wide shoulders, dark hem, belt.
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.66, 1.7, 12), robeMat);
  skirt.position.y = 0.85;
  skirt.castShadow = true;
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.72, 0.22, 12), robeDarkMat);
  hem.position.y = 0.11;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.6, 12), robeMat);
  torso.position.y = 1.95;
  torso.castShadow = true;
  const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.44, 0.28, 12), robeLightMat);
  shoulders.position.y = 2.2;
  shoulders.castShadow = true;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.09, 12), robeDarkMat);
  belt.position.y = 1.66;
  // High collar: a tall maroon ring with a cream/beige lining showing above it.
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.3, 12, 1, true), robeLightMat);
  collar.position.y = 2.36;
  collar.castShadow = true;
  const lining = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.36, 12, 1, true),
    new THREE.MeshLambertMaterial({ color: COLLAR_LINING }));
  lining.position.y = 2.38;
  group.add(skirt, hem, torso, shoulders, belt, collar, lining);

  // Vertical zipper down the center of the robe front, with a pull tab.
  const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.8, 0.03),
    new THREE.MeshLambertMaterial({ color: 0x8f8f96 }));
  zipper.position.set(0, 1.85, 0.44); // sits just under the chest emblem
  const zipPull = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.04),
    new THREE.MeshLambertMaterial({ color: 0x6f6f76 }));
  zipPull.position.set(0, 2.2, 0.455);
  group.add(zipper, zipPull);

  // Gold hexagonal emblem on the chest, flat face forward.
  const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 6), emblemMat);
  emblem.rotation.x = Math.PI / 2;
  emblem.position.set(0, 1.86, 0.45);
  const emblemCore = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 6),
    new THREE.MeshBasicMaterial({ color: 0xc79a1a }));
  emblemCore.rotation.x = Math.PI / 2;
  emblemCore.position.set(0, 1.86, 0.46);
  group.add(emblem, emblemCore);

  // Pale head and ringed purple eyes: a violet disc with a darker
  // concentric ring, the gaze that reads even from the chase camera.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skinMat);
  head.position.y = 2.48;
  head.castShadow = true;
  group.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: EYE_PURPLE });
  const ringMat = new THREE.MeshBasicMaterial({ color: EYE_RING });
  for (const sx of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12), eyeMat);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(sx, 2.52, 0.25);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.012, 6, 16), ringMat);
    ring.position.set(sx, 2.52, 0.255);
    group.add(eye, ring);
  }
  // Long red hair: a short spiked crown, a fringe across the forehead, side
  // locks falling past the shoulders and across part of the face, and a long
  // sheet down the back — the hair covers the face sides, it is not a cap.
  const spikeGeo = new THREE.ConeGeometry(0.09, 0.42, 5);
  const spikeTips = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, hairMat);
    spike.position.set(Math.cos(a) * 0.15, 2.72, Math.sin(a) * 0.15);
    spike.rotation.z = -Math.cos(a) * 0.5;
    spike.rotation.x = Math.sin(a) * 0.5;
    spike.castShadow = true;
    group.add(spike);
    spikeTips.push(spike);
  }
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 5), hairMat);
  crown.position.set(0, 2.84, -0.04);
  crown.rotation.x = -0.18;
  crown.castShadow = true;
  group.add(crown);
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.1), hairMat);
  fringe.position.set(0, 2.62, 0.16);
  fringe.rotation.x = 0.12;
  fringe.castShadow = true;
  group.add(fringe);
  for (const sx of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.09), hairMat);
    lock.position.set(0.24 * sx, 2.05, 0.17);
    lock.rotation.z = -0.08 * sx;
    lock.castShadow = true;
    group.add(lock);
  }
  const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.2, 0.12), hairMat);
  backHair.position.set(0, 1.95, -0.28);
  backHair.rotation.x = 0.06;
  backHair.castShadow = true;
  group.add(backHair);

  // Wide robe sleeves, posed in standby: hands together in front of the chest.
  function buildArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(0.52 * side, 2.14, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.82, 8), robeMat);
    sleeve.position.y = -0.41;
    sleeve.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), skinMat);
    hand.position.y = -0.84;
    pivot.add(sleeve, hand);
    pivot.rotation.set(-0.85, 0, 0.45 * side);
    group.add(pivot);
    return pivot;
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  return { group, armL, armR, skirt, head };
}

// Seated Ren Maro at the wheel: maroon shoulders, long red hair and a high
// cream-lined collar above the roof line so the driver reads from the chase
// camera. The cabin glass is semi-transparent, so the figure shows through
// it too.
function buildDriver() {
  const group = new THREE.Group();
  const robeMat = new THREE.MeshLambertMaterial({ color: ROBE });
  const robeLightMat = new THREE.MeshLambertMaterial({ color: ROBE_LIGHT });
  const liningMat = new THREE.MeshLambertMaterial({ color: COLLAR_LINING });
  const skinMat = new THREE.MeshLambertMaterial({ color: SKIN });
  const hairMat = new THREE.MeshLambertMaterial({ color: HAIR });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.6, 0.42), robeMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.22, 10), robeMat);
  shoulders.position.y = 1.32;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.2, 10, 1, true), robeLightMat);
  collar.position.y = 1.48;
  const lining = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.29, 0.24, 10, 1, true), liningMat);
  lining.position.y = 1.49;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skinMat);
  head.position.y = 1.56;
  head.castShadow = true;
  const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 6),
    new THREE.MeshBasicMaterial({ color: EMBLEM }));
  emblem.rotation.x = Math.PI / 2;
  emblem.position.set(0, 1.12, 0.22);
  group.add(torso, shoulders, collar, lining, head, emblem);
  // Ringed purple eyes, visible through the glass.
  const eyeMat = new THREE.MeshBasicMaterial({ color: EYE_PURPLE });
  for (const sx of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), eyeMat);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(sx, 1.6, 0.23);
    group.add(eye);
  }
  const spikeGeo = new THREE.ConeGeometry(0.08, 0.42, 5);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeo, hairMat);
    spike.position.set(Math.cos(a) * 0.13, 1.8, Math.sin(a) * 0.13);
    spike.rotation.z = -Math.cos(a) * 0.5;
    spike.rotation.x = Math.sin(a) * 0.5;
    group.add(spike);
  }
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 5), hairMat);
  crown.position.set(0, 1.92, -0.03);
  crown.rotation.x = -0.15;
  group.add(crown);
  // Long hair down the back and side locks past the shoulders, like on foot.
  const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.1), hairMat);
  backHair.position.set(0, 1.35, -0.26);
  group.add(backHair);
  for (const sx of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.08), hairMat);
    lock.position.set(0.22 * sx, 1.45, 0.16);
    group.add(lock);
  }
  group.visible = false;
  return group;
}

export function createPlayer(scene, city) {
  const { group, armL, armR, skirt } = buildRenMaro();
  scene.add(group);
  const driver = buildDriver();
  scene.add(driver);

  const state = {
    x: -52, z: -40, y: 0, yaw: 0, speed: 0,
    health: 100, armor: 0, walkPhase: 0, moving: false, idleTime: 0,
  };

  function step(dt, keys, camYaw) {
    let fx = 0;
    let fz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) fz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const target = sprint ? SPRINT_SPEED : WALK_SPEED;
    if (fx !== 0 || fz !== 0) {
      const len = Math.hypot(fx, fz);
      fx /= len; fz /= len;
      // Camera-relative: forward is where the camera looks.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const wx = fx * cos - fz * sin;
      const wz = fx * sin + fz * cos;
      state.speed = target;
      state.x += wx * target * dt;
      state.z += wz * target * dt;
      state.yaw = Math.atan2(wx, wz);
      state.walkPhase += dt * target * 1.6;
      state.moving = true;
    } else {
      state.speed = 0;
      state.moving = false;
      state.idleTime += dt;
    }
    const fixed = city.collideCircle(state.x, state.z, 0.6);
    state.x = fixed.x;
    state.z = fixed.z;
    group.position.set(state.x, 0, state.z);
    group.rotation.y = state.yaw;
    // Walk cycle: the robe sways and the sleeves swing from the standby pose;
    // idle, the robe breathes and the hands stay together in front.
    const swing = state.moving ? Math.sin(state.walkPhase) * 0.35 : 0;
    armL.rotation.x = -0.85 + swing;
    armR.rotation.x = -0.85 - swing;
    skirt.rotation.z = state.moving ? Math.sin(state.walkPhase) * 0.05 : 0;
    group.position.y = state.moving ? Math.abs(Math.sin(state.walkPhase)) * 0.06 : 0;
    const breathe = state.moving ? 1 : 1 + Math.sin(state.idleTime * 2) * 0.008;
    skirt.scale.y = breathe;
  }

  function teleport(x, z, yaw) {
    state.x = x; state.z = z; state.yaw = yaw;
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
  }

  function showDriver() { driver.visible = true; }
  function hideDriver() { driver.visible = false; }
  function updateDriver(car) {
    if (!driver.visible) return;
    driver.position.set(car.x, 0, car.z);
    driver.rotation.y = car.heading;
  }

  return { group, driver, state, step, teleport, showDriver, hideDriver, updateDriver };
}

// Third-person camera: orbits with the mouse drag, follows the target from
// behind, and never clips below the ground.
export function createCameraRig(camera) {
  const rig = { yaw: Math.PI, pitch: 0.32, distance: 9.5 };
  function update(dt, target, look) {
    rig.yaw -= look.dx * 0.004;
    rig.pitch = clamp(rig.pitch + look.dy * 0.003, -0.1, 0.9);
    const cx = target.x - Math.sin(rig.yaw) * Math.cos(rig.pitch) * rig.distance;
    const cz = target.z - Math.cos(rig.yaw) * Math.cos(rig.pitch) * rig.distance;
    const cy = target.y + 2 + Math.sin(rig.pitch) * rig.distance;
    camera.position.set(cx, Math.max(cy, 1.2), cz);
    camera.lookAt(target.x, target.y + 1.6, target.z);
  }
  return { rig, update };
}
