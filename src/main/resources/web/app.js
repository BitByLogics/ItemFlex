import { evalTrack, sortFrames, defaultDefinition, defaultEvent, IDENTITIES } from './core.js';
import { Preview, shouldFire } from './preview.js';
import { initAssets, mc, itemName, renderIcon } from './mc.js';
import { openPicker } from './picker.js';
import { startTour, tourSeen } from './tour.js';
import { loadSounds, playSound, unlockAudio, pauseAudio, stopAudio, audio } from './audio.js';

const LABEL_W = 190;
const EVENT_TYPES = ['PARTICLE', 'SOUND', 'COMMAND', 'MESSAGE', 'TEXT'];
const EVENT_COLORS = { PARTICLE: '#ff9f43', SOUND: '#54a0ff', COMMAND: '#ee5253', MESSAGE: '#c56cf0', TEXT: '#1dd1a1' };
const EVENT_NAMES = { PARTICLE: 'Particle', SOUND: 'Sound', COMMAND: 'Command', MESSAGE: 'Chat message', TEXT: 'Text change' };
const TARGET_NAMES = { ITEM: 'Item', TEXT: 'Text lines', ROOT: 'Whole animation' };
const prettyName = (value) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_([a-z])/g, (m, c) => ` ${c.toUpperCase()}`);
const TARGET_COLORS = { ITEM: '#feca57', TEXT: '#1dd1a1', ROOT: '#a29bfe' };
const RESERVED = ['reload', 'editor'];

const $ = (id) => document.getElementById(id);

const state = {
  meta: null,
  session: null,
  names: [],
  name: null,
  isNew: false,
  def: null,
  snapshot: '',
  selection: null,
  tick: 0,
  lastFired: -1,
  playing: false,
  zoom: 8,
  newTrack: { target: 'ITEM', property: 'SCALE', line: -1 },
  newEvent: 'PARTICLE',
  history: [],
  historyIndex: -1,
};
let commitTimer = null;

let preview = null;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  children.flat().forEach((child) => { if (child !== null && child !== undefined) node.append(child); });
  return node;
}

function toast(message, kind = '') {
  const node = el('div', { class: `toast ${kind}`, text: message });
  $('toasts').append(node);
  setTimeout(() => node.remove(), kind === 'error' ? 7000 : 3500);
}

function showOverlay(title, text) {
  $('overlayTitle').textContent = title;
  $('overlayText').textContent = text;
  $('overlay').hidden = false;
}

function dialog({ title, message = '', input = null, confirmText = 'OK', cancelText = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const field = input === null ? null : el('input', { type: 'text', value: input.value ?? '', placeholder: input.placeholder ?? '', spellcheck: 'false', maxlength: input.maxLength ?? 64 });
    const cancel = el('button', { text: cancelText, onclick: () => close(null) });
    const confirm = el('button', { class: danger ? 'danger solid' : 'primary', text: confirmText, onclick: () => close(field ? field.value : true) });
    const backdrop = el('div', { class: 'modal-backdrop', onpointerdown: (event) => { if (event.target === backdrop) close(null); } },
      el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' },
        el('h2', { text: title }),
        message ? el('p', { text: message }) : null,
        field,
        el('div', { class: 'dialog-actions' }, cancel, confirm)));
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(null); }
      if (event.key === 'Enter' && document.activeElement !== cancel) { event.preventDefault(); event.stopPropagation(); confirm.click(); }
    };
    function close(result) {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      resolve(result);
    }
    document.addEventListener('keydown', onKey, true);
    document.body.append(backdrop);
    (field || confirm).focus();
    if (field) field.select();
  });
}

async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    method: options.method || 'GET',
    headers: { 'X-ItemFlex': '1', 'Content-Type': 'application/json' },
    body: options.body,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await response.json(); } catch { /* no body */ }
  if (response.status === 401) {
    showOverlay('Session expired', 'Run /itemflex editor in game to get a new link.');
    throw new Error('Session expired');
  }
  if (!response.ok) throw new Error((data && data.error) || response.statusText);
  return data;
}

/* ---------- state helpers ---------- */

const isDirty = () => state.isNew || JSON.stringify(state.def) !== state.snapshot;
const maxTick = () => state.meta.limits.maxDuration;
const canEditCommands = () => state.session.canEditCommands;

function changed(structural = false) {
  if (structural) renderTimeline();
  preview.invalidateParticles();
  refresh();
  scheduleCommit();
}

function resetHistory() {
  clearTimeout(commitTimer);
  state.history = [JSON.stringify(state.def)];
  state.historyIndex = 0;
  updateHistoryButtons();
}

function scheduleCommit() {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(commitHistory, 350);
}

function commitHistory() {
  const snapshot = JSON.stringify(state.def);
  if (snapshot === state.history[state.historyIndex]) return;
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  if (state.history.length > 100) state.history.shift();
  state.historyIndex = state.history.length - 1;
  updateHistoryButtons();
}

function stepHistory(direction) {
  commitHistory();
  const target = state.historyIndex + direction;
  if (target < 0 || target >= state.history.length) return;
  state.historyIndex = target;
  state.def = JSON.parse(state.history[target]);
  state.selection = null;
  rebuildAll();
  updateHistoryButtons();
}

function updateHistoryButtons() {
  $('btnUndo').disabled = state.historyIndex <= 0;
  $('btnRedo').disabled = state.historyIndex >= state.history.length - 1;
}

