/* Minecraft asset access: textures, item/block models and the bitmap font.
 * Everything is fetched from /assets/, which the server fills from Mojang's own client files. */

const jsonCache = new Map();
const imageCache = new Map();
const tintCache = new Map();

export const stripNamespace = (ref) => (ref.includes(':') ? ref.split(':')[1] : ref);

export function getJson(url) {
  if (!jsonCache.has(url)) {
    jsonCache.set(url, fetch(url, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return jsonCache.get(url);
}

export function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(url, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return imageCache.get(url);
}

export const textureUrl = (ref) => `/assets/mc/textures/${stripNamespace(ref)}.png`;
export const loadTexture = (ref) => loadImage(textureUrl(ref));

export const mc = { ready: false, version: '', items: [], lang: {}, itemSet: new Set() };

export async function initAssets(onProgress) {
  for (let attempt = 0; attempt < 120; attempt++) {
    let status = null;
    try {
      status = await (await fetch('/api/assets/status', { credentials: 'same-origin', headers: { 'X-ItemFlex': '1' } })).json();
    } catch { /* retry */ }
    if (status && status.state === 'READY') {
      mc.version = status.version;
      mc.ready = true;
      break;
    }
    if (status && (status.state === 'FAILED' || status.state === 'DISABLED')) {
      onProgress?.(status.message || 'Minecraft assets are unavailable.');
      return false;
    }
    onProgress?.('Downloading Minecraft assets on the server...');
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!mc.ready) return false;

  const [items, lang] = await Promise.all([
    fetch('/api/assets/items', { credentials: 'same-origin', headers: { 'X-ItemFlex': '1' } }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    getJson('/assets/lang.json'),
  ]);
  mc.items = items;
  mc.itemSet = new Set(items);
  mc.lang = lang || {};
  return true;
}

export function itemName(id) {
  return mc.lang[`item.minecraft.${id}`] || mc.lang[`block.minecraft.${id}`]
    || id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ---------- tinting ---------- */

export function tintedImage(img, color) {
  if (!color || color === '#ffffff') return img;
  const key = `${img.src}|${color}`;
  if (tintCache.has(key)) return tintCache.get(key);
  if (tintCache.size > 600) tintCache.clear();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = color;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  tintCache.set(key, canvas);
  return canvas;
}

function intToColor(value) {
  const rgb = (value >>> 0) & 0xffffff;
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

/* ---------- bitmap font ---------- */

class BitmapFont {
  constructor() {
    this.glyphs = new Map();
    this.advances = new Map();
    this.tinted = new Map();
  }

  async load() {
    const def = await getJson('/assets/mc/font/include/default.json');
    if (!def) return false;
    for (const provider of def.providers) {
      if (provider.type === 'space') {
        Object.entries(provider.advances).forEach(([ch, advance]) => this.advances.set(ch, advance));
      }
    }
    for (const provider of def.providers.filter((p) => p.type === 'bitmap')) {
      const img = await loadImage(`/assets/mc/textures/${stripNamespace(provider.file)}`);
      if (!img) continue;
      const probe = document.createElement('canvas');
      probe.width = img.width;
      probe.height = img.height;
      const g = probe.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, img.width, img.height).data;
      const rows = provider.chars;
      const cols = [...rows[0]].length;
      const cellW = img.width / cols;
      const cellH = img.height / rows.length;
      const height = provider.height ?? 8;
      const ascent = provider.ascent ?? 7;
      rows.forEach((row, r) => {
        [...row].forEach((ch, c) => {
          if (ch === '\u0000' || this.glyphs.has(ch)) return;
          let actual = 0;
          for (let x = 0; x < cellW; x++) {
            for (let y = 0; y < cellH; y++) {
              if (data[((r * cellH + y) * img.width + c * cellW + x) * 4 + 3] > 0) { actual = Math.max(actual, x + 1); break; }
            }
          }
          if (actual === 0 && ch !== ' ') return;
          const scale = height / cellH;
          this.glyphs.set(ch, { img, sx: c * cellW, sy: r * cellH, cw: cellW, chh: cellH, advance: Math.round(actual * scale + 0.5) + 1, height, ascent, scale });
        });
      });
    }
    return this.glyphs.size > 0;
  }

  glyphCanvas(glyph, color) {
    const key = `${glyph.img.src}|${glyph.sx}|${glyph.sy}|${color}`;
    if (this.tinted.has(key)) return this.tinted.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = glyph.cw;
    canvas.height = glyph.chh;
    const g = canvas.getContext('2d');
    g.drawImage(glyph.img, glyph.sx, glyph.sy, glyph.cw, glyph.chh, 0, 0, glyph.cw, glyph.chh);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, canvas.width, canvas.height);
    this.tinted.set(key, canvas);
    return canvas;
  }

  advanceOf(ch, bold) {
    if (this.advances.has(ch)) return this.advances.get(ch);
    const glyph = this.glyphs.get(ch) || this.glyphs.get('?');
    return (glyph ? glyph.advance : 4) + (bold ? 1 : 0);
  }

  width(segments) {
    let width = 0;
    for (const seg of segments) for (const ch of seg.text) width += this.advanceOf(ch, seg.bold);
    return width;
  }

  /* Renders coloured segments at 1px per Minecraft pixel. Returns {canvas, width}. */
  render(segments, shadow) {
    const width = this.width(segments);
    const pad = 4;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width + 2);
    canvas.height = 9 + pad + 2;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;

    const draw = (offset, dim) => {
      let x = 0;
      for (const seg of segments) {
        const color = dim ? shade(seg.color, 0.25) : seg.color;
        for (const ch of seg.text) {
          const glyph = this.glyphs.get(ch) || this.glyphs.get('?');
          const advance = this.advanceOf(ch, seg.bold);
          if (glyph && ch !== ' ') {
            const tinted = this.glyphCanvas(glyph, color);
            const y = pad + (7 - glyph.ascent) + offset;
            g.save();
            if (seg.italic) {
              g.translate(x + offset, y + glyph.height);
              g.transform(1, 0, -0.2, 1, 0, 0);
              g.translate(-(x + offset), -(y + glyph.height));
            }
            g.drawImage(tinted, x + offset, y, glyph.cw * glyph.scale, glyph.chh * glyph.scale);
            if (seg.bold) g.drawImage(tinted, x + offset + 1, y, glyph.cw * glyph.scale, glyph.chh * glyph.scale);
            g.restore();
          }
          if (seg.underline) { g.fillStyle = color; g.fillRect(x + offset, pad + 8 + offset, advance, 1); }
          if (seg.strike) { g.fillStyle = color; g.fillRect(x + offset, pad + 4 + offset, advance, 1); }
          x += advance;
        }
      }
    };

    if (shadow) draw(1, true);
    draw(0, false);
    return { canvas, width, pad };
  }
}

function shade(color, factor) {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

let fontPromise = null;
export function loadFont() {
  if (!fontPromise) {
    fontPromise = (async () => {
      const font = new BitmapFont();
      return (await font.load()) ? font : null;
    })();
  }
  return fontPromise;
}

/* ---------- item definitions and models ---------- */

const modelCache = new Map();
const geometryCache = new Map();

function pickModel(node) {
  if (!node) return null;
  switch (node.type?.replace('minecraft:', '')) {
    case 'model': return { model: node.model, tints: node.tints || [] };
    case 'condition': return pickModel(node.on_false);
    case 'range_dispatch': return pickModel(node.fallback || node.entries?.[0]?.model);
    case 'select': return pickModel(node.fallback || node.cases?.[0]?.model);
    case 'composite': return pickModel(node.models?.[0]);
    case 'special': return { model: node.base, tints: [] };
    case 'bundle/selected_item': return pickModel(node.fallback);
    default: return null;
  }
}

async function resolveModel(id) {
  if (modelCache.has(id)) return modelCache.get(id);
  const promise = (async () => {
    const chain = [];
    let current = stripNamespace(id);
    let builtin = null;
    for (let depth = 0; current && depth < 16; depth++) {
      if (current.startsWith('builtin/')) { builtin = current.slice(8); break; }
      const json = await getJson(`/assets/mc/models/${current}.json`);
      if (!json) break;
      chain.push(json);
      current = json.parent ? stripNamespace(json.parent) : null;
    }
    const model = { builtin, textures: {}, display: {}, elements: null, guiLight: 'side' };
    for (const json of chain.reverse()) {
      Object.assign(model.textures, json.textures || {});
      if (json.elements) model.elements = json.elements;
      if (json.gui_light) model.guiLight = json.gui_light;
      for (const [key, value] of Object.entries(json.display || {})) model.display[key] = { ...(model.display[key] || {}), ...value };
    }
    return model;
  })();
  modelCache.set(id, promise);
  return promise;
}

const FACE_VERTICES = {
  north: (a, b) => [[b[0], b[1], a[2]], [a[0], b[1], a[2]], [a[0], a[1], a[2]], [b[0], a[1], a[2]]],
  south: (a, b) => [[a[0], b[1], b[2]], [b[0], b[1], b[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]]],
  east: (a, b) => [[b[0], b[1], b[2]], [b[0], b[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]]],
  west: (a, b) => [[a[0], b[1], a[2]], [a[0], b[1], b[2]], [a[0], a[1], b[2]], [a[0], a[1], a[2]]],
  up: (a, b) => [[a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]],
  down: (a, b) => [[a[0], a[1], b[2]], [b[0], a[1], b[2]], [b[0], a[1], a[2]], [a[0], a[1], a[2]]],
};

const FACE_NORMALS = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };
const FACE_SHADE = { down: 0.5, up: 1, north: 0.8, south: 0.8, east: 0.6, west: 0.6 };

function defaultUv(face, a, b) {
  switch (face) {
    case 'down': return [a[0], 16 - b[2], b[0], 16 - a[2]];
    case 'up': return [a[0], a[2], b[0], b[2]];
    case 'north': return [16 - b[0], 16 - b[1], 16 - a[0], 16 - a[1]];
    case 'south': return [a[0], 16 - b[1], b[0], 16 - a[1]];
    case 'west': return [a[2], 16 - b[1], b[2], 16 - a[1]];
    default: return [16 - b[2], 16 - b[1], 16 - a[2], 16 - a[1]];
  }
}

function rotateAround(point, origin, axis, angle, rescale) {
  const rad = (angle * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const p = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
  const k = rescale ? 1 / Math.cos(rad) : 1;
  let r;
  if (axis === 'x') r = [p[0], (p[1] * c - p[2] * s) * k, (p[1] * s + p[2] * c) * k];
  else if (axis === 'y') r = [(p[0] * c + p[2] * s) * k, p[1], (-p[0] * s + p[2] * c) * k];
  else r = [(p[0] * c - p[1] * s) * k, (p[0] * s + p[1] * c) * k, p[2]];
  return [r[0] + origin[0], r[1] + origin[1], r[2] + origin[2]];
}

function resolveTextureRef(textures, ref) {
  let value = ref;
  for (let i = 0; i < 8 && value && value.startsWith('#'); i++) value = textures[value.slice(1)];
  return value && !value.startsWith('#') ? value : null;
}

function defaultTint(textureRef, tints, index) {
  const tint = tints[index];
  if (tint) {
    if (tint.type?.endsWith('constant')) return intToColor(tint.value);
    if (tint.default !== undefined) return intToColor(tint.default);
    if (tint.default_color !== undefined) return intToColor(tint.default_color);
    if (tint.type?.endsWith('grass')) return '#91bd59';
    if (tint.type?.endsWith('foliage')) return '#77ab2f';
  }
  const name = stripNamespace(textureRef || '');
  if (/leaves|vine|fern|bush|lily/.test(name)) return '#6aa338';
  if (/water/.test(name)) return '#3f76e4';
  if (/grass|fern|sugar_cane/.test(name)) return '#91bd59';
  return '#ffffff';
}

const shadeCache = new Map();

function shadedImage(img, shade) {
  if (shade >= 0.999) return img;
  const level = Math.round(shade * 20) / 20;
  let byLevel = shadeCache.get(img);
  if (!byLevel) { byLevel = new Map(); shadeCache.set(img, byLevel); }
  if (!byLevel.has(level)) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const g = canvas.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(0,0,0,${1 - level})`;
    g.fillRect(0, 0, canvas.width, canvas.height);
    byLevel.set(level, canvas);
  }
  return byLevel.get(level);
}

const EDGE_CACHE = new Map();

function spriteEdges(img) {
  if (EDGE_CACHE.has(img.src)) return EDGE_CACHE.get(img.src);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.width;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
  const size = canvas.width;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < size && y < size && data[(y * size + x) * 4 + 3] > 8;
  const edges = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!opaque(x, y)) continue;
      const i = (y * size + x) * 4;
      const color = [data[i], data[i + 1], data[i + 2]];
      for (const [dx, dy, dir] of [[-1, 0, 'west'], [1, 0, 'east'], [0, -1, 'up'], [0, 1, 'down']]) {
        if (!opaque(x + dx, y + dy)) edges.push({ x, y, dir, color });
      }
    }
  }
  const result = { size, edges };
  EDGE_CACHE.set(img.src, result);
  return result;
}

/* Builds renderable geometry in block units centred on the origin (a full block is 1 wide). */
export async function loadGeometry(itemId) {
  if (geometryCache.has(itemId)) return geometryCache.get(itemId);
  const promise = (async () => {
    const def = await getJson(`/assets/mc/items/${itemId}.json`);
    const picked = pickModel(def?.model);
    if (!picked) return null;
    const model = await resolveModel(picked.model);
    const faces = [];

    if (model.builtin === 'generated') {
      const layers = Object.keys(model.textures).filter((k) => /^layer\d+$/.test(k)).sort();
      for (const [index, key] of layers.entries()) {
        const ref = resolveTextureRef(model.textures, model.textures[key]);
        const img = ref && await loadTexture(ref);
        if (!img) continue;
        const tint = defaultTint(ref, picked.tints, index);
        const h = 1 / 32 + index * 0.0004;
        const w = img.width;
        faces.push({ corners: [[-0.5, 0.5, h], [0.5, 0.5, h], [0.5, -0.5, h], [-0.5, -0.5, h]], img, uvCorners: [[0, 0], [w, 0], [w, w], [0, w]], tint, shade: 1, normal: [0, 0, 1], layer: index });
        faces.push({ corners: [[0.5, 0.5, -h], [-0.5, 0.5, -h], [-0.5, -0.5, -h], [0.5, -0.5, -h]], img, uvCorners: [[w, 0], [0, 0], [0, w], [w, w]], tint, shade: 0.85, normal: [0, 0, -1], layer: index });
        if (index === 0) {
          const { size, edges } = spriteEdges(img);
          const px = 1 / size;
          for (const e of edges) {
            const x0 = e.x * px - 0.5;
            const y0 = 0.5 - e.y * px;
            const z = 1 / 32;
            let corners;
            let normal;
            if (e.dir === 'west') { corners = [[x0, y0, z], [x0, y0, -z], [x0, y0 - px, -z], [x0, y0 - px, z]]; normal = [-1, 0, 0]; }
            else if (e.dir === 'east') { corners = [[x0 + px, y0, -z], [x0 + px, y0, z], [x0 + px, y0 - px, z], [x0 + px, y0 - px, -z]]; normal = [1, 0, 0]; }
            else if (e.dir === 'up') { corners = [[x0, y0, -z], [x0 + px, y0, -z], [x0 + px, y0, z], [x0, y0, z]]; normal = [0, 1, 0]; }
            else { corners = [[x0, y0 - px, z], [x0 + px, y0 - px, z], [x0 + px, y0 - px, -z], [x0, y0 - px, -z]]; normal = [0, -1, 0]; }
            faces.push({ corners, color: e.color, shade: e.dir === 'up' ? 1 : 0.8, normal, edge: true });
          }
        }
      }
    } else if (model.elements) {
      for (const element of model.elements) {
        const a = element.from;
        const b = element.to;
        for (const [name, face] of Object.entries(element.faces || {})) {
          const ref = resolveTextureRef(model.textures, face.texture);
          const img = ref && await loadTexture(ref);
          if (!img) continue;
          let corners = FACE_VERTICES[name](a, b);
          if (element.rotation) {
            const r = element.rotation;
            corners = corners.map((p) => rotateAround(p, r.origin, r.axis, r.angle, r.rescale));
          }
          corners = corners.map((p) => [(p[0] - 8) / 16, (p[1] - 8) / 16, (p[2] - 8) / 16]);
          const scale = img.width / 16;
          let uv = (face.uv || defaultUv(name, a, b)).map((v) => v * scale);
          let uvCorners = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
          const turns = ((face.rotation || 0) / 90) % 4;
          for (let i = 0; i < turns; i++) uvCorners = [uvCorners[3], uvCorners[0], uvCorners[1], uvCorners[2]];
          const tint = face.tintindex !== undefined ? defaultTint(ref, picked.tints, face.tintindex) : '#ffffff';
          const side = model.guiLight !== 'front' && element.shade !== false;
          faces.push({ corners, img, uvCorners, tint, shade: side ? FACE_SHADE[name] : 1, normal: FACE_NORMALS[name], sprite: scale });
        }
      }
    }

    return { faces, display: model.display, builtin: model.builtin, empty: faces.length === 0 };
  })();
  geometryCache.set(itemId, promise);
  return promise;
}

/* display transform for an ItemDisplay mode; returns a function mapping model points */
export function displayTransformFn(geometry, mode) {
  const key = mode === 'NONE' ? null : mode.toLowerCase();
  const d = key && geometry.display[key];
  if (!d) return (p) => p;
  const r = (d.rotation || [0, 0, 0]).map((v) => (v * Math.PI) / 180);
  const s = d.scale || [1, 1, 1];
  const t = (d.translation || [0, 0, 0]).map((v) => Math.max(-80, Math.min(80, v)) / 16);
  const [cx, sx] = [Math.cos(r[0]), Math.sin(r[0])];
  const [cy, sy] = [Math.cos(r[1]), Math.sin(r[1])];
  const [cz, sz] = [Math.cos(r[2]), Math.sin(r[2])];
  return (p) => {
    let v = [p[0] * s[0], p[1] * s[1], p[2] * s[2]];
    v = [v[0], v[1] * cx - v[2] * sx, v[1] * sx + v[2] * cx];
    v = [v[0] * cy + v[2] * sy, v[1], -v[0] * sy + v[2] * cy];
    v = [v[0] * cz - v[1] * sz, v[0] * sz + v[1] * cz, v[2]];
    return [v[0] + t[0], v[1] + t[1], v[2] + t[2]];
  };
}

export function rotateNormal(geometry, mode, normal) {
  const origin = displayTransformFn(geometry, mode)([0, 0, 0]);
  const moved = displayTransformFn(geometry, mode)(normal);
  const v = [moved[0] - origin[0], moved[1] - origin[1], moved[2] - origin[2]];
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/* Draws geometry with an arbitrary projection.
 * opts.toWorld(modelPoint) -> world point; opts.toWorldNormal(n) -> world normal;
 * opts.project(world) -> [x, y, depth] or null; opts.facing(normal, centre) -> > 0 when visible. */
export function drawGeometry(ctx, geometry, opts) {
  const base = ctx.getTransform();
  const entries = [];
  for (const face of geometry.faces) {
    const world = face.corners.map((c) => opts.toWorld(c));
    const normal = opts.toWorldNormal(face.normal);
    const centre = [0, 1, 2].map((i) => (world[0][i] + world[1][i] + world[2][i] + world[3][i]) / 4);
    if (opts.facing(normal, centre) <= 0) continue;
    const pts = world.map((w) => opts.project(w));
    if (pts.some((p) => !p)) continue;
    const depth = pts.reduce((sum, p) => sum + p[2], 0) / 4 - (face.layer || 0) * 0.0005 + (face.edge ? 1000 : 0);
    entries.push({ face, pts, depth });
  }
  entries.sort((a, b) => b.depth - a.depth);

  ctx.imageSmoothingEnabled = false;
  for (const { face, pts } of entries) {
    if (face.edge) {
      ctx.fillStyle = `rgb(${Math.round(face.color[0] * face.shade)},${Math.round(face.color[1] * face.shade)},${Math.round(face.color[2] * face.shade)})`;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      continue;
    }

    drawQuadTexture(ctx, shadedImage(tintedImage(face.img, face.tint), face.shade), pts, face.uvCorners);
    ctx.setTransform(base);
  }
  ctx.setTransform(base);
}

/* Maps the texture region onto the projected quad (corner order TL, TR, BR, BL), approximating
 * the perspective with an affine transform solved from three corners. */
export function drawQuadTexture(ctx, img, pts, uv) {
  const d1 = [uv[1][0] - uv[0][0], uv[1][1] - uv[0][1]];
  const d3 = [uv[3][0] - uv[0][0], uv[3][1] - uv[0][1]];
  const det = d1[0] * d3[1] - d1[1] * d3[0];
  if (Math.abs(det) < 1e-9) return;
  const s1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
  const s3 = [pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]];
  const a = (s1[0] * d3[1] - s3[0] * d1[1]) / det;
  const c = (s3[0] * d1[0] - s1[0] * d3[0]) / det;
  const b = (s1[1] * d3[1] - s3[1] * d1[1]) / det;
  const d = (s3[1] * d1[0] - s1[1] * d3[0]) / det;
  const e = pts[0][0] - a * uv[0][0] - c * uv[0][1];
  const f = pts[0][1] - b * uv[0][0] - d * uv[0][1];
  const minU = Math.min(...uv.map((p) => p[0]));
  const minV = Math.min(...uv.map((p) => p[1]));
  const w = Math.max(...uv.map((p) => p[0])) - minU;
  const h = Math.max(...uv.map((p) => p[1])) - minV;
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, minU, minV, w, h, minU, minV, w, h);
  ctx.restore();
}

/* Renders an item to a small square canvas for pickers. */
const iconCache = new Map();
export async function renderIcon(itemId, size = 40) {
  const key = `${itemId}|${size}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const promise = (async () => {
    const geometry = await loadGeometry(itemId);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    if (!geometry || geometry.empty) return canvas;
    const ctx = canvas.getContext('2d');
    const flat = geometry.builtin === 'generated';
    const fn = displayTransformFn(geometry, 'GUI');
    const scale = size * (flat ? 0.95 : 0.9);
    drawGeometry(ctx, geometry, {
      toWorld: (p) => fn(p),
      toWorldNormal: (n) => rotateNormal(geometry, 'GUI', n),
      project: (p) => [size / 2 + p[0] * scale, size / 2 - p[1] * scale, -p[2]],
      facing: (n) => n[2],
    });
    return canvas;
  })();
  iconCache.set(key, promise);
  return promise;
}
