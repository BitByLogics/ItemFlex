import { evalProperty } from './core.js';
import {
  mc, loadFont, loadGeometry, loadImage, tintedImage, displayTransformFn, rotateNormal, drawGeometry, drawQuadTexture, itemName,
} from './mc.js';
import { ParticleField, ensureSprites, particleDef } from './particles.js';

const RAD = Math.PI / 180;
const TEXT_UNIT = 1 / 40;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

const mat3Mul = (a, b) => {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};
const mat3Apply = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

function rotationMatrix(yDeg, xDeg, zDeg) {
  const [cy, sy] = [Math.cos(yDeg * RAD), Math.sin(yDeg * RAD)];
  const [cx, sx] = [Math.cos(xDeg * RAD), Math.sin(xDeg * RAD)];
  const [cz, sz] = [Math.cos(zDeg * RAD), Math.sin(zDeg * RAD)];
  const ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return mat3Mul(mat3Mul(ry, rx), rz);
}

const COLORS = {
  0: '#000000', 1: '#0000aa', 2: '#00aa00', 3: '#00aaaa', 4: '#aa0000', 5: '#aa00aa', 6: '#ffaa00', 7: '#aaaaaa',
  8: '#555555', 9: '#5555ff', a: '#55ff55', b: '#55ffff', c: '#ff5555', d: '#ff55ff', e: '#ffff55', f: '#ffffff',
};

export function parseColored(input) {
  const segments = [];
  let style = { color: '#ffffff', bold: false, italic: false, underline: false, strike: false };
  let buffer = '';
  const flush = () => { if (buffer) { segments.push({ text: buffer, ...style }); buffer = ''; } };
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const hex = input.slice(i + (ch === '&' ? 1 : 0)).match(/^#([0-9a-fA-F]{6})/);
    if ((ch === '#' || (ch === '&' && input[i + 1] === '#')) && hex) {
      flush();
      style = { color: `#${hex[1]}`, bold: false, italic: false, underline: false, strike: false };
      i += (ch === '&' ? 1 : 0) + 6;
      continue;
    }
    if ((ch === '&' || ch === '§') && i + 1 < input.length) {
      const code = input[i + 1].toLowerCase();
      if (COLORS[code]) {
        flush();
        style = { color: COLORS[code], bold: false, italic: false, underline: false, strike: false };
        i++;
        continue;
      }
      if ('lonmkr'.includes(code)) {
        flush();
        if (code === 'l') style = { ...style, bold: true };
        if (code === 'o') style = { ...style, italic: true };
        if (code === 'n') style = { ...style, underline: true };
        if (code === 'm') style = { ...style, strike: true };
        if (code === 'r') style = { color: '#ffffff', bold: false, italic: false, underline: false, strike: false };
        i++;
        continue;
      }
    }
    buffer += ch;
  }
  flush();
  return segments;
}

function lastFire(event, tick) {
  if (tick < event.tick) return -1;
  if (!event.every || event.every <= 0) return event.tick;
  let last = tick;
  if (event.until > 0 && tick > event.until) last = event.until;
  return event.tick + Math.floor((last - event.tick) / event.every) * event.every;
}

export function shouldFire(event, tick) {
  if (tick < event.tick) return false;
  if (!event.every || event.every <= 0) return tick === event.tick;
  if (event.until > 0 && tick > event.until) return false;
  return (tick - event.tick) % event.every === 0;
}

/* canvas based stand-in used until (or unless) the real bitmap font is available */
const fallbackFont = {
  render(segments, shadow) {
    const probe = document.createElement('canvas').getContext('2d');
    const fontFor = (s) => `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}8px "Segoe UI", Arial, sans-serif`;
    const widths = segments.map((s) => { probe.font = fontFor(s); return probe.measureText(s.text).width; });
    const width = Math.ceil(widths.reduce((a, b) => a + b, 0));
    const pad = 4;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width + 2);
    canvas.height = 9 + pad + 2;
    const g = canvas.getContext('2d');
    g.textBaseline = 'alphabetic';
    const draw = (offset, dark) => {
      let x = 0;
      segments.forEach((s, i) => {
        g.font = fontFor(s);
        g.fillStyle = dark ? '#222' : s.color;
        g.fillText(s.text, x + offset, pad + 7 + offset);
        x += widths[i];
      });
    };
    if (shadow) draw(1, true);
    draw(0, false);
    return { canvas, width, pad };
  },
};

const SAMPLE_LORE = ['&7Sample lore line one', '&7Sample lore line two'];
const SAMPLE_ENCHANTS = ['&6Sharpness &fV', '&6Unbreaking &fIII'];

export class Preview {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.def = null;
    this.tick = 0;
    this.item = { id: 'diamond_sword', name: 'Diamond Sword', block: false };
    this.geometry = null;
    this.font = null;
    this.groundImage = null;
    this.cam = { yaw: 115, pitch: 14, dist: 5.2, target: [0, 1.5, 0.9] };
    this.particleKeys = {};
    this.particles = new ParticleField();
    this.textCache = new Map();
    this.options = { floor: 'studio', player: true, particles: true };

