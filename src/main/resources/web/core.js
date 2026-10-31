const bounceOut = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
  if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
  t -= 2.625 / d1;
  return n1 * t * t + 0.984375;
};

export const EASINGS = {
  LINEAR: (t) => t,
  STEP: () => 0,
  EASE_IN: (t) => t * t * t,
  EASE_OUT: (t) => 1 - Math.pow(1 - t, 3),
  EASE_IN_OUT: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  BACK_OUT: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  BOUNCE_OUT: bounceOut,
};

export const IDENTITIES = {
  SCALE: 1, ROTATION_X: 0, ROTATION_Y: 0, ROTATION_Z: 0,
  OFFSET_X: 0, OFFSET_Y: 0, OFFSET_Z: 0, FORWARD: 0, OPACITY: 1,
};

export const MULTIPLICATIVE = new Set(['SCALE', 'OPACITY']);

export function evalTrack(track, tick) {
  const frames = track.keyframes;
  if (!frames || frames.length === 0) return IDENTITIES[track.property] ?? 0;
  if (tick <= frames[0].tick) return frames[0].value;
  for (let i = 0; i < frames.length - 1; i++) {
    const prev = frames[i];
    const next = frames[i + 1];
    if (tick >= next.tick) continue;
    const progress = (tick - prev.tick) / (next.tick - prev.tick);
    const ease = EASINGS[prev.easing] || EASINGS.LINEAR;
    return prev.value + (next.value - prev.value) * ease(progress);
  }
  return frames[frames.length - 1].value;
}

export function evalProperty(def, target, property, line, tick) {
  let result = IDENTITIES[property];
  for (const track of def.tracks) {
    if (track.target !== target || track.property !== property) continue;
    if (target === 'TEXT' && track.line >= 0 && track.line !== line) continue;
    const value = evalTrack(track, tick);
    if (MULTIPLICATIVE.has(property)) result *= value;
    else result += value;
  }
  return result;
}

export function sortFrames(track) {
  track.keyframes.sort((a, b) => a.tick - b.tick);
}

export function defaultDefinition() {
  return {
    permission: '',
    priority: 0,
    duration: 80,
    spawn: { distance: 1.5, offset: { x: 0, y: 1.5, z: 0 }, itemOffset: { x: 0, y: -0.17, z: 0 } },
    item: { displayTransform: 'GUI', itemScale: 0.75, blockScale: 0.5 },
    text: {
      lines: ['&6&lFLEXING', '%item_name%'],
      lineSpacing: 0.17,
      billboard: 'VERTICAL',
      background: { opacity: 0, red: 0, green: 0, blue: 0 },
      blockLight: 15,
      skyLight: 15,
      shadow: true,
    },
    tracks: [
      {
        target: 'ITEM', line: -1, property: 'SCALE',
        keyframes: [
          { tick: 0, value: 0, easing: 'EASE_OUT' },
          { tick: 12, value: 1, easing: 'LINEAR' },
          { tick: 68, value: 1, easing: 'EASE_IN' },
          { tick: 80, value: 0, easing: 'LINEAR' },
        ],
      },
      {
        target: 'ITEM', line: -1, property: 'ROTATION_Y',
        keyframes: [
          { tick: 0, value: 0, easing: 'LINEAR' },
          { tick: 80, value: 560, easing: 'LINEAR' },
        ],
      },
    ],
    events: [],
  };
}

export function defaultEvent(type, tick) {
  const base = { type, tick, every: 0, until: 0 };
  switch (type) {
    case 'PARTICLE':
      return { ...base, particle: 'GLOW', count: 10, offsetX: 0.1, offsetY: 0.1, offsetZ: 0.1, speed: 0.01, height: 0 };
    case 'SOUND':
      return { ...base, sound: 'minecraft:entity.experience_orb.pickup', volume: 1, pitch: 1 };
    case 'COMMAND':
      return { ...base, command: 'say Flexing, %player%!', source: 'CONSOLE' };
    case 'MESSAGE':
      return { ...base, message: '&aFlexing, %player%!' };
    default:
      return { ...base, line: 0, text: '&fNew text' };
  }
}
