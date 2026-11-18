// Cars: build them from boxes, drive them with arcade physics, steal them,
// and fill the streets with traffic that follows the avenue grid. A car is a
// group with a body, cabin, four spinning wheels and a headlight pair; the
// player car, traffic cars and police cars are all the same factory.
import * as THREE from 'three';
import { clamp, angleDelta, distance2D } from './rng.js';

const CAR_COLORS = [0xff8c42, 0x3fa7d6, 0xe8e8e8, 0x2e2e38, 0xc94f6d, 0x7ac74f, 0xffd23f, 0x9b7ede];
const CAR_NAMES = [
  'Solano GT', 'Marina Coupe', 'Bay Runner', 'Coral Cruiser',
  'Sunset Sedan', 'Palm Van', 'Dune Buggy', 'Harbor Hatch',
];
const TOP_SPEED = 34;
const ACCEL = 16;
const BRAKE = 26;

// The Vanta GT: Solara Bay's hero car, an original matte-black low supercar
// (aggressive wedge nose, slit headlights, muscular hood ridge, rear wing)
// built from Three.js primitives only — no borrowed make or badge. It spawns
// parked on Marina Row with a driver, so the player can steal it like any
// other crewed car, and it is the fastest ride in the city.
export function buildVantaGTMesh() {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: 0x0e0e12 }); // matte black
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.55 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x181a1e });
  const silver = new THREE.MeshLambertMaterial({ color: 0xb8bcc2 });
  const gold = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a33 });

  // Low wide body, wedge nose, front splitter.
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.42, 4.7), paint);
  body.position.y = 0.42;
  body.castShadow = true;
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.5), dark);
  splitter.position.set(0, 0.18, 2.3);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.6), paint);
  hood.position.set(0, 0.7, 1.2);
  hood.castShadow = true;
  // Muscular hood ridge down the center.
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.5), paint);
  ridge.position.set(0, 0.83, 1.2);
  // Small gold nose badge — the Vanta mark, original to this car.
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.3), gold);
  badge.position.set(0, 0.84, 1.95);
  group.add(body, splitter, hood, ridge, badge);

  // Low swept cabin + roof panel, glass stays see-through for the driver.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 1.9), glass);
  cabin.position.set(0, 0.95, -0.35);
  cabin.castShadow = true;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.2), paint);
  roof.position.set(0, 1.18, -0.5);
  group.add(cabin, roof);

  // Slit headlights, angled in like narrowed eyes, over a dark intake.
  for (const x of [-0.62, 0.62]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.06), lampMat);
    lamp.position.set(x, 0.62, 2.36);
    lamp.rotation.y = -Math.sign(x) * 0.22;
    group.add(lamp);
  }
  const intake = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.06), dark);
  intake.position.set(0, 0.4, 2.36);
  group.add(intake);

  // Side skirts and the air intakes behind the doors.
  for (const s of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 3.2), dark);
    skirt.position.set(1.08 * s, 0.28, 0);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.9), dark);
    vent.position.set(1.09 * s, 0.62, -0.6);
    group.add(skirt, vent);
  }

  // Rear wing on twin struts, full-width taillight strip, diffuser, exhausts.
  for (const s of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.12), dark);
    strut.position.set(0.7 * s, 1.12, -2.15);
    group.add(strut);
  }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.45), paint);
  wing.position.set(0, 1.28, -2.15);
  wing.rotation.x = -0.12;
  wing.castShadow = true;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.06), tailMat);
  tail.position.set(0, 0.66, -2.36);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.3), dark);
  diffuser.position.set(0, 0.3, -2.3);
  group.add(wing, tail, diffuser);
  const exhaustGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.18, 8);
  exhaustGeo.rotateX(Math.PI / 2);
  for (const x of [-0.4, 0.4]) {
    const pipe = new THREE.Mesh(exhaustGeo, silver);
    pipe.position.set(x, 0.35, -2.42);
    group.add(pipe);
  }

  // Bigger wheels than the street cars, with silver hub discs.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 10);
  hubGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(x, 0.42, z);
    const hub = new THREE.Mesh(hubGeo, silver);
    hub.position.set(x, 0.42, z);
    group.add(wheel, hub);
    wheels.push(wheel);
  }
  return { group, wheels };
}

export function buildCarMesh(colorHex, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1c2f4a : colorHex });
  // Semi-transparent cabin glass: the driver (red hair, maroon shoulders)
  // stays visible from the chase camera while driving.
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.55 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x181a1e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  group.add(body, cabin);
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.18, 4.42),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.72;
    group.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.45, -0.2);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar2.position.set(-0.35, 1.45, -0.2);
    group.add(bar2);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(x, 0.38, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.1), lightMat);
    lamp.position.set(x, 0.62, 2.21);
    group.add(lamp);
  }
  return { group, wheels };
}