function refresh(updateStatus = true) {
  if (updateStatus) {
    const dirty = isDirty();
    $('status').textContent = dirty ? 'Unsaved changes' : 'Saved';
    $('status').className = dirty ? 'dirty' : '';
    $('btnSave').disabled = !dirty;
  }
  preview.setDefinition(state.def);
  preview.setTick(state.tick);
  preview.render();
  $('tickLabel').textContent = `${Math.floor(state.tick)} / ${state.def.duration} (${(state.tick / 20).toFixed(2)}s)`;
  updatePlayhead();
}

function setTick(tick) {
  state.tick = Math.max(0, Math.min(state.def.duration + 10, tick));
  state.lastFired = Math.floor(state.tick);
  stopAudio();
  refresh();
}

/* ---------- generic inputs ---------- */

function numInput(obj, key, { step = 'any', min, max, int = false, structural = false, disabled = false, title } = {}) {
  const input = el('input', { type: 'number', step: int ? 1 : step, min, max, disabled, title, placeholder: title });
  input.value = obj[key];
  input.addEventListener('input', () => {
    let value = int ? parseInt(input.value, 10) : parseFloat(input.value);
    if (Number.isNaN(value)) return;
    if (min !== undefined) value = Math.max(min, value);
    if (max !== undefined) value = Math.min(max, value);
    obj[key] = value;
    changed(structural);
    if (state.selection) renderInspectorLight();
  });
  return input;
}

function textInput(obj, key, { list, disabled = false, structural = false } = {}) {
  const input = el('input', { type: 'text', list, disabled });
  input.value = obj[key] ?? '';
  input.addEventListener('input', () => { obj[key] = input.value; changed(structural); });
  return input;
}

function selectInput(obj, key, options, { disabled = false, structural = false } = {}) {
  const select = el('select', { disabled }, options.map((option) => el('option', { value: option, text: option })));
  select.value = obj[key];
  select.addEventListener('change', () => { obj[key] = select.value; changed(structural); });
  return select;
}

function checkInput(obj, key) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!obj[key];
  input.addEventListener('change', () => { obj[key] = input.checked; changed(); });
  return input;
}

const pickerField = (label, ...controls) => el('div', { class: 'field' }, el('label', { text: label }), el('div', { class: 'inline-row' }, controls));

const field = (label, ...controls) => el('div', { class: 'field' }, el('label', { text: label }), controls.length > 1 ? el('div', { class: controls.length === 3 ? 'row3' : 'row4' }, controls) : controls[0]);

/* ---------- settings panel ---------- */

function renderSettings() {
  const def = state.def;
  const panel = $('settings');
  const openState = new Map([...panel.querySelectorAll('details')].map((node) => [node.querySelector('summary').textContent, node.open]));
  panel.innerHTML = '';

  const section = (title, open, ...rows) => el('details', (openState.get(title) ?? open) ? { open: true } : {}, el('summary', { text: title }), el('div', { class: 'fields' }, rows));

  const lines = el('textarea', { spellcheck: 'false' });
  lines.value = def.text.lines.join('\n');
  lines.addEventListener('input', () => { def.text.lines = lines.value.split('\n'); changed(); });

  panel.append(
    section('General', true,
      field('Permission', textInput(def, 'permission')),
      field('Priority', numInput(def, 'priority', { int: true })),
      field('Duration (ticks)', numInput(def, 'duration', { int: true, min: 1, max: maxTick(), structural: true })),
      el('div', { class: 'note', text: 'Players use the highest-priority animation they have permission for. /itemflex <name> picks one directly.' }),
    ),
    section('Spawn', false,
      field('Distance', numInput(def.spawn, 'distance', { step: 0.05 })),
      field('Offset', numInput(def.spawn.offset, 'x', { step: 0.05 }), numInput(def.spawn.offset, 'y', { step: 0.05 }), numInput(def.spawn.offset, 'z', { step: 0.05 })),
      field('Item offset', numInput(def.spawn.itemOffset, 'x', { step: 0.05 }), numInput(def.spawn.itemOffset, 'y', { step: 0.05 }), numInput(def.spawn.itemOffset, 'z', { step: 0.05 })),
    ),
    section('Item', false,
      field('Display', selectInput(def.item, 'displayTransform', state.meta.displayTransforms)),
      field('Item scale', numInput(def.item, 'itemScale', { step: 0.05, min: 0.01 })),
      field('Block scale', numInput(def.item, 'blockScale', { step: 0.05, min: 0.01 })),
    ),
    section('Text', true,
      field('Lines', lines),
      el('div', { class: 'note', text: 'One per line, top first. Supports &-colors, #RRGGBB, %item_name%, %item_lore%, %item_enchants% and PlaceholderAPI.' }),
      field('Line spacing', numInput(def.text, 'lineSpacing', { step: 0.01, min: 0 })),
      field('Billboard', selectInput(def.text, 'billboard', state.meta.billboards)),
      field('Background', numInput(def.text.background, 'opacity', { int: true, min: 0, max: 255, title: 'Opacity' }), numInput(def.text.background, 'red', { int: true, min: 0, max: 255, title: 'Red' }), numInput(def.text.background, 'green', { int: true, min: 0, max: 255, title: 'Green' }), numInput(def.text.background, 'blue', { int: true, min: 0, max: 255, title: 'Blue' })),
      el('div', { class: 'note', text: 'Background order: opacity, red, green, blue (0-255).' }),
      field('Block light', numInput(def.text, 'blockLight', { int: true, min: 0, max: 15 })),
      field('Sky light', numInput(def.text, 'skyLight', { int: true, min: 0, max: 15 })),
      field('Shadow', checkInput(def.text, 'shadow')),
    ),
  );
}

/* ---------- timeline ---------- */