    this.bindControls();
    new ResizeObserver(() => { this.resize(); this.render(); }).observe(canvas);
    this.resize();
  }

  async initAssets() {
    this.font = await loadFont();
    this.groundImage = await loadImage('/assets/mc/textures/block/grass_block_top.png');
    this.foliage = (await Promise.all(['short_grass', 'short_grass', 'short_grass', 'fern', 'dandelion', 'poppy', 'azure_bluet', 'cornflower'].map(async (name) => {
      const image = await loadImage(`/assets/mc/textures/block/${name}.png`).catch(() => null);
      if (!image) return null;
      const plant = name.includes('grass') || name === 'fern';
      return { image: plant ? tintedImage(image, '#91bd59') : image, flower: !plant };
    }))).filter(Boolean);
    this.skin = await loadImage('/assets/mc/textures/entity/player/wide/steve.png').catch(() => null);
    await this.setItem(this.item.id);
  }

  async setItem(id) {
    this.item.id = id;
    this.item.name = itemName(id);
    this.item.block = !!mc.lang[`block.minecraft.${id}`];
    this.geometry = null;
    this.render();
    this.geometry = await loadGeometry(id);
    this.render();
  }

  bindControls() {
    let dragging = false;
    let panning = false;
    let last = null;
    const stop = () => { dragging = false; panning = false; };
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      panning = e.button === 2 || e.button === 1 || e.shiftKey;
      last = [e.clientX, e.clientY];
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
    this.canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - last[0];
      const dy = e.clientY - last[1];
      last = [e.clientX, e.clientY];
      if (panning && this.view) {
        const scale = (this.cam.dist / (this.height * 1.05)) * 1.0;
        const { right, up } = this.view;
        this.cam.target = add(this.cam.target, add(mul(right, -dx * scale), mul(up, dy * scale)));
        this.cam.target[1] = Math.max(0, this.cam.target[1]);
      } else {
        this.cam.yaw -= dx * 0.4;
        this.cam.pitch = Math.max(-80, Math.min(80, this.cam.pitch + dy * 0.3));
      }
      this.render();
    });
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cam.dist = Math.max(1.5, Math.min(14, this.cam.dist * (e.deltaY > 0 ? 1.08 : 0.92)));
      this.render();
    }, { passive: false });
  }

  resetCamera() {
    this.cam = { yaw: 115, pitch: 14, dist: 5.2, target: [0, 1.5, 0.9] };
    this.render();
  }

  resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.ratio = ratio;
  }

  setDefinition(def) { this.def = def; }
  setTick(tick) { this.tick = tick; }
  invalidateParticles() { this.particles.clear(); }

  camera() {
    const { yaw, pitch, dist, target } = this.cam;
    const eye = add(target, [
      dist * Math.sin(yaw * RAD) * Math.cos(pitch * RAD),
      dist * Math.sin(pitch * RAD),
      dist * Math.cos(yaw * RAD) * Math.cos(pitch * RAD),
    ]);
    const forward = norm(sub(target, eye));
    const right = norm(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);
    return { eye, forward, right, up };
  }

  project(p) {
    const { eye, forward, right, up } = this.view;
    const v = sub(p, eye);
    const z = dot(v, forward);
    if (z < 0.05) return null;
    const focal = this.height * 1.05;
    return [this.width / 2 + (dot(v, right) / z) * focal, this.height / 2 - (dot(v, up) / z) * focal, z];
  }

  resolveLines() {
    const lines = [];
    const name = `&f${this.item.name}`;
    for (const raw of this.def.text.lines) {
      if (raw.includes('%item_lore%')) { SAMPLE_LORE.forEach((l) => lines.push(l)); continue; }
      if (raw.includes('%item_enchants%')) { SAMPLE_ENCHANTS.forEach((l) => lines.push(l)); continue; }
      lines.push(raw.replaceAll('%item_name%', name));
    }
    return lines;
  }

  lineTextAt(lines, index, tick) {
    let text = lines[index];
    let best = -1;
    for (const event of this.def.events) {
      if (event.type !== 'TEXT' || event.line !== index) continue;
      const fired = lastFire(event, tick);
      if (fired > best) { best = fired; text = (event.text || '').replaceAll('%item_name%', `&f${this.item.name}`); }
    }
    return text;
  }

  render() {
    if (this.pending) return;
    this.pending = true;
    const run = () => {
      if (!this.pending) return;
      this.pending = false;
      this.draw();
    };
    requestAnimationFrame(run);
    setTimeout(run, 40);
  }

  draw() {
    const ctx = this.ctx;
    const ratio = this.ratio || 1;
    this.width = this.canvas.width / ratio;
    this.height = this.canvas.height / ratio;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const grass = this.options.floor === 'grass';
    const backdrop = ctx.createLinearGradient(0, 0, 0, this.height);
    if (grass) {
      const horizon = Math.min(0.9, Math.max(0.08, (this.height / 2 - this.height * 1.05 * Math.tan(this.cam.pitch * RAD)) / this.height));
      backdrop.addColorStop(0, '#4a86d4');
      backdrop.addColorStop(horizon * 0.6, '#7fb2ec');
      backdrop.addColorStop(horizon, '#c4dcf4');
      backdrop.addColorStop(Math.min(1, horizon + 0.25), '#6f9fd8');
      backdrop.addColorStop(1, '#5a8ccb');
    } else {
      backdrop.addColorStop(0, '#0b0e15');
      backdrop.addColorStop(0.55, '#141927');
      backdrop.addColorStop(1, '#0d1018');
    }
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, this.width, this.height);

    if (!this.def) return;
    this.view = this.camera();
    this.base = ratio;

    const started = performance.now();
    if (this.options.floor === 'studio') this.drawCachedStudioFloor(ratio);
    else if (grass) this.drawGround();
    const floorDone = performance.now();

    const drawables = [];
    if (this.options.player) this.collectPlayer(drawables);
    this.collectHologram(drawables);
    if (grass) this.collectFoliage(drawables);
    const before = drawables.length;
    if (this.options.particles) this.collectParticles(drawables);
    const particleCount = drawables.length - before;

    drawables.sort((a, b) => b.depth - a.depth);
    drawables.forEach((d) => { ctx.save(); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); d.draw(); ctx.restore(); });
    const done = performance.now();
    this.stats = { floorMs: floorDone - started, sceneMs: done - floorDone, totalMs: done - started, drawables: drawables.length, particles: particleCount, renders: (this.stats?.renders || 0) + 1 };

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.drawEventLog();
  }

  projectLine(a, b) {
    const { eye, forward } = this.view;
    let da = dot(sub(a, eye), forward) - 0.1;
    let db = dot(sub(b, eye), forward) - 0.1;
    if (da < 0 && db < 0) return null;
    let p = a;
    let q = b;
    if (da < 0) { p = add(a, mul(sub(b, a), da / (da - db))); }
    if (db < 0) { q = add(a, mul(sub(b, a), da / (da - db))); }
    const pa = this.project(p);
    const pb = this.project(q);
    return pa && pb ? [pa, pb] : null;
  }

  drawCachedStudioFloor(ratio) {
    const view = [this.width, this.height, ratio, ...this.view.eye, ...this.view.forward].map((v) => Math.round(v * 1000)).join(',');
    if (this.studioKey !== view) {
      if (!this.studioCanvas) this.studioCanvas = document.createElement('canvas');
      this.studioCanvas.width = this.canvas.width;
      this.studioCanvas.height = this.canvas.height;
      const main = this.ctx;
      this.ctx = this.studioCanvas.getContext('2d');
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      try {
        this.drawStudioFloor();
      } finally {
        this.ctx = main;
      }
      this.studioKey = view;
    }
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.studioCanvas, 0, 0);
    this.ctx.restore();
  }

  drawStudioFloor() {
    const ctx = this.ctx;
    const radius = 6.5;
    const centre = this.project([0, 0, 0]);
    const tilt = Math.min(1, Math.max(0.15, 1 - (Math.abs(this.cam.pitch) - 25) / 45));
    const layers = 14;
    for (let layer = 0; layer < layers; layer++) {
      const ring = radius * (1 - layer / layers);
      const rim = [];
      for (let i = 0; i < 48; i++) {
        const angle = (i / 48) * Math.PI * 2;
        rim.push(this.project([Math.cos(angle) * ring, 0, Math.sin(angle) * ring]));
      }
      if (!centre || rim.some((p) => !p)) continue;
      ctx.fillStyle = `rgba(110, 125, 235, ${0.011 * tilt})`;
      ctx.beginPath();
      rim.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
    }

    ctx.lineCap = 'round';
    const step = 1;
    const extent = 8;
    const fade = (x, z) => Math.max(0, 1 - Math.hypot(x, z) / extent);
    const segment = (a, b, major) => {
      const mid = fade((a[0] + b[0]) / 2, (a[2] + b[2]) / 2);
      if (mid <= 0.02) return;
      const line = this.projectLine(a, b);
      if (!line) return;
      ctx.strokeStyle = major ? `rgba(150, 165, 255, ${0.34 * mid * mid})` : `rgba(130, 145, 220, ${0.16 * mid * mid})`;
      ctx.lineWidth = major ? 1.2 : 1;
      ctx.beginPath();
      ctx.moveTo(line[0][0], line[0][1]);
      ctx.lineTo(line[1][0], line[1][1]);
      ctx.stroke();
    };
    for (let i = -extent; i <= extent; i += step) {
      const major = Math.abs(i % 4) < 1e-6;
      for (let j = -extent; j < extent; j += step) {
        segment([i, 0, j], [i, 0, j + step], major);
        segment([j, 0, i], [j + step, 0, i], major);
      }
    }

    for (const [ring, alpha] of [[0.9, 0.5], [1.5, 0.3], [2.4, 0.16]]) {
      const points = [];
      for (let i = 0; i <= 72; i++) {
        const angle = (i / 72) * Math.PI * 2;
        points.push(this.project([Math.cos(angle) * ring, 0, Math.sin(angle) * ring]));
      }
      if (points.some((p) => !p)) continue;
      ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
      ctx.lineWidth = ring < 1 ? 1.6 : 1.2;
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }

    const shadow = [];
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      shadow.push(this.project([Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5]));
    }
    if (centre && shadow.every((p) => p)) {
      const size = Math.max(...shadow.map((p) => Math.hypot(p[0] - centre[0], p[1] - centre[1])));
      const dark = ctx.createRadialGradient(centre[0], centre[1], 0, centre[0], centre[1], size);
      dark.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      dark.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = dark;
      ctx.beginPath();
      shadow.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
    }
  }

  grassTile() {
    if (this.tile) return this.tile;
    const tinted = tintedImage(this.groundImage, '#91bd59');
    const size = tinted.width;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const g = canvas.getContext('2d');
    g.drawImage(tinted, 0, 0);
    const data = g.getImageData(0, 0, size, size).data;
    const sums = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      sums[0] += data[i];
      sums[1] += data[i + 1];
      sums[2] += data[i + 2];
    }
    const count = data.length / 4;
    this.tile = { data, size, average: sums.map((v) => v / count) };
    return this.tile;
  }

  groundTexture() {
    if (this.groundBake) return this.groundBake;
    const tile = this.grassTile();
    const blocks = 24;
    const size = blocks * tile.size;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const g = canvas.getContext('2d');
    const source = document.createElement('canvas');
    source.width = tile.size;
    source.height = tile.size;
    source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(tile.data), tile.size, tile.size), 0, 0);
    let seed = 5;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const noise = Array.from({ length: 9 * 9 }, () => random());
    const smooth = (x, z) => {
      const ix = Math.floor(x);
      const iz = Math.floor(z);
      const fx = x - ix;
      const fz = z - iz;
      const sx = fx * fx * (3 - 2 * fx);
      const sz = fz * fz * (3 - 2 * fz);
      const n = (a, b) => noise[(b % 9) * 9 + (a % 9)];
      return (n(ix, iz) * (1 - sx) + n(ix + 1, iz) * sx) * (1 - sz) + (n(ix, iz + 1) * (1 - sx) + n(ix + 1, iz + 1) * sx) * sz;
    };
    g.imageSmoothingEnabled = false;
    for (let bx = 0; bx < blocks; bx++) {
      for (let bz = 0; bz < blocks; bz++) {
        g.save();
        g.translate(bx * tile.size + tile.size / 2, bz * tile.size + tile.size / 2);
        g.rotate(Math.floor(random() * 4) * Math.PI / 2);
        g.drawImage(source, -tile.size / 2, -tile.size / 2);
        g.restore();
      }
    }
    const image = g.getImageData(0, 0, size, size);
    const px = image.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const light = 1.18 + 0.3 * smooth((x / size) * 7.5, (y / size) * 7.5);
        const o = (y * size + x) * 4;
        px[o] = Math.min(255, px[o] * light);
        px[o + 1] = Math.min(255, px[o + 1] * light);
        px[o + 2] = Math.min(255, px[o + 2] * light);
      }
    }
    this.groundBake = { data: px, size, blocks, texels: tile.size, average: tile.average.map((v) => v * 1.33) };
    return this.groundBake;
  }

  drawGround() {
    if (!this.groundImage) return;
    const { eye, forward, right, up } = this.view;
    const w = this.width;
    const h = this.height;
    const view = [w, h, ...eye, ...forward].map((v) => Math.round(v * 1000)).join(',');
    const now = performance.now();

    if (this.groundView !== view) {
      this.groundView = view;
      this.groundMoving = now + 180;
      clearTimeout(this.groundRefine);
      this.groundRefine = setTimeout(() => this.render(), 200);
    }

    const scale = now < this.groundMoving ? 0.5 : 1;
    const key = `${view}|${scale}`;

    if (this.groundKey !== key) {
      const bw = Math.max(1, Math.ceil(w * scale));
      const bh = Math.max(1, Math.ceil(h * scale));
      if (!this.groundBuffer || this.groundBuffer.width !== bw || this.groundBuffer.height !== bh) {
        this.groundBuffer = document.createElement('canvas');
        this.groundBuffer.width = bw;
        this.groundBuffer.height = bh;
      }

      const bake = this.groundTexture();
      const data = bake.data;
      const average = bake.average;
      const sheet = bake.size;
      const perBlock = bake.texels;
      const half = bake.blocks / 2;
      const g = this.groundBuffer.getContext('2d');
      const image = g.createImageData(bw, bh);
      const out = image.data;
      const focal = h * 1.05;
      const radius = 9;

      for (let py = 0; py < bh; py++) {
        const vy = h / 2 - (py + 0.5) / scale;
        for (let px = 0; px < bw; px++) {
          const vx = (px + 0.5) / scale - w / 2;
          const dy = forward[1] * focal + right[1] * vx + up[1] * vy;
          if (dy >= -1e-6) continue;
          const t = -eye[1] / dy;
          if (t <= 0) continue;
          const dx = forward[0] * focal + right[0] * vx + up[0] * vy;
          const dz = forward[2] * focal + right[2] * vx + up[2] * vy;
          const x = eye[0] + dx * t;
          const z = eye[2] + dz * t;
          const reach = Math.sqrt(x * x + z * z);
          if (reach >= radius) continue;
          const distance = (t * Math.sqrt(dx * dx + dy * dy + dz * dz)) / focal;
          const texel = focal / (distance * perBlock);
          const mix = Math.min(0.8, Math.max(0, 1 - texel * 0.6));
          const sharp = Math.max(1, texel);

          const u = (x + half) * perBlock - 0.5;
          const v = (z + half) * perBlock - 0.5;
          const u0 = Math.floor(u);
          const v0 = Math.floor(v);
          const fu = Math.min(1, Math.max(0, (u - u0 - 0.5) * sharp + 0.5));
          const fv = Math.min(1, Math.max(0, (v - v0 - 0.5) * sharp + 0.5));
          const a = (v0 * sheet + u0) * 4;
          const b = a + 4;
          const c = a + sheet * 4;
          const d = c + 4;
          const o = (py * bw + px) * 4;
          const shade = (reach < 0.7 ? 1 - 0.4 * (1 - reach / 0.7) : 1) * (reach > radius - 0.35 ? 0.78 : 1);
          for (let k = 0; k < 3; k++) {
            const sample = (data[a + k] * (1 - fu) + data[b + k] * fu) * (1 - fv) + (data[c + k] * (1 - fu) + data[d + k] * fu) * fv;
            out[o + k] = (sample * (1 - mix) + average[k] * mix) * shade;
          }
          out[o + 3] = 255 * Math.min(1, (radius - reach) * 40 / scale);
        }
      }
      g.putImageData(image, 0, 0);
      this.groundKey = key;
    }

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.groundBuffer, 0, 0, w, h);
  }

  collectFoliage(list) {
    if (!this.foliage || this.foliage.length === 0) return;
    if (!this.tufts) {
      let seed = 11;
      const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      this.tufts = [];
      while (this.tufts.length < 36) {
        const x = (random() * 2 - 1) * 7;
        const z = (random() * 2 - 1) * 7;
        const pick = this.foliage[Math.floor(random() * this.foliage.length)];
        if (Math.hypot(x, z) > 7 || Math.hypot(x, z - 0.4) < 1.1 || Math.hypot(x, z - 1.5) < 0.8) continue;
        if (pick.flower && random() < 0.5) continue;
        this.tufts.push({ x, z, pick, size: 0.6 + random() * 0.3, angle: random() * Math.PI });
      }
    }
    for (const tuft of this.tufts) {
      const centre = this.project([tuft.x, tuft.size / 2, tuft.z]);
      if (!centre) continue;
      const planes = [tuft.angle, tuft.angle + Math.PI / 2].map((angle) => {
        const dx = Math.cos(angle) * tuft.size * 0.5;
        const dz = Math.sin(angle) * tuft.size * 0.5;
        return [[tuft.x - dx, tuft.size, tuft.z - dz], [tuft.x + dx, tuft.size, tuft.z + dz], [tuft.x + dx, 0, tuft.z + dz], [tuft.x - dx, 0, tuft.z - dz]].map((c) => this.project(c));
      });
      if (planes.some((pts) => pts.some((q) => !q || q[2] < 1.2))) continue;
      list.push({
        depth: centre[2],
        draw: () => {
          const ctx = this.ctx;
          ctx.imageSmoothingEnabled = false;
          for (const pts of planes) drawQuadTexture(ctx, tuft.pick.image, pts, [[0, 0], [16, 0], [16, 16], [0, 16]]);
        },
      });
    }
  }

  collectPlayer(list) {
    if (!this.skin) { this.collectBoxPlayer(list); return; }
    const px = 1.8 / 32;
    const part = (u, v, w, h, d, x, y, z, grow) => ({ u, v, w, h, d, grow, min: [x * px, y * px, z * px], max: [(x + w) * px, (y + h) * px, (z + d) * px] });
    const parts = [
      part(0, 16, 4, 12, 4, -4, 0, -2, 0), part(16, 48, 4, 12, 4, 0, 0, -2, 0),
      part(16, 16, 8, 12, 4, -4, 12, -2, 0),
      part(40, 16, 4, 12, 4, -8, 12, -2, 0), part(32, 48, 4, 12, 4, 4, 12, -2, 0),
      part(0, 0, 8, 8, 8, -4, 24, -4, 0),
      part(0, 32, 4, 12, 4, -4, 0, -2, 0.25), part(0, 48, 4, 12, 4, 0, 0, -2, 0.25),
      part(16, 32, 8, 12, 4, -4, 12, -2, 0.25),
      part(40, 32, 4, 12, 4, -8, 12, -2, 0.25), part(48, 48, 4, 12, 4, 4, 12, -2, 0.25),
      part(32, 0, 8, 8, 8, -4, 24, -4, 0.5),
    ];
    for (const p of parts) {
      const center = mul(add(p.min, p.max), 0.5);
      const depth = this.project(center)?.[2] ?? 999;
      list.push({ depth: depth + 0.6 - p.grow * 0.01, draw: () => this.drawSkinBox(p, px) });
    }
  }

  shadedSkin(k) {
    const level = Math.round(k * 20) / 20;
    this.skinShades = this.skinShades || new Map();
    if (!this.skinShades.has(level)) {
      const canvas = document.createElement('canvas');
      canvas.width = this.skin.width;
      canvas.height = this.skin.height;
      const c = canvas.getContext('2d');
      c.drawImage(this.skin, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = `rgba(0,0,0,${1 - level})`;
      c.fillRect(0, 0, canvas.width, canvas.height);
      this.skinShades.set(level, canvas);
    }
    return this.skinShades.get(level);
  }

  drawSkinBox(p, px) {
    const g = p.grow * px;
    const [x0, y0, z0] = [p.min[0] - g, p.min[1] - g, p.min[2] - g];
    const [x1, y1, z1] = [p.max[0] + g, p.max[1] + g, p.max[2] + g];
    const { u, v, w, h, d } = p;
    const faces = [
      { n: [0, 0, 1], c: [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]], r: [u + d, v + d, w, h] },
      { n: [0, 0, -1], c: [[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]], r: [u + 2 * d + w, v + d, w, h] },
      { n: [-1, 0, 0], c: [[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]], r: [u, v + d, d, h] },
      { n: [1, 0, 0], c: [[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]], r: [u + d + w, v + d, d, h] },
      { n: [0, 1, 0], c: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], r: [u + d, v, w, d] },
      { n: [0, -1, 0], c: [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], r: [u + d + w, v, w, d] },
    ];
    const light = norm([0.4, 1, 0.6]);
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    const visible = [];
    for (const face of faces) {
      const faceCenter = mul(face.c.reduce((acc, c) => add(acc, c), [0, 0, 0]), 0.25);
      if (dot(face.n, sub(this.view.eye, faceCenter)) <= 0) continue;
      const projected = face.c.map((c) => this.project(c));
      if (projected.some((q) => !q)) continue;
      const mid = [projected.reduce((a, q) => a + q[0], 0) / 4, projected.reduce((a, q) => a + q[1], 0) / 4];
      const pts = projected.map((q) => {
        const length = Math.hypot(q[0] - mid[0], q[1] - mid[1]) || 1;
        return [q[0] + ((q[0] - mid[0]) / length) * 0.7, q[1] + ((q[1] - mid[1]) / length) * 0.7, q[2]];
      });
      const k = 0.6 + 0.4 * Math.max(0, dot(face.n, light));
      visible.push({ face, pts, projected, k });
    }

    for (const { face, projected, k } of visible) {
      const average = this.faceAverage(k, face.r);
      if (!average) continue;
      ctx.fillStyle = average;
      ctx.beginPath();
      projected.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fill();
    }

    for (const { face, pts, k } of visible) {
      const [ru, rv, rw, rh] = face.r;
      drawQuadTexture(ctx, this.shadedSkin(k), pts, [[ru, rv], [ru + rw, rv], [ru + rw, rv + rh], [ru, rv + rh]]);
    }
  }

  faceAverage(k, region) {
    const level = Math.round(k * 20) / 20;
    const key = `${level}|${region.join(',')}`;
    this.faceAverages = this.faceAverages || new Map();
    if (!this.faceAverages.has(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.drawImage(this.shadedSkin(k), region[0], region[1], region[2], region[3], 0, 0, 1, 1);
      const [r, gr, b, alpha] = g.getImageData(0, 0, 1, 1).data;
      this.faceAverages.set(key, alpha < 200 ? null : `rgb(${r}, ${gr}, ${b})`);
    }
    return this.faceAverages.get(key);
  }

  collectBoxPlayer(list) {
    const parts = [
      { min: [-0.25, 0, -0.12], max: [0.0, 0.7, 0.12], color: '#3b4c8a' },
      { min: [0.0, 0, -0.12], max: [0.25, 0.7, 0.12], color: '#3b4c8a' },
      { min: [-0.25, 0.7, -0.12], max: [0.25, 1.4, 0.12], color: '#2f9d9d' },
      { min: [-0.4, 0.7, -0.12], max: [-0.25, 1.4, 0.12], color: '#c89b7b' },
      { min: [0.25, 0.7, -0.12], max: [0.4, 1.4, 0.12], color: '#c89b7b' },
      { min: [-0.25, 1.4, -0.25], max: [0.25, 1.9, 0.25], color: '#c89b7b' },
    ];
    for (const part of parts) {
      const center = mul(add(part.min, part.max), 0.5);
      const depth = this.project(center)?.[2] ?? 999;
      list.push({ depth: depth + 0.6, draw: () => this.drawBox(part.min, part.max, part.color) });
    }
  }

  drawBox(min, max, color) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const corners = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const faces = [
      { idx: [0, 1, 2, 3], n: [0, 0, -1] }, { idx: [4, 5, 6, 7], n: [0, 0, 1] },
      { idx: [0, 3, 7, 4], n: [-1, 0, 0] }, { idx: [1, 2, 6, 5], n: [1, 0, 0] },
      { idx: [3, 2, 6, 7], n: [0, 1, 0] }, { idx: [0, 1, 5, 4], n: [0, -1, 0] },
    ];
    const ctx = this.ctx;
    const center = mul(corners.reduce((acc, c) => add(acc, c), [0, 0, 0]), 1 / 8);
    const light = norm([0.4, 1, 0.6]);
    for (const face of faces) {
      const faceCenter = mul(face.idx.reduce((acc, i) => add(acc, corners[i]), [0, 0, 0]), 0.25);
      const outward = dot(face.n, sub(faceCenter, center)) >= 0 ? face.n : mul(face.n, -1);
      if (dot(outward, sub(this.view.eye, faceCenter)) <= 0) continue;
      const pts = face.idx.map((i) => this.project(corners[i]));
      if (pts.some((p) => !p)) continue;
      const k = 0.55 + 0.45 * Math.max(0, dot(outward, light));
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      ctx.fillStyle = `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  anchor(tick) {
    const def = this.def;
    const forward = def.spawn.distance + evalProperty(def, 'ROOT', 'FORWARD', 0, tick);
    return [
      def.spawn.offset.x + evalProperty(def, 'ROOT', 'OFFSET_X', 0, tick),
      def.spawn.offset.y + evalProperty(def, 'ROOT', 'OFFSET_Y', 0, tick),
      forward + def.spawn.offset.z + evalProperty(def, 'ROOT', 'OFFSET_Z', 0, tick),
    ];
  }

  baseScale() {
    return this.item.block ? this.def.item.blockScale : this.def.item.itemScale;
  }

  rotation(target, line, tick) {
    return rotationMatrix(
      evalProperty(this.def, target, 'ROTATION_Y', line, tick),
      evalProperty(this.def, target, 'ROTATION_X', line, tick),
      evalProperty(this.def, target, 'ROTATION_Z', line, tick),
    );
  }

  itemCenter(tick) {
    const def = this.def;
    return add(this.anchor(tick), [
      def.spawn.itemOffset.x + evalProperty(def, 'ITEM', 'OFFSET_X', 0, tick),
      def.spawn.itemOffset.y + evalProperty(def, 'ITEM', 'OFFSET_Y', 0, tick),
      def.spawn.itemOffset.z + evalProperty(def, 'ITEM', 'OFFSET_Z', 0, tick),
    ]);
  }

  collectHologram(list) {
    if (this.tick > this.def.duration) return;
    const tick = this.tick;
    const scale = this.baseScale() * Math.max(0, evalProperty(this.def, 'ITEM', 'SCALE', 0, tick));
    const center = this.itemCenter(tick);
    const rot = this.rotation('ITEM', 0, tick);
    const depth = this.project(center)?.[2] ?? 999;

    if (scale > 0.001) list.push({ depth, draw: () => this.drawItem(center, rot, scale) });

    const lines = this.resolveLines();
    const total = lines.length;
    const anchor = this.anchor(tick);
    const billboard = this.def.text.billboard;
    const right = billboard === 'FIXED' || billboard === 'HORIZONTAL' ? [1, 0, 0] : norm([this.view.right[0], 0, this.view.right[2]]);
    const up = billboard === 'CENTER' ? this.view.up : [0, 1, 0];
    const normal = norm(cross(right, up));

    lines.forEach((_, i) => {
      const fromBottom = total - 1 - i;
      const lineScale = this.baseScale() * Math.max(0, evalProperty(this.def, 'TEXT', 'SCALE', i, tick));
      const opacity = Math.max(0, Math.min(1, evalProperty(this.def, 'TEXT', 'OPACITY', i, tick)));
      if (lineScale < 0.001 || opacity <= 0.02) return;
      const origin = add(anchor, [
        evalProperty(this.def, 'TEXT', 'OFFSET_X', i, tick),
        this.def.text.lineSpacing * (fromBottom + 1) + evalProperty(this.def, 'TEXT', 'OFFSET_Y', i, tick),
        evalProperty(this.def, 'TEXT', 'OFFSET_Z', i, tick),
      ]);
      const rot2 = this.rotation('TEXT', i, tick);
      const toWorld = (v) => {
        const l = mat3Apply(rot2, v);
        return add(add(mul(right, l[0]), mul(up, l[1])), mul(normal, l[2]));
      };
      const text = this.lineTextAt(lines, i, Math.floor(tick));
      const d = this.project(origin)?.[2] ?? 999;
      list.push({ depth: d - 0.01, draw: () => this.drawText(text, origin, toWorld([1, 0, 0]), toWorld([0, 1, 0]), lineScale * TEXT_UNIT, opacity) });
    });
  }

  textCanvas(text) {
    const bg = this.def.text.background;
    const shadow = this.def.text.shadow;
    const font = this.font || fallbackFont;
    const key = `${this.font ? 1 : 0}|${shadow}|${bg.opacity},${bg.red},${bg.green},${bg.blue}|${text}`;
    let entry = this.textCache.get(key);
    if (!entry) {
      if (this.textCache.size > 300) this.textCache.clear();
      const rendered = font.render(parseColoredSafe(text), shadow);
      if (bg.opacity > 0) {
        const composite = document.createElement('canvas');
        composite.width = rendered.canvas.width + 2;
        composite.height = rendered.canvas.height;
        const g = composite.getContext('2d');
        g.fillStyle = `rgba(${bg.red},${bg.green},${bg.blue},${bg.opacity / 255})`;
        g.fillRect(0, rendered.pad - 1, composite.width, 11);
        g.drawImage(rendered.canvas, 1, 0);
        entry = { canvas: composite, width: rendered.width + 2, pad: rendered.pad, shift: 1 };
      } else {
        entry = { ...rendered, shift: 0 };
      }
      this.textCache.set(key, entry);
    }
    return entry;
  }

  drawText(text, origin, xAxis, yAxis, unit, opacity) {
    const ctx = this.ctx;
    const { canvas, pad } = this.textCanvas(text);
    const w = canvas.width;
    const h = canvas.height;
    const left = -w / 2;
    const top = pad + 9;
    const point = (cx, cy) => add(origin, add(mul(xAxis, (left + cx) * unit), mul(yAxis, (top - cy) * unit)));
    const pts = [point(0, 0), point(w, 0), point(w, h), point(0, h)].map((p) => this.project(p));
    if (pts.some((p) => !p)) return;
    ctx.globalAlpha = opacity;
    ctx.imageSmoothingEnabled = false;
    drawQuadTexture(ctx, canvas, pts, [[0, 0], [w, 0], [w, h], [0, h]]);
  }

  drawItem(center, rot, scale) {
    const ctx = this.ctx;
    const geometry = this.geometry;
    if (!geometry || geometry.empty) {
      const half = scale / 2;
      const quad = [[-half, half, 0], [half, half, 0], [half, -half, 0], [-half, -half, 0]]
        .map((p) => this.project(add(center, mat3Apply(rot, p))));
      if (quad.some((p) => !p)) return;
      ctx.fillStyle = 'rgba(255,200,60,0.85)';
      ctx.beginPath();
      quad.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      return;
    }
    const mode = this.def.item.displayTransform || 'GUI';
    const fn = displayTransformFn(geometry, mode);
    drawGeometry(ctx, geometry, {
      toWorld: (p) => add(center, mat3Apply(rot, mul(fn(p), scale))),
      toWorldNormal: (n) => mat3Apply(rot, rotateNormal(geometry, mode, n)),
      project: (p) => this.project(p),
      facing: (n, c) => dot(n, sub(this.view.eye, c)),
    });
  }

  particleKey(event) {
    return this.particleKeys[event.particle] || event.particle.toLowerCase();
  }

  collectParticles(list) {
    const tickFloor = Math.floor(this.tick);
    const frac = this.tick - tickFloor;
    this.def.events.forEach((event, index) => {
      if (event.type !== 'PARTICLE') return;
      const key = this.particleKey(event);
      const sprites = ensureSprites(key, () => this.render());
      if (!sprites || sprites.length === 0) return;
      const def = particleDef(key);
      const maxLife = def.life[1] + 1;
      for (let fire = Math.max(0, tickFloor - maxLife); fire <= tickFloor; fire++) {
        if (!shouldFire(event, fire)) continue;
        const age = tickFloor - fire;
        const origin = add(this.anchor(fire), [0, event.height || 0, 0]);
        const batch = this.particles.batch(event, key, fire, index, sprites.length);
        for (const particle of batch.particles) {
          if (age > particle.life) continue;
          const a = particle.trajectory[age];
          const b = particle.trajectory[Math.min(age + 1, particle.life)];
          const lerp = (i) => a[i] + (b[i] - a[i]) * frac;
          const world = add(origin, [lerp(0), lerp(1), lerp(2)]);
          const size = lerp(3);
          const alpha = lerp(4);
          const projected = this.project(world);
          if (!projected || alpha <= 0.01) continue;
          const sprite = sprites[Math.min(sprites.length - 1, a[5])];
          const tint = a[6];
          list.push({
            depth: projected[2],
            draw: () => {
              const px = (size * 2 * this.height * 1.05) / projected[2];
              const ctx = this.ctx;
              ctx.globalAlpha = Math.min(1, alpha);
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(tint ? tintedImage(sprite, tint) : sprite, projected[0] - px / 2, projected[1] - px / 2, px, px);
            },
          });
        }
      }
    });
  }

  drawEventLog() {
    const ctx = this.ctx;
    const rows = [];
    const tick = Math.floor(this.tick);
    for (const event of this.def.events) {
      for (let age = 0; age <= 12; age++) {
        if (tick - age >= 0 && shouldFire(event, tick - age) && (event.type === 'SOUND' || event.type === 'COMMAND' || event.type === 'MESSAGE')) {
          rows.push({ age, event });
          break;
        }
      }
    }
    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    rows.slice(0, 6).forEach((row, i) => {
      ctx.globalAlpha = Math.max(0.25, 1 - row.age / 13);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const label = row.event.type === 'SOUND' ? `♪ ${row.event.sound.replace('minecraft:', '')}`
        : row.event.type === 'MESSAGE' ? `chat: ${row.event.message.replace(/&[0-9a-fk-or]/gi, '').replaceAll('%player%', 'Steve').replaceAll('%item_name%', this.item.name)}`
        : `> ${row.event.command}`;
      const width = ctx.measureText(label.slice(0, 48)).width;
      ctx.fillRect(8, 8 + i * 20, width + 12, 18);
      ctx.fillStyle = row.event.type === 'SOUND' ? '#9fdcff' : row.event.type === 'MESSAGE' ? '#e3b6ff' : '#ffc98a';
      ctx.fillText(label.slice(0, 48), 14, 11 + i * 20);
    });
    ctx.globalAlpha = 1;
  }
}

function parseColoredSafe(text) {
  const segments = parseColored(text);
  return segments.length ? segments : [{ text: ' ', color: '#ffffff', bold: false, italic: false, underline: false, strike: false }];
}
