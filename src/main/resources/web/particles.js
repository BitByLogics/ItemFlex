/* Approximation of how the vanilla client spawns and animates particles.
 * Sprites are the real textures from the client; motion is modelled on the vanilla particle classes. */

import { getJson, loadImage, stripNamespace } from './mc.js';

const spriteCache = new Map();

export function loadSprites(key) {
  if (!spriteCache.has(key)) {
    spriteCache.set(key, (async () => {
      const def = await getJson(`/assets/mc/particles/${key}.json`);
      if (!def || !def.textures) return [];
      const images = await Promise.all(def.textures.map((ref) => loadImage(`/assets/mc/textures/particle/${stripNamespace(ref)}.png`)));
      return images.filter(Boolean);
    })());
  }
  return spriteCache.get(key);
}

/* resolved sprites live here once loaded so the synchronous render loop can use them */
const resolved = new Map();
export function ensureSprites(key, onLoaded) {
  if (resolved.has(key)) return resolved.get(key);
  loadSprites(key).then((images) => { resolved.set(key, images); onLoaded?.(); });
  return null;
}

const BASE = { life: [16, 30], size: [0.1, 0.16], gravity: 0, friction: 0.98, rise: 0, vel: 'base', sprite: 'age', fade: 0.3, shrink: 0, tint: '#ffffff' };

const DEFS = {
  glow: { life: [10, 39], size: [0.075, 0.15], friction: 0.96, vel: 'glow', sprite: 'first', fade: 0.5, tints: ['rgb(153,255,204)', 'rgb(20,102,102)'] },
  flame: { life: [10, 40], size: [0.08, 0.13], friction: 0.96, vel: 'flame', sprite: 'first', shrink: 0.5, fade: 0 },
  small_flame: { life: [10, 40], size: [0.05, 0.08], friction: 0.96, vel: 'flame', sprite: 'first', shrink: 0.5, fade: 0 },
  soul_fire_flame: { life: [10, 40], size: [0.08, 0.13], friction: 0.96, vel: 'flame', sprite: 'first', shrink: 0.5, fade: 0 },
  smoke: { life: [8, 40], size: [0.1, 0.2], friction: 0.96, rise: 0.004, vel: 'given', jitter: 0.01, tint: '#333333', fade: 0.3 },
  large_smoke: { life: [8, 40], size: [0.25, 0.4], friction: 0.96, rise: 0.004, vel: 'given', jitter: 0.01, tint: '#333333', fade: 0.3 },
  heart: { life: [16, 16], size: [0.12, 0.16], friction: 0.86, vel: 'heart', sprite: 'first', fade: 0 },
  happy_villager: { life: [12, 24], size: [0.07, 0.1], friction: 0.98, vel: 'given', jitter: 0.01, sprite: 'first', fade: 0.3 },
  crit: { life: [3, 8], size: [0.12, 0.2], friction: 0.7, vel: 'crit', sprite: 'first', fade: 0 },
  enchanted_hit: { life: [3, 8], size: [0.12, 0.2], friction: 0.7, vel: 'crit', sprite: 'first', fade: 0, tint: '#7a5cff' },
  firework: { life: [48, 59], size: [0.075, 0.15], gravity: 0.1, friction: 0.91, vel: 'given', sprite: 'age', fade: 0.5, fadeFrom: 0.5, maxFade: 0.5 },
  flash: { life: [4, 4], size: [0.6, 0.6], vel: 'none', sprite: 'first', fade: 0.5 },
  end_rod: { life: [40, 80], size: [0.08, 0.12], friction: 0.91, vel: 'given', jitter: 0.01, sprite: 'age', fade: 0.3 },
  cloud: { life: [8, 40], size: [0.12, 0.25], friction: 0.96, vel: 'given', jitter: 0.02, sprite: 'age', fade: 0.3 },
  poof: { life: [6, 12], size: [0.2, 0.3], friction: 0.9, vel: 'given', jitter: 0.02, sprite: 'age', fade: 0 },
  bubble: { life: [10, 40], size: [0.04, 0.08], friction: 0.85, rise: 0.02, vel: 'given', sprite: 'first', fade: 0 },
  snowflake: { life: [40, 80], size: [0.05, 0.1], gravity: 0.05, friction: 0.99, vel: 'given', jitter: 0.01, sprite: 'random', fade: 0.3 },
  electric_spark: { life: [8, 14], size: [0.06, 0.1], friction: 0.9, vel: 'given', jitter: 0.05, sprite: 'age', fade: 0.4 },
  soul: { life: [24, 40], size: [0.1, 0.14], friction: 0.98, rise: 0.003, vel: 'given', sprite: 'age', fade: 0.3 },
  enchant: { life: [30, 39], size: [0.02, 0.07], vel: 'fly', sprite: 'random', fade: 0, glyph: true },
  nautilus: { life: [30, 39], size: [0.02, 0.07], vel: 'fly', sprite: 'random', fade: 0, glyph: true },
  portal: { life: [20, 50], size: [0.05, 0.1], vel: 'fly', sprite: 'first', fade: 0.3 },
};