function trackLabel(track) {
  let label = `${TARGET_NAMES[track.target] || track.target} · ${prettyName(track.property)}`;
  if (track.target === 'TEXT') label += track.line < 0 ? ' (all lines)' : ` (line ${track.line})`;
  return label;
}

const isSelected = (kind, item) => state.selection && state.selection.kind === kind && state.selection.item === item;

function select(kind, item, track = null) {
  state.selection = { kind, item, track };
  document.querySelectorAll('.key.selected, .ev.selected, .tl-label.selected').forEach((node) => node.classList.remove('selected'));
  renderInspector();
}

function tickFromPointer(event, lane) {
  const rect = lane.getBoundingClientRect();
  return Math.max(0, Math.min(maxTick(), Math.round((event.clientX - rect.left) / state.zoom)));
}

function dragItem(event, node, lane, item, track) {
  event.stopPropagation();
  event.preventDefault();
  node.setPointerCapture(event.pointerId);
  node.classList.add('selected');
  const onMove = (move) => {
    const tick = tickFromPointer(move, lane);
    if (tick === item.tick) return;
    item.tick = tick;
    node.style.left = `${tick * state.zoom}px`;
    if (track) sortFrames(track);
    changed(false);
    renderInspectorLight();
  };
  const onUp = () => {
    node.removeEventListener('pointermove', onMove);
    node.removeEventListener('pointerup', onUp);
    node.removeEventListener('pointercancel', onUp);
    renderTimeline();
  };
  node.addEventListener('pointermove', onMove);
  node.addEventListener('pointerup', onUp);
  node.addEventListener('pointercancel', onUp);
}

function curveSvg(track, width, color) {
  const duration = Math.max(1, state.def.duration);
  const samples = [];
  const step = Math.max(1, Math.floor(duration / 200));
  for (let t = 0; t <= duration; t += step) samples.push([t, evalTrack(track, t)]);
  samples.push([duration, evalTrack(track, duration)]);
  const values = samples.map((s) => s[1]);
  const min = Math.min(...values, IDENTITIES[track.property]);
  const max = Math.max(...values, IDENTITIES[track.property]);
  const range = max - min || 1;
  const points = samples.map(([t, v]) => `${t * state.zoom},${30 - ((v - min) / range) * 26}`).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'curve');
  svg.setAttribute('viewBox', `0 0 ${width} 34`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', points);
  line.setAttribute('stroke', color);
  svg.append(line);
  return svg;
}

