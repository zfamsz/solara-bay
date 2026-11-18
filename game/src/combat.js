// Combat and effects: fists and a pistol for the player, armed rival crew
// members who shoot back, and the particle bursts, tracers and muzzle flashes
// that sell every hit. Effects are one THREE.Points cloud recycled per burst,
// so combat never allocates in the hot loop. Punch range is deliberately
// short: fists are a last resort, not a primary weapon — the pistol is for
// the crew, and the Vanta GT is for getting away from them.
import * as THREE from 'three';
import { distance2D } from './rng.js';

const MAX_PARTICLES = 600;

export function createEffects(scene) {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.45, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
  }));
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX_PARTICLES; i++) parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  let cursor = 0;

  function burst(x, y, z, hex, count, speed, up = 2) {
    const c = new THREE.Color(hex);
    for (let n = 0; n < count; n++) {
      const p = parts[cursor];
      cursor = (cursor + 1) % MAX_PARTICLES;
      p.alive = true;
      p.x = x; p.y = y; p.z = z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * s;
      p.vz = Math.sin(a) * s;
      p.vy = Math.random() * up;
      p.life = 0.4 + Math.random() * 0.45;
      const i = parts.indexOf(p);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.attributes.color.needsUpdate = true;
  }

  // A tracer is a thin stretched box from muzzle to hit point, faded out fast.
  const tracers = [];
  function tracer(from, to) {
    const len = from.distanceTo(to);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, len),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }),
    );
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.lookAt(to);
    mesh.userData.life = 0.12;
    scene.add(mesh);
    tracers.push(mesh);
  }

  function step(dt) {
    let any = false;
    parts.forEach((p, i) => {
      if (!p.alive) { positions[i * 3 + 1] = -100; return; }
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; positions[i * 3 + 1] = -100; any = true; return; }
      p.vy -= 9 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; }
      positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
      any = true;
    });
    if (any) geo.attributes.position.needsUpdate = true;
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life / 0.12) * 0.9;
      if (t.userData.life <= 0) { scene.remove(t); t.material.dispose(); tracers.splice(i, 1); }
    }
  }

  return { burst, tracer, step };
}

// Armed enemies: rival crew members with a health pool who chase the player
// into range and shoot on a cooldown. Built from the same box figure as the
// pedestrians, in rival red, with a visible pistol.
export function createEnemies(scene, rng) {
  const enemies = [];

  function addEnemy(x, z, hp = 100) {
    const group = new THREE.Group();
    const red = new THREE.MeshLambertMaterial({ color: 0x8a1f2d });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.5), red);
    torso.position.y = 1.25; torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    head.position.y = 2.0;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.38), dark);
    legL.position.set(-0.22, 0.45, 0);
    const legR = legL.clone(); legR.position.x = 0.22;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), dark);
    gun.position.set(0.45, 1.35, 0.4);
    group.add(torso, head, legL, legR, gun);
    group.position.set(x, 0, z);
    scene.add(group);
    const enemy = {
      group, x, z, hp, maxHp: hp, heading: 0,
      cooldown: rng.range(0.5, 1.5), walkPhase: 0, dead: false,
    };
    enemies.push(enemy);
    return enemy;
  }

  function removeEnemy(enemy) {
    scene.remove(enemy.group);
    enemy.dead = true;
    const i = enemies.indexOf(enemy);
    if (i >= 0) enemies.splice(i, 1);
  }

  return { enemies, addEnemy, removeEnemy };
}

// The player's weapons: fists (short range, fast, free) and the Marina P9
// pistol (hitscan, 12-round magazine). Shooting and punching report what they
// hit so the main loop can score crimes, bounties and mission progress.
export function createCombat(scene, effects) {
  const weapons = {
    fists: { name: 'Fists', range: 2.4, damage: 18, rate: 0.38, ammo: Infinity },
    pistol: { name: 'Marina P9', range: 55, damage: 34, rate: 0.28, mag: 12 },
  };
  let current = 'fists';
  let mag = 12;
  let cooldown = 0;

  function punch(origin, yaw, targets) {
    if (cooldown > 0) return null;
    cooldown = weapons.fists.rate;
    const px = origin.x + Math.sin(yaw) * 1.4;
    const pz = origin.z + Math.cos(yaw) * 1.4;
    effects.burst(px, 1.4, pz, 0xffffff, 6, 2.5, 1);
    for (const t of targets) {
      if (t.dead) continue;
      if (distance2D(px, pz, t.x, t.z) < 1.8) {
        return { hit: t, damage: weapons.fists.damage, kind: 'melee' };
      }
    }
    return { hit: null, damage: 0, kind: 'melee' };
  }

  function shoot(origin, yaw, pitch, targets) {
    if (cooldown > 0) return null;
    if (current !== 'pistol') return null;
    if (mag <= 0) return { hit: null, damage: 0, kind: 'dry' };
    cooldown = weapons.pistol.rate;
    mag -= 1;
    const from = new THREE.Vector3(origin.x, origin.y + 1.5, origin.z);
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    // Hitscan against targets approximated as vertical capsules at their feet.
    let best = null;
    let bestT = weapons.pistol.range;
    for (const t of targets) {
      if (t.dead) continue;
      const dx = t.x - from.x;
      const dz = t.z - from.z;
      const along = dx * dir.x + dz * dir.z;
      if (along < 0 || along > bestT) continue;
      const perp = Math.hypot(dx - dir.x * along, dz - dir.z * along);
      if (perp < 1.1) { best = t; bestT = along; }
    }
    const end = from.clone().addScaledVector(dir, best ? bestT : weapons.pistol.range);
    effects.tracer(from, end);
    effects.burst(from.x + dir.x, from.y + dir.y, from.z + dir.z, 0xffd23f, 5, 3, 1);
    if (best) {
      effects.burst(best.x, 1.4, best.z, 0xff4d4d, 10, 3, 2);
      return { hit: best, damage: weapons.pistol.damage, kind: 'shot' };
    }
    return { hit: null, damage: 0, kind: 'shot' };
  }

  function step(dt) { if (cooldown > 0) cooldown -= dt; }
  function switchWeapon() {
    current = current === 'fists' ? 'pistol' : 'fists';
    return current;
  }
  function reload() { if (current === 'pistol') mag = weapons.pistol.mag; }

  return {
    weapons, get current() { return current; }, get mag() { return mag; },
    punch, shoot, step, switchWeapon, reload,
  };
}
