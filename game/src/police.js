// The Bay PD: a wanted level from 0 to 5 stars, police cruisers that spawn at
// the edge of the player's view and ram the getaway car, and foot officers who
// run the player down and make the arrest. Heat cools off when the player
// stays clean; getting busted costs bail money and a trip to the hospital.
// A stolen Vanta GT is still a stolen car: the PD treats it like any other
// hot ride, no matter how fast it is.
import * as THREE from 'three';
import { distance2D, clamp, angleDelta } from './rng.js';
import { buildCarMesh } from './vehicles.js';

export function createPolice(scene, city, vehicles, rng) {
  let wanted = 0;
  let heatTimer = 0;
  let spawnTimer = 0;
  const cruisers = [];
  const officers = [];
  let arrestProgress = 0;

  function addCrime(stars) {
    wanted = clamp(wanted + stars, 0, 5);
    heatTimer = 0;
  }

  function setWanted(stars) { wanted = clamp(stars, 0, 5); heatTimer = 0; }

  function spawnCruiserNear(x, z) {
    const angle = rng.range(0, Math.PI * 2);
    const sx = x + Math.sin(angle) * 70;
    const sz = z + Math.cos(angle) * 70;
    const fixed = city.collideCircle(sx, sz, 2);
    const car = vehicles.addCar(fixed.x, fixed.z, Math.atan2(x - fixed.x, z - fixed.z), { police: true });
    car.cruise = 20;
    cruisers.push(car);
    return car;
  }

  function spawnOfficerNear(x, z) {
    const group = buildOfficerMesh();
    const angle = rng.range(0, Math.PI * 2);
    const ox = x + Math.sin(angle) * 25;
    const oz = z + Math.cos(angle) * 25;
    group.position.set(ox, 0, oz);
    scene.add(group);
    const officer = { group, x: ox, z: oz, heading: 0, walkPhase: 0 };
    officers.push(officer);
    return officer;
  }

  function buildOfficerMesh() {
    const group = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1c2f4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.5), navy);
    torso.position.y = 1.25; torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    head.position.y = 2.0;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56), navy);
    cap.position.y = 2.3;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.38), navy);
    legL.position.set(-0.22, 0.45, 0);
    const legR = legL.clone(); legR.position.x = 0.22;
    group.add(torso, head, cap, legL, legR);
    group.userData.legL = legL;
    group.userData.legR = legR;
    return group;
  }

  function desiredUnits() {
    if (wanted === 0) return { cars: 0, officers: 0 };
    return { cars: Math.min(1 + wanted, 4), officers: wanted >= 2 ? Math.min(wanted - 1, 3) : 0 };
  }

  // Returns 'busted' when an officer holds the player long enough.
  function step(dt, playerPos, playerCar, playerOnFoot) {
    if (wanted > 0) {
      heatTimer += dt;
      if (heatTimer > 26) { wanted -= 1; heatTimer = 0; }
    }
    spawnTimer -= dt;
    const want = desiredUnits();
    if (spawnTimer <= 0) {
      spawnTimer = 2.2;
      if (cruisers.length < want.cars) spawnCruiserNear(playerPos.x, playerPos.z);
      if (officers.length < want.officers && playerOnFoot) spawnOfficerNear(playerPos.x, playerPos.z);
    }
    // Cruisers chase the player's position and ram.
    for (let i = cruisers.length - 1; i >= 0; i--) {
      const car = cruisers[i];
      if (wanted === 0) {
        // Called off: drive away and despawn at distance.
        car.speed = Math.max(car.speed, 12);
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        vehicles.syncCar(car, dt);
        if (distance2D(car.x, car.z, playerPos.x, playerPos.z) > 120) {
          vehicles.removeCar(car);
          cruisers.splice(i, 1);
        }
        continue;
      }
      const wantHeading = Math.atan2(playerPos.x - car.x, playerPos.z - car.z);
      car.heading += clamp(angleDelta(car.heading, wantHeading), -2.2 * dt, 2.2 * dt);
      const targetSpeed = distance2D(car.x, car.z, playerPos.x, playerPos.z) > 8 ? 23 + wanted * 2 : 12;
      car.speed += clamp(targetSpeed - car.speed, -14 * dt, 10 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const fixed = city.collideCircle(car.x, car.z, 1.6);
      if (fixed.x !== car.x || fixed.z !== car.z) { car.speed *= 0.5; car.heading += 0.6; }
      car.x = fixed.x; car.z = fixed.z;
      vehicles.syncCar(car, dt);
      if (playerCar) vehicles.collideCars(car, [playerCar]);
    }
    // Officers sprint at the player on foot; hold them 1.5 s to make the arrest.
    let busted = false;
    for (let i = officers.length - 1; i >= 0; i--) {
      const o = officers[i];
      if (wanted === 0) { scene.remove(o.group); officers.splice(i, 1); continue; }
      const dx = playerPos.x - o.x;
      const dz = playerPos.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d > 60) { scene.remove(o.group); officers.splice(i, 1); continue; }
      o.heading = Math.atan2(dx, dz);
      const speed = playerOnFoot ? 7.2 : 5;
      o.x += Math.sin(o.heading) * speed * dt;
      o.z += Math.cos(o.heading) * speed * dt;
      o.walkPhase += dt * speed * 2.4;
      o.group.position.set(o.x, 0, o.z);
      o.group.rotation.y = o.heading;
      const swing = Math.sin(o.walkPhase) * 0.55;
      o.group.userData.legL.rotation.x = swing;
      o.group.userData.legR.rotation.x = -swing;
      if (playerOnFoot && d < 2.2) {
        arrestProgress += dt;
        if (arrestProgress > 1.5) busted = true;
      }
    }
    if (!playerOnFoot || wanted === 0) arrestProgress = Math.max(0, arrestProgress - dt * 2);
    return busted ? 'busted' : null;
  }

  function clearAll() {
    for (const car of [...cruisers]) vehicles.removeCar(car);
    cruisers.length = 0;
    for (const o of officers) scene.remove(o.group);
    officers.length = 0;
    wanted = 0;
    arrestProgress = 0;
  }

  return {
    get wanted() { return wanted; },
    get cruisers() { return cruisers; },
    get officers() { return officers; },
    get arrestProgress() { return arrestProgress; },
    addCrime, setWanted, step, clearAll,
  };
}