function renderTimeline(keepToolbar = false) {
  const host = $('timeline');
  const scrollLeft = host.querySelector('.tl-scroll')?.scrollLeft || 0;
  const scrollTop = host.querySelector('.tl-scroll')?.scrollTop || 0;
  if (keepToolbar) {
    [...host.children].forEach((child) => { if (!child.classList.contains('tl-toolbar')) child.remove(); });
  } else {
    host.innerHTML = '';
  }
  const def = state.def;
  const meta = state.meta;
  const laneWidth = (def.duration + 40) * state.zoom;

  /* toolbar */
  const targetSel = el('select', {}, Object.keys(meta.targets).map((t) => el('option', { value: t, text: TARGET_NAMES[t] || prettyName(t) })));
  targetSel.value = state.newTrack.target;
  const propSel = el('select');
  const fillProps = () => {
    propSel.innerHTML = '';
    meta.targets[targetSel.value].forEach((p) => propSel.append(el('option', { value: p, text: prettyName(p) })));
    if (!meta.targets[targetSel.value].includes(state.newTrack.property)) state.newTrack.property = meta.targets[targetSel.value][0];
    propSel.value = state.newTrack.property;
  };
  fillProps();
  const lineLabel = el('span', { class: 'note line-label', text: 'line' });
  const lineInput = el('input', { type: 'number', min: -1, step: 1, title: 'Which text line: 0 is the top line, -1 is every line' });
  lineInput.value = state.newTrack.line;
  const syncLine = () => {
    const shown = targetSel.value === 'TEXT' ? '' : 'none';
    lineInput.style.display = shown;
    lineLabel.style.display = shown;
  };
  syncLine();
  targetSel.addEventListener('change', () => { state.newTrack.target = targetSel.value; fillProps(); syncLine(); });
  propSel.addEventListener('change', () => { state.newTrack.property = propSel.value; });
  const parseLine = (value) => {
    const line = parseInt(value, 10);
    return Number.isNaN(line) ? -1 : Math.max(-1, line);
  };
  lineInput.addEventListener('input', () => { state.newTrack.line = parseLine(lineInput.value); });

  const addTrack = el('button', { text: '+ Track', onclick: () => {
    const track = {
      target: targetSel.value,
      line: targetSel.value === 'TEXT' ? parseLine(lineInput.value) : -1,
      property: propSel.value,
      keyframes: [
        { tick: 0, value: IDENTITIES[propSel.value], easing: 'LINEAR' },
        { tick: def.duration, value: IDENTITIES[propSel.value], easing: 'LINEAR' },
      ],
    };
    def.tracks.push(track);
    select('track', track);
    changed(true);
  } });

  const eventSel = el('select', {}, EVENT_TYPES.map((t) => el('option', { value: t, text: EVENT_NAMES[t], disabled: t === 'COMMAND' && !canEditCommands() })));
  eventSel.value = state.newEvent;
  eventSel.addEventListener('change', () => { state.newEvent = eventSel.value; });
  const addEvent = el('button', { text: '+ Event at playhead', onclick: () => {
    const event = defaultEvent(eventSel.value, Math.floor(state.tick));
    def.events.push(event);
    select('event', event);
    changed(true);
  } });

  const zoom = el('input', { type: 'range', min: 2, max: 24, step: 1, value: state.zoom });
  zoom.addEventListener('input', () => { state.zoom = parseInt(zoom.value, 10); renderTimeline(true); });

  if (!keepToolbar) host.append(el('div', { class: 'tl-toolbar' },
    el('div', { class: 'group' }, el('strong', { text: 'Animate' }), el('span', { class: 'note', text: 'what' }), targetSel, propSel,
      lineLabel, lineInput, addTrack),
    el('div', { class: 'sep' }),
    el('div', { class: 'group' }, el('strong', { text: 'Trigger' }), eventSel, addEvent),
    el('div', { class: 'sep' }),
    el('div', { class: 'group' }, el('span', { class: 'note', text: 'Zoom' }), zoom),
    el('span', { class: 'note hint', text: 'Double-click a lane to add. Del removes the selection.' }),
  ));

  /* rows */
  const scroll = el('div', { class: 'tl-scroll' });
  const inner = el('div', { class: 'tl-inner' });
  inner.style.width = `${LABEL_W + laneWidth}px`;

  const afterEnd = () => {
    const shade = el('div', { class: 'after-end' });
    shade.style.width = `${Math.max(0, laneWidth - def.duration * state.zoom)}px`;
    return shade;
  };

  const ruler = el('div', { class: 'tl-lane' });
  ruler.style.width = `${laneWidth}px`;
  const stepOptions = [1, 2, 5, 10, 20, 50, 100];
  const markStep = stepOptions.find((s) => s * state.zoom >= 46) || 100;
  for (let t = 0; t <= def.duration + 40; t += markStep) {
    const mark = el('div', { class: `mark${t % 20 === 0 ? ' sec' : ''}`, text: t % 20 === 0 ? `${t} (${t / 20}s)` : `${t}` });
    mark.style.left = `${t * state.zoom}px`;
    ruler.append(mark);
  }
  ruler.append(afterEnd());
  ruler.addEventListener('pointerdown', (event) => {
    ruler.setPointerCapture(event.pointerId);
    setTick(tickFromPointer(event, ruler));
    const move = (e) => setTick(tickFromPointer(e, ruler));
    const up = () => { ruler.removeEventListener('pointermove', move); ruler.removeEventListener('pointerup', up); ruler.removeEventListener('pointercancel', up); };
    ruler.addEventListener('pointermove', move);
    ruler.addEventListener('pointerup', up);
    ruler.addEventListener('pointercancel', up);
  });
  inner.append(el('div', { class: 'tl-row ruler' }, el('div', { class: 'tl-label', text: 'Ticks' }), ruler));

  def.tracks.forEach((track) => {
    const color = TARGET_COLORS[track.target];
    const label = el('div', { class: `tl-label${isSelected('track', track) ? ' selected' : ''}`, onclick: () => { select('track', track); document.querySelectorAll('.tl-label.selected').forEach((n) => n.classList.remove('selected')); label.classList.add('selected'); } },
      el('span', { class: 'dot', style: `background:${color}` }),
      el('span', { class: 'name', text: trackLabel(track), title: trackLabel(track) }),
      el('span', { class: 'x', text: '✕', title: 'Delete track', onclick: (e) => { e.stopPropagation(); removeTrack(track); } }),
    );
    const lane = el('div', { class: 'tl-lane' });
    lane.style.width = `${laneWidth}px`;
    lane.append(curveSvg(track, laneWidth, color), afterEnd());
    track.keyframes.forEach((key) => {
      const node = el('div', { class: `key${isSelected('key', key) ? ' selected' : ''}`, title: `tick ${key.tick} · value ${key.value}` });
      node.style.left = `${key.tick * state.zoom}px`;
      node.style.background = color;
      node.addEventListener('pointerdown', (event) => { select('key', key, track); dragItem(event, node, lane, key, track); });
      lane.append(node);
    });
    lane.addEventListener('dblclick', (event) => {
      if (event.target.closest('.key')) return;
      const tick = tickFromPointer(event, lane);
      const key = { tick, value: +evalTrack(track, tick).toFixed(4), easing: 'LINEAR' };
      track.keyframes.push(key);
      sortFrames(track);
      select('key', key, track);
      changed(true);
    });
    lane.addEventListener('pointerdown', (event) => { if (!event.target.closest('.key')) setTick(tickFromPointer(event, lane)); });
    inner.append(el('div', { class: 'tl-row' }, label, lane));
  });

  if (def.tracks.length === 0) {
    inner.append(el('div', { class: 'tl-empty', text: 'No tracks yet. Pick what to animate above and press + Track.' }));
  }

  EVENT_TYPES.forEach((type) => {
    const color = EVENT_COLORS[type];
    const label = el('div', { class: 'tl-label' },
      el('span', { class: 'dot', style: `background:${color}` }),
      el('span', { class: 'name', text: `${EVENT_NAMES[type]}s` }));
    const lane = el('div', { class: 'tl-lane' });
    lane.style.width = `${laneWidth}px`;
    lane.append(afterEnd());
    def.events.filter((event) => event.type === type).forEach((event) => {
      if (event.every > 0) {
        const end = event.until > 0 ? event.until : def.duration;
        const span = el('div', { class: 'ev-span' });
        span.style.left = `${event.tick * state.zoom}px`;
        span.style.width = `${Math.max(0, end - event.tick) * state.zoom}px`;
        span.style.background = `repeating-linear-gradient(to right, ${color} 0, ${color} 2px, transparent 2px, transparent ${Math.max(3, event.every * state.zoom)}px)`;
        span.style.height = '10px';
        span.style.marginTop = '-5px';
        lane.append(span);
      }
      const node = el('div', { class: `ev${isSelected('event', event) ? ' selected' : ''}`, title: `${EVENT_NAMES[type]} at tick ${event.tick}` });
      node.style.left = `${event.tick * state.zoom}px`;
      node.style.background = color;
      node.addEventListener('pointerdown', (e) => { select('event', event); dragItem(e, node, lane, event, null); });
      lane.append(node);
    });
    lane.addEventListener('dblclick', (event) => {
      if (event.target.closest('.ev')) return;
      if (type === 'COMMAND' && !canEditCommands()) { toast('You need the command editor permission to add commands.', 'error'); return; }
      const created = defaultEvent(type, tickFromPointer(event, lane));
      def.events.push(created);
      select('event', created);
      changed(true);
    });
    lane.addEventListener('pointerdown', (event) => { if (!event.target.closest('.ev')) setTick(tickFromPointer(event, lane)); });
    inner.append(el('div', { class: 'tl-row' }, label, lane));
  });

  inner.append(el('div', { class: 'playhead', id: 'playhead' }));
  scroll.append(inner);
  scroll.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    state.zoom = Math.max(2, Math.min(24, Math.round(state.zoom * (event.deltaY < 0 ? 1.15 : 0.87))));
    const slider = host.querySelector('.tl-toolbar input[type="range"]');
    if (slider) slider.value = state.zoom;
    renderTimeline(true);
  }, { passive: false });
  host.append(scroll);
  scroll.scrollLeft = scrollLeft;
  scroll.scrollTop = scrollTop;
  updatePlayhead();
}