export function createVehicles(scene, city, rng) {
  const cars = [];
  let idCounter = 0;
  let heroCar = null;

  function addCar(x, z, heading, opts = {}) {
    const colorHex = opts.color ?? rng.pick(CAR_COLORS);
    const { group, wheels } = opts.hero
      ? buildVantaGTMesh()
      : buildCarMesh(colorHex, !!opts.police);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    const car = {
      id: idCounter++, group, wheels, colorHex,
      name: opts.name ?? rng.pick(CAR_NAMES),
      x, z, heading, speed: 0,
      isPlayer: false, isPolice: !!opts.police, isTraffic: !!opts.traffic,
      isHero: !!opts.hero, topSpeed: opts.hero ? 40 : TOP_SPEED,
      parked: !!opts.parked, driver: opts.traffic ? true : !!opts.driver,
      routeAxis: rng.chance(0.5) ? 'x' : 'z',
      routeDir: rng.chance(0.5) ? 1 : -1,
      cruise: rng.range(7, 11),
      dead: false,
    };
    cars.push(car);
    return car;
  }

  // The Vanta GT, parked on the Marina Row plaza with its driver still in it:
  // walk up, press E, and it is yours (the driver bails, the PD notices).
  function spawnHeroCar() {
    if (heroCar) return heroCar;
    heroCar = addCar(72, 124, -Math.PI / 2, {
      hero: true, parked: true, driver: true, name: 'Vanta GT', color: 0x0e0e12,
    });
    return heroCar;
  }

  function removeCar(car) {
    scene.remove(car.group);
    car.dead = true;
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  function collideCars(car, others) {
    for (const other of others) {
      if (other === car || other.dead) continue;
      const d = distance2D(car.x, car.z, other.x, other.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const nx = (car.x - other.x) / d;
        const nz = (car.z - other.z) / d;
        car.x += nx * push; car.z += nz * push;
        if (!other.isPlayer) { other.x -= nx * push; other.z -= nz * push; }
        car.speed *= 0.6;
        other.speed *= 0.6;
      }
    }
  }

  // Arcade driving: W/S throttle and brake, A/D steer harder the slower you
  // go, Space handbrakes into a skid. Buildings stop the car, they never trap it.
  function drivePlayer(car, dt, keys, onSkid) {
    const forward = keys.has('KeyW') || keys.has('ArrowUp');
    const back = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    const handbrake = keys.has('Space');
    if (forward) car.speed += ACCEL * dt;
    if (back) car.speed -= (car.speed > 0.5 ? BRAKE : ACCEL * 0.55) * dt;
    if (!forward && !back) car.speed -= Math.sign(car.speed) * 6 * dt;
    if (handbrake) {
      car.speed -= Math.sign(car.speed) * 18 * dt;
      if (Math.abs(car.speed) > 8 && Math.abs(car.speed) < 26) onSkid(car);
    }
    car.speed = clamp(car.speed, -10, car.topSpeed ?? TOP_SPEED);
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    const steerAmount = steer * clamp(Math.abs(car.speed) / 12, 0.25, 1) * 1.9 * dt;
    car.heading += steerAmount * Math.sign(car.speed || 1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = city.collideCircle(nx, nz, 1.6);
    if (fixed.x !== nx || fixed.z !== nz) car.speed *= 0.55;
    car.x = fixed.x;
    car.z = fixed.z;
    syncCar(car, dt);
  }

  // Traffic: cruise along one avenue, turn at intersections sometimes, slow
  // for the car ahead, never leave the road grid.
  function stepTraffic(car, dt, playerCar) {
    if (car.isPlayer || car.parked || car.isPolice) return;
    let targetSpeed = car.cruise;
    const aheadX = car.x + Math.sin(car.heading) * 9;
    const aheadZ = car.z + Math.cos(car.heading) * 9;
    for (const other of cars) {
      if (other === car || other.dead) continue;
      if (distance2D(aheadX, aheadZ, other.x, other.z) < 4) { targetSpeed = 0; break; }
    }
    if (playerCar && distance2D(aheadX, aheadZ, playerCar.x, playerCar.z) < 4) targetSpeed = 0;
    car.speed += clamp(targetSpeed - car.speed, -10 * dt, 8 * dt);
    const onAvenue = car.routeAxis === 'x'
      ? Math.abs(car.z - nearestAvenue(car.z)) < 4
      : Math.abs(car.x - nearestAvenue(car.x)) < 4;
    if (onAvenue && rng.chance(0.004)) {
      car.routeAxis = car.routeAxis === 'x' ? 'z' : 'x';
      car.routeDir = rng.chance(0.5) ? 1 : -1;
    }
    const wantHeading = car.routeAxis === 'x'
      ? (car.routeDir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.routeDir > 0 ? 0 : Math.PI);
    car.heading += clamp(angleDelta(car.heading, wantHeading), -1.4 * dt, 1.4 * dt);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const fixed = city.collideCircle(car.x, car.z, 1.6);
    car.x = fixed.x; car.z = fixed.z;
    // Keep traffic inside the city: turn around at the edge.
    if (Math.abs(car.x) > 148 || Math.abs(car.z) > 148) car.routeDir *= -1;
    syncCar(car, dt);
  }

  function nearestAvenue(v) {
    let best = 0;
    let bd = Infinity;
    for (const a of [ -116, -58, 0, 58, 116]) {
      const d = Math.abs(v - a);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  function syncCar(car, dt) {
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    const spin = (car.speed * dt) / 0.38;
    for (const w of car.wheels) w.rotation.x += spin;
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i++) {
      const p = city.randomRoadPoint();
      const axis = Math.abs(p.x) % 58 < 4 ? 'z' : 'x';
      const heading = axis === 'x' ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
      const car = addCar(p.x, p.z, heading, { traffic: true });
      car.routeAxis = axis;
    }
  }

  function nearestCar(x, z, maxDist, filter) {
    let best = null;
    let bd = maxDist;
    for (const car of cars) {
      if (car.dead) continue;
      if (filter && !filter(car)) continue;
      const d = distance2D(x, z, car.x, car.z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  return {
    cars, addCar, removeCar, drivePlayer, stepTraffic, collideCars,
    spawnTraffic, nearestCar, syncCar, spawnHeroCar,
    get heroCar() { return heroCar; },
  };
}
