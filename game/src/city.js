// Solara Bay itself: a sun-soaked coastal grid city. Five avenues each way,
// instanced towers and shops with warm pastel facades, a sand beach and teal
// sea to the south, palms and lamps along the streets, and the story landmarks:
// Marina Row garage, Coral Pier, the East Docks and St. Coral Hospital.
// Buildings are one InstancedMesh (one draw call) and every building registers
// an AABB the player, cars and peds collide with.
import * as THREE from 'three';
import { clamp } from './rng.js';

export const AVENUES = [-116, -58, 0, 58, 116];
export const ROAD_HALF = 7;
export const CITY_HALF = 150;
export const SEA_Z = 158;

const BUILDING_COLORS = [
  0xffd9b0, 0xf7b8a0, 0xffe9c4, 0xcfe8e0, 0xf2c9d8,
  0xbfd9ff, 0xfff1a8, 0xe8b48a, 0xd8e6c8, 0xf6e3ce,
];
const ROOF_COLORS = [0x8a5a44, 0x5a6b7a, 0x7a4a5a, 0x4a6b5a];

export function createCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground: warm concrete for the city, sand for the beach, teal sea beyond.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 40, CITY_HALF * 2 + 40),
    new THREE.MeshLambertMaterial({ color: 0x8d8578 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -10);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 40, 46),
    new THREE.MeshLambertMaterial({ color: 0xeccf92 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY_HALF + 14);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 200, 160),
    new THREE.MeshLambertMaterial({ color: 0x1b8a9e }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, SEA_Z + 90);
  group.add(sea);

  // Roads: dark strips along every avenue, plus pale sidewalk edging.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x33363d });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xa89f8d });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  for (const a of AVENUES) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, ROAD_HALF * 2), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(horizontal ? 0 : a, 0.03, horizontal ? a : 0);
      if (!horizontal) road.rotation.z = Math.PI / 2;
      road.receiveShadow = true;
      group.add(road);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, 3), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(horizontal ? 0 : a + ROAD_HALF + 1.5, 0.035, horizontal ? a + ROAD_HALF + 1.5 : 0);
      if (!horizontal) walk.rotation.z = Math.PI / 2;
      group.add(walk);
      // Center dashes along each avenue.
      const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(4, 0.6), dashMat, 44);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler(-Math.PI / 2, 0, horizontal ? 0 : Math.PI / 2);
      q.setFromEuler(e);
      for (let i = 0; i < 44; i++) {
        const t = -CITY_HALF + 8 + i * 7;
        m4.compose(
          new THREE.Vector3(horizontal ? t : a, 0.05, horizontal ? a : t),
          q, new THREE.Vector3(1, 1, 1),
        );
        dashes.setMatrixAt(i, m4);
      }
      group.add(dashes);
    }
  }

  // Buildings: one InstancedMesh, 2-4 per block, heights 6-34, pastel walls.
  const blocks = [];
  for (let ix = 0; ix < AVENUES.length - 1; ix++) {
    for (let iz = 0; iz < AVENUES.length - 1; iz++) {
      blocks.push({
        x0: AVENUES[ix] + ROAD_HALF + 2, x1: AVENUES[ix + 1] - ROAD_HALF - 2,
        z0: AVENUES[iz] + ROAD_HALF + 2, z1: AVENUES[iz + 1] - ROAD_HALF - 2,
      });
    }
  }
  const placements = [];
  for (const b of blocks) {
    const count = rng.int(2, 3);
    const bw = (b.x1 - b.x0) / (count === 3 ? 2 : 1);
    const bd = (b.z1 - b.z0) / (count === 3 ? 2 : 1);
    for (let i = 0; i < count; i++) {
      const gx = count === 3 ? i % 2 : 0;
      const gz = count === 3 ? Math.floor(i / 2) : 0;
      const w = bw * rng.range(0.55, 0.8);
      const d = bd * rng.range(0.55, 0.8);
      const h = rng.chance(0.16) ? rng.range(22, 34) : rng.range(6, 18);
      const x = b.x0 + gx * bw + bw / 2 + rng.range(-2, 2);
      const z = b.z0 + gz * bd + bd / 2 + rng.range(-2, 2);
      placements.push({ x, z, w, d, h, color: rng.pick(BUILDING_COLORS) });
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const towers = new THREE.InstancedMesh(boxGeo, boxMat, placements.length);
  const m4 = new THREE.Matrix4();
  const color = new THREE.Color();
  placements.forEach((p, i) => {
    m4.makeScale(p.w, p.h, p.d);
    m4.setPosition(p.x, 0, p.z);
    towers.setMatrixAt(i, m4);
    towers.setColorAt(i, color.setHex(p.color));
  });
  towers.castShadow = true;
  towers.receiveShadow = true;
  group.add(towers);

  // Rooftop boxes on the tall towers, for a skyline that reads at a glance.
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  roofGeo.translate(0, 0.5, 0);
  const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), placements.length);
  placements.forEach((p, i) => {
    m4.makeScale(p.w * 0.35, 2.2, p.d * 0.35);
    m4.setPosition(p.x + p.w * 0.15, p.h, p.z);
    roofs.setMatrixAt(i, m4);
    roofs.setColorAt(i, color.setHex(rng.pick(ROOF_COLORS)));
  });
  roofs.castShadow = true;
  group.add(roofs);

  // Palms along the beachfront avenue and the marina, lamps on every corner.
  // Sunset rows: the beachfront, both sides of Marina Row (dense, so the
  // hero car parks under them), and the two middle avenues, so palms frame
  // the pink-orange sky from almost any street in the city.
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const leafGeo = new THREE.ConeGeometry(3.2, 4.5, 7);
  leafGeo.translate(0, 8.5, 0);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e5f });
  const palmSpots = [];
  for (let x = -140; x <= 140; x += 14) palmSpots.push([x, 138]);
  for (let x = -140; x <= 140; x += 28) palmSpots.push([x, -142]);
  for (let x = -140; x <= 140; x += 14) palmSpots.push([x, 124]); // Marina Row, dense
  for (let x = -140; x <= 140; x += 28) palmSpots.push([x, 58]); // middle avenue
  for (let x = -140; x <= 140; x += 28) palmSpots.push([x, -58]); // middle avenue
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    m4.makeRotationY(rng.range(0, Math.PI * 2));
    m4.setPosition(x, 0, z);
    trunks.setMatrixAt(i, m4);
    leaves.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  group.add(trunks);
  group.add(leaves);

  const lampGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 5);
  lampGeo.translate(0, 3, 0);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampSpots = [];
  for (const a of AVENUES) for (const b of AVENUES) lampSpots.push([a + ROAD_HALF + 1, b + ROAD_HALF + 1]);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => { m4.identity(); m4.setPosition(x, 0, z); lamps.setMatrixAt(i, m4); });
  group.add(lamps);

  // Story landmarks, each a small distinct prop so the player can find them.
  function landmarkBox(x, z, w, h, d, hex, label) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: hex }));
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    group.add(mesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return { x, z, label };
  }
  const landmarks = {
    garage: landmarkBox(-58, -58, 16, 7, 12, 0xff6b4a, 'Marina Row Garage'),
    pier: landmarkBox(0, 168, 22, 2, 8, 0xc98a5a, 'Coral Pier'),
    docks: landmarkBox(150, 0, 10, 9, 26, 0x5a7a8a, 'East Docks warehouse'),
    hospital: landmarkBox(-116, 116, 18, 12, 14, 0xf2f2ea, 'St. Coral Hospital'),
    marina: landmarkBox(58, 116, 12, 5, 10, 0x19b8a6, 'Marina Row'),
  };

  // A glowing beacon column marks the active objective from across the city.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);

  function collideCircle(x, z, r) {
    // Push a circle out of every building AABB and the city edge (except the beach).
    let nx = clamp(x, -CITY_HALF - 18, CITY_HALF + 18);
    let nz = clamp(z, -CITY_HALF - 18, SEA_Z + 6);
    for (const c of colliders) {
      const cx = clamp(nx, c.minX, c.maxX);
      const cz = clamp(nz, c.minZ, c.maxZ);
      const dx = nx - cx;
      const dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * r;
          nz = cz + (dz / d) * r;
        } else {
          nx = c.maxX + r;
        }
      }
    }
    return { x: nx, z: nz };
  }

  function randomRoadPoint() {
    if (rng.chance(0.5)) {
      return { x: rng.pick(AVENUES) + rng.range(-3, 3), z: rng.range(-140, 140) };
    }
    return { x: rng.range(-140, 140), z: rng.pick(AVENUES) + rng.range(-3, 3) };
  }

  function setBeacon(x, z, visible) {
    beacon.position.x = x;
    beacon.position.z = z;
    beacon.visible = visible;
  }

  return { group, colliders, landmarks, collideCircle, randomRoadPoint, setBeacon, sea };
}