function updatePlayhead() {
  const playhead = $('playhead');
  if (playhead) playhead.style.left = `${LABEL_W + state.tick * state.zoom}px`;
  if (!state.playing) return;
  const scroll = document.querySelector('.tl-scroll');
  if (!scroll) return;
  const x = state.tick * state.zoom;
  const visible = scroll.clientWidth - LABEL_W;
  if (x > scroll.scrollLeft + visible - 30) scroll.scrollLeft = Math.max(0, x - 60);
  else if (x < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, x - 60);
}

function removeTrack(track) {
  state.def.tracks = state.def.tracks.filter((t) => t !== track);
  if (state.selection && (state.selection.item === track || state.selection.track === track)) state.selection = null;
  renderInspector();
  changed(true);
}

function deleteSelection() {
  const selection = state.selection;
  if (!selection) return;
  if (selection.kind === 'track') { removeTrack(selection.item); return; }
  if (selection.kind === 'key') {
    selection.track.keyframes = selection.track.keyframes.filter((k) => k !== selection.item);
    if (selection.track.keyframes.length === 0) { removeTrack(selection.track); return; }
  } else {
    if (selection.item.type === 'COMMAND' && !canEditCommands()) { toast('You need the command editor permission to remove commands.', 'error'); return; }
    state.def.events = state.def.events.filter((e) => e !== selection.item);
  }
  state.selection = null;
  renderInspector();
  changed(true);
}

/* ---------- inspector ---------- */

function renderInspectorLight() {
  /* keeps focus: only refresh the tick field values that might change by dragging */
  const selection = state.selection;
  if (!selection || document.activeElement?.closest('#inspector')) return;
  renderInspector();
}