export function particleDef(key) {
  return { ...BASE, ...(DEFS[key] || {}) };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gaussian = (rng) => {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
};

function initialVelocity(def, rng, xa, ya, za) {
  switch (def.vel) {
    case 'given': {
      const j = def.jitter || 0;
      return [xa + (rng() * 2 - 1) * j, ya + (rng() * 2 - 1) * j, za + (rng() * 2 - 1) * j];
    }
    case 'none': return [0, 0, 0];
    case 'fly': return [xa, ya, za];
    case 'glow': {
      const v = base(rng, xa, ya, za);
      return [v[0], (v[1] - 0.1) * 0.2 + ya * 0.2, v[2]];
    }
    case 'heart': return [xa * 0.01, ya * 0.01 + 0.1, za * 0.01];
    case 'crit': {
      const v = base(rng, xa, ya, za);
      return [v[0] * 3 + xa * 0.4, v[1] * 3 + ya * 0.4 + 0.05, v[2] * 3 + za * 0.4];
    }
    case 'flame': {
      const v = base(rng, xa, ya, za);
      return [v[0] * 0.01 + xa, v[1] * 0.01 + ya, v[2] * 0.01 + za];
    }
    default: return base(rng, xa, ya, za);
  }
}

function base(rng, xa, ya, za) {
  let x = xa + (rng() * 2 - 1) * 0.4;
  let y = ya + (rng() * 2 - 1) * 0.4;
  let z = za + (rng() * 2 - 1) * 0.4;
  const speed = (rng() + rng() + 1) * 0.15;
  const length = Math.hypot(x, y, z) || 1;
  x = (x / length) * speed * 0.4;
  y = (y / length) * speed * 0.4 + 0.1;
  z = (z / length) * speed * 0.4;
  return [x, y, z];
}

/* Simulates one batch of particles; every particle gets a precomputed trajectory. */
export function simulateBatch(event, key, fireTick, eventIndex, spriteCount) {
  const def = particleDef(key);
  const rng = mulberry32((fireTick * 7919 + eventIndex * 104729 + 17) >>> 0);
  const count = event.count > 0 ? Math.min(event.count, 300) : 1;
  const particles = [];

  for (let i = 0; i < count; i++) {
    let pos;
    let vel;
    if (event.count > 0) {
      pos = [gaussian(rng) * event.offsetX, gaussian(rng) * event.offsetY, gaussian(rng) * event.offsetZ];
      vel = initialVelocity(def, rng, gaussian(rng) * event.speed, gaussian(rng) * event.speed, gaussian(rng) * event.speed);
    } else {
      pos = [0, 0, 0];
      vel = initialVelocity(def, rng, event.offsetX * event.speed, event.offsetY * event.speed, event.offsetZ * event.speed);
    }

    const life = def.life[0] + Math.floor(rng() * (def.life[1] - def.life[0] + 1));
    const size = def.size[0] + rng() * (def.size[1] - def.size[0]);
    const spriteIndex = def.sprite === 'random' ? Math.floor(rng() * Math.max(1, spriteCount)) : 0;
    const tintShade = 0.7 + rng() * 0.3;
    let color = null;
    if (def.tints) {
      color = def.tints[Math.floor(rng() * def.tints.length)];
    } else if (def.glyph) {
      const f = rng() * 0.6 + 0.4;
      color = `rgb(${Math.round(0.9 * f * 255)},${Math.round(0.9 * f * 255)},${Math.round(f * 255)})`;
    } else {
      color = colourFor(def, tintShade);
    }
    const trajectory = [];
    const start = [...pos];
    let [x, y, z] = pos;
    let [vx, vy, vz] = vel;

    for (let age = 0; age <= life; age++) {
      const progress = age / life;
      let px = x; let py = y; let pz = z;
      if (def.vel === 'fly') {
        const f = 1 - progress;
        const f1 = Math.pow(1 - f, 4);
        px = start[0] + vel[0] * f;
        py = start[1] + vel[1] * f - f1 * 1.2;
        pz = start[2] + vel[2] * f;
      }
      let alpha = 1;
      if (def.fadeFrom !== undefined) alpha = progress > def.fadeFrom ? 1 - (progress - def.fadeFrom) : 1;
      else if (def.fade > 0 && progress > 1 - def.fade) alpha = Math.max(0, (1 - progress) / def.fade);
      let frame = 0;
      if (def.sprite === 'age') frame = Math.min(spriteCount - 1, Math.floor(progress * spriteCount));
      else if (def.sprite === 'random') frame = spriteIndex;
      const shrink = 1 - def.shrink * progress * progress;
      trajectory.push([px, py, pz, size * shrink, alpha, Math.max(0, frame), color]);

      vy -= 0.04 * def.gravity;
      vy += def.rise;
      x += vx; y += vy; z += vz;
      vx *= def.friction; vy *= def.friction; vz *= def.friction;
    }
    particles.push({ trajectory, life });
  }
  return { particles, def };
}

export function colourFor(def, shade) {
  if (def.tint === '#ffffff') return null;
  const r = parseInt(def.tint.slice(1, 3), 16);
  const g = parseInt(def.tint.slice(3, 5), 16);
  const b = parseInt(def.tint.slice(5, 7), 16);
  return `rgb(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)})`;
}

export class ParticleField {
  constructor() { this.cache = new Map(); this.version = 0; }

  clear() { this.cache.clear(); this.version++; }

  batch(event, key, fireTick, eventIndex, spriteCount) {
    const id = `${eventIndex}:${fireTick}:${key}:${event.count}:${event.offsetX}:${event.offsetY}:${event.offsetZ}:${event.speed}`;
    let entry = this.cache.get(id);
    if (!entry) {
      if (this.cache.size > 400) this.cache.clear();
      entry = simulateBatch(event, key, fireTick, eventIndex, spriteCount);
      this.cache.set(id, entry);
    }
    return entry;
  }
}
