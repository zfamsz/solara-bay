// Pedestrians: ordinary Solara Bay locals strolling the sidewalks. They pick a
// nearby avenue, walk its sidewalk to the next corner, and pick another. They
// run away from gunfire and from cars bearing down on them, and they panic
// when the player waves a fist at them. At sunset they crowd Marina Row,
// where the matte-black Vanta GT draws a look from everyone passing by.
import * as THREE from 'three';
import { distance2D } from './rng.js';

const SHIRT_COLORS = [0xffd23f, 0x7ac74f, 0x3fa7d6, 0xe8e8e8, 0xc94f6d, 0xff8c42, 0x9b7ede, 0x19b8a6];
const SKIN_COLORS = [0xc98a5a, 0x8a5a3a, 0xe8b48a, 0x6b4a2f, 0xf2c9a0];

export function createPedestrians(scene, city, rng) {
  const peds = [];

  function buildPedMesh() {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLORS) });
    const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKIN_COLORS) });
    const pants = new THREE.MeshLambertMaterial({ color: rng.pick([0x2e2e38, 0x4a3a2e, 0x2e4a6b]) });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.42), shirt);
    torso.position.y = 1.15;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
    head.position.y = 1.85;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.34), pants);
    legL.position.set(-0.18, 0.38, 0);
    const legR = legL.clone();
    legR.position.x = 0.18;
    group.add(torso, head, legL, legR);
    group.userData.legL = legL;
    group.userData.legR = legR;
    return group;
  }

  function addPed(x, z) {
    const group = buildPedMesh();
    group.position.set(x, 0, z);
    scene.add(group);
    const ped = {
      group, x, z, heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 2.6), targetX: x, targetZ: z,
      walkPhase: rng.range(0, 6), fleeing: false, fleeTimer: 0,
    };
    pickSidewalkTarget(ped);
    peds.push(ped);
    return ped;
  }

  function pickSidewalkTarget(ped) {
    // Walk along a sidewalk: one avenue line, offset 9 m, to a random point.
    const avenue = rng.pick([-116, -58, 0, 58, 116]);
    if (rng.chance(0.5)) {
      ped.targetX = rng.range(-140, 140);
      ped.targetZ = avenue + 9;
    } else {
      ped.targetX = avenue + 9;
      ped.targetZ = rng.range(-140, 140);
    }
  }

  function fleeFrom(ped, x, z) {
    ped.fleeing = true;
    ped.fleeTimer = 2.5;
    const dx = ped.x - x;
    const dz = ped.z - z;
    const len = Math.hypot(dx, dz) || 1;
    ped.targetX = ped.x + (dx / len) * 30;
    ped.targetZ = ped.z + (dz / len) * 30;
  }

  function step(dt, danger) {
    for (const ped of peds) {
      if (ped.fleeTimer > 0) ped.fleeTimer -= dt;
      else ped.fleeing = false;
      if (danger) {
        const d = distance2D(ped.x, ped.z, danger.x, danger.z);
        if (d < danger.radius) fleeFrom(ped, danger.x, danger.z);
      }
      const dx = ped.targetX - ped.x;
      const dz = ped.targetZ - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        if (ped.fleeing) { ped.fleeing = false; pickSidewalkTarget(ped); }
        else pickSidewalkTarget(ped);
        continue;
      }
      const speed = ped.fleeing ? 6.0 : ped.speed;
      const want = Math.atan2(dx, dz);
      let turn = want - ped.heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      ped.heading += Math.max(-3 * dt, Math.min(3 * dt, turn));
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      const fixed = city.collideCircle(ped.x, ped.z, 0.5);
      ped.x = fixed.x; ped.z = fixed.z;
      ped.walkPhase += dt * speed * 2.4;
      ped.group.position.set(ped.x, 0, ped.z);
      ped.group.rotation.y = ped.heading;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.group.userData.legL.rotation.x = swing;
      ped.group.userData.legR.rotation.x = -swing;
    }
  }

  function nearestPed(x, z, maxDist) {
    let best = null;
    let bd = maxDist;
    for (const ped of peds) {
      const d = distance2D(x, z, ped.x, ped.z);
      if (d < bd) { bd = d; best = ped; }
    }
    return best;
  }

  function removePed(ped) {
    scene.remove(ped.group);
    const i = peds.indexOf(ped);
    if (i >= 0) peds.splice(i, 1);
  }

  function spawn(count) {
    for (let i = 0; i < count; i++) {
      const p = city.randomRoadPoint();
      addPed(p.x + 9, p.z + 9);
    }
  }

  return { peds, addPed, step, nearestPed, removePed, spawn, fleeFrom };
}