function renderInspector() {
  const panel = $('inspector');
  panel.innerHTML = '';
  const selection = state.selection;

  if (!selection) {
    panel.append(el('h3', { text: 'Inspector' }), el('div', { class: 'note', text: 'Select a keyframe, event or track on the timeline. Keyframes interpolate to the next one using their easing. Multiple tracks on the same property combine (offsets add, scale and opacity multiply).' }));
    return;
  }

  const fields = el('div', { class: 'fields' });
  const buttons = el('div', { class: 'btns' });

  if (selection.kind === 'key') {
    const key = selection.item;
    panel.append(el('h3', { text: `Keyframe · ${trackLabel(selection.track)}` }));
    const tickInput = numInput(key, 'tick', { int: true, min: 0, max: maxTick() });
    tickInput.addEventListener('change', () => { sortFrames(selection.track); renderTimeline(); });
    fields.append(
      field('Tick', tickInput),
      field('Value', numInput(key, 'value', { step: 0.01, structural: true })),
      field('Easing', selectInput(key, 'easing', state.meta.easings, { structural: true })),
      el('div', { class: 'note', text: 'Easing shapes the segment from this keyframe to the next. STEP holds the value until the next keyframe.' }),
    );
    buttons.append(el('button', { class: 'danger', text: 'Delete keyframe', onclick: deleteSelection }));
  } else if (selection.kind === 'track') {
    const track = selection.item;
    panel.append(el('h3', { text: 'Track' }));
    fields.append(el('div', { class: 'note', text: trackLabel(track) }));
    if (track.target === 'TEXT') {
      fields.append(field('Line', numInput(track, 'line', { int: true, min: -1, structural: true })), el('div', { class: 'note', text: '-1 = every line, 0 = top line, 1 = next one down...' }));
    }
    buttons.append(
      el('button', { text: 'Add keyframe at playhead', onclick: () => {
        const tick = Math.floor(state.tick);
        const key = { tick, value: +evalTrack(track, tick).toFixed(4), easing: 'LINEAR' };
        track.keyframes.push(key);
        sortFrames(track);
        select('key', key, track);
        changed(true);
      } }),
      el('button', { class: 'danger', text: 'Delete track', onclick: deleteSelection }),
    );
  } else {
    const event = selection.item;
    const locked = event.type === 'COMMAND' && !canEditCommands();
    panel.append(el('h3', { text: `${EVENT_NAMES[event.type]} event` }));
    fields.append(
      field('Tick', numInput(event, 'tick', { int: true, min: 0, max: maxTick(), structural: true, disabled: locked })),
      field('Repeat every', numInput(event, 'every', { int: true, min: 0, structural: true, disabled: locked })),
      field('Repeat until', numInput(event, 'until', { int: true, min: 0, structural: true, disabled: locked })),
      el('div', { class: 'note', text: 'Repeat every 0 = fire once. Until 0 = until the animation ends.' }),
    );
    if (event.type === 'PARTICLE') {
      fields.append(
        pickerField('Particle', textInput(event, 'particle', { list: 'particleList' }), el('button', { text: 'Browse', onclick: () => openPicker({ kind: 'particle', title: 'Choose a particle', entries: state.meta.particles, current: event.particle, onPick: (name) => { event.particle = name; renderInspector(); changed(); } }) })),
        field('Count', numInput(event, 'count', { int: true, min: 0, max: 500 })),
        field('Spread', numInput(event, 'offsetX', { step: 0.05 }), numInput(event, 'offsetY', { step: 0.05 }), numInput(event, 'offsetZ', { step: 0.05 })),
        field('Speed', numInput(event, 'speed', { step: 0.01 })),
        field('Height', numInput(event, 'height', { step: 0.05 })),
      );
    } else if (event.type === 'SOUND') {
      fields.append(
        pickerField('Sound', textInput(event, 'sound', { list: 'soundList' }),
          el('button', { text: '\u25b6', title: 'Preview', onclick: () => { unlockAudio(); playSound(event.sound, event.volume, event.pitch); } }),
          el('button', { text: 'Browse', onclick: () => openPicker({ kind: 'sound', title: 'Choose a sound', entries: state.meta.sounds, current: event.sound, onPick: (key) => { event.sound = key; renderInspector(); changed(); playSound(key, event.volume, event.pitch); } }) })),
        field('Volume', numInput(event, 'volume', { step: 0.1, min: 0, max: 10 })),
        field('Pitch', numInput(event, 'pitch', { step: 0.1, min: 0.5, max: 2 })),
      );
    } else if (event.type === 'COMMAND') {
      fields.append(
        field('Command', textInput(event, 'command', { disabled: locked })),
        field('Run as', selectInput(event, 'source', state.meta.commandSources, { disabled: locked })),
        el('div', { class: 'note', text: 'Without the leading slash. %player% and PlaceholderAPI placeholders are supported.' }),
        locked ? el('div', { class: 'warn', text: 'Editing commands requires the itemflex.editor.commands permission.' }) : el('div', { class: 'warn', text: 'Console commands run with full server permissions. Be careful.' }),
      );
    } else if (event.type === 'MESSAGE') {
      fields.append(
        field('Message', textInput(event, 'message')),
        el('div', { class: 'note', text: 'Sent to the player in chat. Colour codes (&a), %player% and PlaceholderAPI placeholders work. Click actions are not allowed.' }),
      );
    } else {
      fields.append(
        field('Line', numInput(event, 'line', { int: true, min: 0 })),
        field('Text', textInput(event, 'text')),
        el('div', { class: 'note', text: 'Replaces the text of that line (0 = top) when this event fires.' }),
      );
    }
    buttons.append(
      el('button', { text: 'Duplicate', disabled: locked, onclick: () => {
        const copy = JSON.parse(JSON.stringify(event));
        copy.tick = Math.min(maxTick(), copy.tick + 5);
        state.def.events.push(copy);
        select('event', copy);
        changed(true);
      } }),
      el('button', { class: 'danger', text: 'Delete', onclick: deleteSelection }),
    );
  }

  panel.append(fields, buttons);
}

/* ---------- animation list / persistence ---------- */

function renderSelect() {
  const select = $('animSelect');
  select.innerHTML = '';
  const names = [...state.names];
  if (state.isNew && !names.includes(state.name)) names.push(state.name);
  names.sort().forEach((name) => select.append(el('option', { value: name, text: name })));
  select.value = state.name;
  $('btnDel').disabled = state.isNew || state.name === 'default';
}

async function refreshList() {
  const list = await api('animations');
  state.names = list.map((entry) => entry.name);
}

function rebuildAll() {
  renderSelect();
  renderSettings();
  renderTimeline();
  renderInspector();
  refresh();
}

async function loadAnimation(name) {
  const def = await api(`animations/${encodeURIComponent(name)}`);
  state.def = def;
  state.name = name;
  state.isNew = false;
  state.snapshot = JSON.stringify(def);
  state.selection = null;
  state.tick = 0;
  state.playing = false;
  setPlayIcon(false);
  rebuildAll();
  resetHistory();
}

async function confirmDiscard() {
  if (!isDirty()) return true;
  return !!(await dialog({ title: 'Discard changes?', message: 'You have unsaved changes that will be lost.', confirmText: 'Discard', danger: true }));
}

async function askName(title, message) {
  const answer = await dialog({ title, message, input: { placeholder: 'my-animation', maxLength: 32 }, confirmText: 'Create' });
  const name = (answer || '').trim().toLowerCase();
  if (!name) return null;
  if (!/^[a-z0-9_-]{1,32}$/.test(name) || RESERVED.includes(name)) {
    toast('Names may only contain a-z, 0-9, "_" and "-" (max 32 characters) and cannot be "reload" or "editor".', 'error');
    return null;
  }
  if (state.names.includes(name)) { toast('An animation with that name already exists.', 'error'); return null; }
  return name;
}

