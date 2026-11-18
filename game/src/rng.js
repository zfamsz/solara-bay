// Seeded randomness and small math helpers for Solara Bay. One deterministic
// stream per run keeps the ?shot= scenes identical every time they load.
// The same seed must stage the same sunset: palms, traffic and the hero car
// all draw from this stream, so a screenshot can be retaken exactly.
export function mulberry32(initial) {
  let a = initial | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    pick(list) { if (!list.length) return undefined; return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
  };
}

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
// Shortest signed turn from angle a toward angle b, in (-PI, PI].
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
export function distance2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
