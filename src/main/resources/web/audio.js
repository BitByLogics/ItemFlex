/* Plays Minecraft's own sounds using the sound events from sounds.json. */

import { getJson, stripNamespace } from './mc.js';

let context = null;
let events = null;
const buffers = new Map();
const active = new Set();

export const audio = { muted: false, ready: false };

export async function loadSounds() {
  events = (await getJson('/assets/sounds.json')) || {};
  audio.ready = Object.keys(events).length > 0;
  return audio.ready;
}

export const soundEventKeys = () => Object.keys(events || {}).sort();

/* Browsers only allow audio after a user gesture. */
export function unlockAudio() {
  if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
  if (context.state === 'suspended') context.resume();
}

export function pauseAudio() {
  if (context && context.state === 'running') context.suspend();
}

export function stopAudio() {
  for (const source of active) {
    try { source.stop(); } catch { /* already stopped */ }
  }
  active.clear();
}

function pick(entries) {
  const weights = entries.map((entry) => (typeof entry === 'object' && entry.weight) || 1);
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < entries.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return entries[i];
  }
  return entries[0];
}

function resolve(eventKey, depth = 0) {
  const event = events?.[stripNamespace(eventKey)];
  if (!event || !event.sounds || event.sounds.length === 0 || depth > 6) return null;
  const entry = pick(event.sounds);
  const spec = typeof entry === 'string' ? { name: entry } : entry;
  if (spec.type === 'event') {
    const inner = resolve(spec.name, depth + 1);
    if (!inner) return null;
    return { ...inner, volume: inner.volume * (spec.volume ?? 1), pitch: inner.pitch * (spec.pitch ?? 1) };
  }
  return { name: stripNamespace(spec.name), volume: spec.volume ?? 1, pitch: spec.pitch ?? 1 };
}

async function loadBuffer(name) {
  if (!buffers.has(name)) {
    buffers.set(name, (async () => {
      const response = await fetch(`/assets/sound/${name}.ogg`, { credentials: 'same-origin' });
      if (!response.ok) return null;
      try {
        return await context.decodeAudioData(await response.arrayBuffer());
      } catch {
        return null;
      }
    })());
  }
  return buffers.get(name);
}

export async function playSound(eventKey, volume = 1, pitch = 1) {
  if (audio.muted || !audio.ready) return false;
  unlockAudio();
  const sound = resolve(eventKey);
  if (!sound) return false;
  const buffer = await loadBuffer(sound.name);
  if (!buffer) return false;
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.playbackRate.value = Math.max(0.25, Math.min(4, pitch * sound.pitch));
  gain.gain.value = Math.max(0, Math.min(1, volume)) * sound.volume;
  source.connect(gain).connect(context.destination);
  active.add(source);
  source.addEventListener('ended', () => active.delete(source));
  source.start();
  return true;
}