async function save() {
  try {
    const result = await api(`animations/${encodeURIComponent(state.name)}`, { method: 'PUT', body: JSON.stringify(state.def) });
    state.def = result.animation;
    state.snapshot = JSON.stringify(state.def);
    state.isNew = false;
    state.selection = null;
    await refreshList();
    rebuildAll();
    resetHistory();
    toast('Saved. New flexes use it immediately.');
    result.warnings.forEach((warning) => toast(warning, 'warn'));
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ---------- playback ---------- */

const PLAY_SVG = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>';
const SOUND_SVG = '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5l4.5 3.5v-12L7.5 9.5z"/><path d="M15.5 9a4 4 0 010 6"/><path d="M18 6.5a8 8 0 010 11"/></svg>';
const MUTED_SVG = '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5l4.5 3.5v-12L7.5 9.5z"/><path d="M16 9.5l5 5"/><path d="M21 9.5l-5 5"/></svg>';

function setPlayIcon(playing) {
  $('btnPlay').innerHTML = playing ? PAUSE_SVG : PLAY_SVG;
}

function setMuteIcon(muted) {
  $('btnMute').innerHTML = muted ? MUTED_SVG : SOUND_SVG;
  $('btnMute').classList.toggle('off', muted);
}

let lastFrame = 0;

const dev = { on: false, last: 0, frames: 0, since: 0, fps: 0, worst: 0, renders: 0, rps: 0, delta: 0 };

function toggleDev() {
  dev.on = !dev.on;
  $('devPanel').hidden = !dev.on;
  dev.frames = 0;
  dev.since = 0;
  if (dev.on) $('devPanel').textContent = 'Measuring...';
  if (dev.on) toast('Dev mode on. Press F8 to hide.');
}

function updateDev(now) {
  if (!dev.since) { dev.since = now; dev.last = now; dev.renders = preview.stats?.renders || 0; }
  dev.frames++;
  dev.worst = Math.max(dev.worst, now - dev.last);
  dev.last = now;
  if (now - dev.since < 500) return;
  const seconds = (now - dev.since) / 1000;
  dev.fps = dev.frames / seconds;
  const renders = preview.stats?.renders || 0;
  dev.rps = (renders - dev.renders) / seconds;
  dev.renders = renders;
  const stats = preview.stats || {};
  const heap = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'n/a';
  const rows = [
    ['FPS', dev.fps.toFixed(0)],
    ['Worst frame', `${dev.worst.toFixed(1)} ms`],
    ['Renders/s', dev.rps.toFixed(0)],
    ['Render', `${(stats.totalMs || 0).toFixed(1)} ms`],
    ['  floor', `${(stats.floorMs || 0).toFixed(1)} ms`],
    ['  scene', `${(stats.sceneMs || 0).toFixed(1)} ms`],
    ['Drawables', stats.drawables ?? 0],
    ['Particles', stats.particles ?? 0],
    ['Tick', `${state.tick.toFixed(1)} / ${state.def.duration}`],
    ['Canvas', `${preview.canvas.width}x${preview.canvas.height} @${(preview.ratio || 1).toFixed(2)}x`],
    ['Camera', `yaw ${preview.cam.yaw.toFixed(0)} pitch ${preview.cam.pitch.toFixed(0)} dist ${preview.cam.dist.toFixed(1)}`],
    ['Floor', preview.options.floor],
    ['Events', state.def.events.length],
    ['Tracks', state.def.tracks.length],
    ['JS heap', heap],
    ['Assets', mc.ready ? `Minecraft ${mc.version}` : 'none'],
    ['Sound', audio.muted ? 'muted' : 'on'],
  ];
  $('devPanel').replaceChildren(...rows.map(([k, v]) => el('div', {}, el('span', { text: k }), el('b', { text: String(v) }))));
  dev.frames = 0;
  dev.since = now;
  dev.worst = 0;
}

function frame(now) {
  requestAnimationFrame(frame);
  if (dev.on) updateDev(now);
  if (!state.playing) { lastFrame = now; return; }
  const speed = parseFloat($('speed').value);
  state.tick += ((now - lastFrame) / 1000) * 20 * speed;
  lastFrame = now;
  if (state.tick > state.def.duration + 2) {
    if ($('loop').checked) { state.tick = 0; state.lastFired = -1; stopAudio(); }
    else { state.tick = state.def.duration + 2; state.playing = false; setPlayIcon(false); }
  }
  fireSounds();
  refresh(false);
}

function fireSounds() {
  const now = Math.min(Math.floor(state.tick), state.def.duration);
  for (let t = Math.max(state.lastFired + 1, now - 5); t <= now; t++) {
    for (const event of state.def.events) {
      if (event.type === 'SOUND' && shouldFire(event, t)) playSound(event.sound, event.volume, event.pitch);
    }
  }
  state.lastFired = Math.max(state.lastFired, now);
}

function togglePlay() {
  unlockAudio();
  state.playing = !state.playing;
  if (state.playing && state.tick >= state.def.duration + 2) state.tick = 0;
  if (state.playing) state.lastFired = Math.floor(state.tick) - 1;
  setPlayIcon(state.playing);
  if (!state.playing) pauseAudio();
}

/* ---------- boot ---------- */

async function boot() {
  try {
    [state.session, state.meta] = await Promise.all([api('session'), api('meta')]);
  } catch (error) {
    if (error.message !== 'Session expired') showOverlay('Cannot reach the editor', error.message);
    return;
  }

  $('particleList').append(...state.meta.particles.map((p) => el('option', { value: p.name })));
  $('soundList').append(...state.meta.sounds.map((s) => el('option', { value: s })));
  $('who').textContent = `Signed in as ${state.session.player}${state.session.canEditCommands ? '' : ' (commands locked)'}`;

  preview = new Preview($('preview'));
  state.def = defaultDefinition();

  $('btnPlay').addEventListener('click', togglePlay);
  $('btnStop').addEventListener('click', () => { state.playing = false; setPlayIcon(false); setTick(0); });
  $('btnCam').addEventListener('click', () => preview.resetCamera());
  preview.particleKeys = Object.fromEntries(state.meta.particles.map((p) => [p.name, p.key]));

  for (const [id, option] of [['optPlayer', 'player'], ['optParticles', 'particles']]) {
    $(id).addEventListener('change', () => { preview.options[option] = $(id).checked; refresh(); });
  }
  $('btnMute').addEventListener('click', () => {
    audio.muted = !audio.muted;
    setMuteIcon(audio.muted);
  });
  setMuteIcon(audio.muted);
  setPlayIcon(false);
  $('optFloor').addEventListener('change', () => { preview.options.floor = $('optFloor').value; refresh(); });
  $('btnItem').addEventListener('click', () => {
    if (!mc.ready) { toast('Minecraft assets are not available.', 'error'); return; }
    openPicker({ kind: 'item', title: 'Preview item', entries: mc.items, current: preview.item.id, onPick: async (id) => { await preview.setItem(id); updateItemButton(); refresh(); } });
  });
  $('btnUndo').addEventListener('click', () => stepHistory(-1));
  $('btnRedo').addEventListener('click', () => stepHistory(1));

  $('animSelect').addEventListener('change', async (event) => {
    const target = event.target.value;
    if (target === state.name) return;
    if (!(await confirmDiscard())) { event.target.value = state.name; return; }
    try { await loadAnimation(target); } catch (error) { toast(error.message, 'error'); event.target.value = state.name; }
  });

  $('btnNew').addEventListener('click', async () => {
    if (!(await confirmDiscard())) return;
    const name = await askName('New animation', 'Names use a-z, 0-9, "-" and "_".');
    if (!name) return;
    state.def = defaultDefinition();
    state.name = name;
    state.isNew = true;
    state.snapshot = '';
    state.selection = null;
    state.tick = 0;
    rebuildAll();
    resetHistory();
  });

  $('btnDup').addEventListener('click', async () => {
    const name = await askName('Duplicate animation', `Name for the copy of "${state.name}".`);
    if (!name) return;
    state.def = JSON.parse(JSON.stringify(state.def));
    state.name = name;
    state.isNew = true;
    state.snapshot = '';
    state.selection = null;
    rebuildAll();
    resetHistory();
  });

  $('btnDel').addEventListener('click', async () => {
    if (!(await dialog({ title: 'Delete animation?', message: `"${state.name}" will be permanently deleted from the server.`, confirmText: 'Delete', danger: true }))) return;
    try {
      await api(`animations/${encodeURIComponent(state.name)}`, { method: 'DELETE' });
      await refreshList();
      await loadAnimation(state.names.includes('default') ? 'default' : state.names[0]);
      toast('Deleted.');
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('btnSave').addEventListener('click', save);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'F8') { event.preventDefault(); toggleDev(); return; }
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); return; }
    if ((event.ctrlKey || event.metaKey) && !typing && event.key.toLowerCase() === 'z') { event.preventDefault(); stepHistory(event.shiftKey ? 1 : -1); return; }
    if ((event.ctrlKey || event.metaKey) && !typing && event.key.toLowerCase() === 'y') { event.preventDefault(); stepHistory(1); return; }
    if (typing) return;
    if (event.key === ' ') { event.preventDefault(); togglePlay(); }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelection(); }
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === ' ' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) event.preventDefault();
  });

  window.addEventListener('beforeunload', (event) => { if (state.def && isDirty()) { event.preventDefault(); event.returnValue = ''; } });

  try {
    await refreshList();
    await loadAnimation(state.names.includes('default') ? 'default' : state.names[0]);
  } catch (error) {
    toast(error.message, 'error');
  }

  requestAnimationFrame(frame);
  setupSplitter();

  $('btnHelp').addEventListener('click', startTour);
  if (!tourSeen()) setTimeout(startTour, 700);

  initAssets((message) => setAssetStatus(message, 'busy')).then(async (ok) => {
    if (!ok) { setAssetStatus('Minecraft assets unavailable', 'warn'); return; }
    await Promise.all([loadSounds(), preview.initAssets()]);
    setAssetStatus(`Minecraft ${mc.version} assets`, 'ok');
    updateItemButton();
    preview.invalidateParticles();
    renderInspector();
    refresh();
  });
}

function setAssetStatus(text, kind) {
  const node = $('assetStatus');
  node.textContent = text;
  node.className = kind;
}

async function updateItemButton() {
  const button = $('btnItem');
  button.innerHTML = '';
  if (mc.ready) {
    const icon = await renderIcon(preview.item.id, 24);
    icon.className = 'icon';
    button.append(icon);
  }
  button.append(el('span', { text: preview.item.name }));
}

function setupSplitter() {
  const handle = $('splitter');
  const wrap = $('previewWrap');
  handle.addEventListener('pointerdown', (event) => {
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startHeight = wrap.getBoundingClientRect().height;
    const move = (e) => {
      wrap.style.flex = `0 0 ${Math.max(140, startHeight + e.clientY - startY)}px`;
      preview.resize();
      preview.render();
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}

boot();
