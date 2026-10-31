const STORAGE_KEY = 'itemflex.tour.done';

const STEPS = [
  {
    title: 'Welcome to the ItemFlex editor',
    text: 'A quick tour of the main parts. It takes under a minute, and you can replay it any time from the ? button at the top.',
  },
  {
    target: '#animSelect',
    title: 'Your animations',
    text: 'Pick an animation to edit here. New, Duplicate and Delete sit right next to it. Players use the highest-priority animation they have permission for.',
    side: 'bottom',
  },
  {
    target: '#settings',
    title: 'Settings',
    text: 'Permission, priority and duration, plus how the item and the hologram text look when the animation starts.',
    side: 'right',
  },
  {
    target: '#previewWrap',
    title: 'Live preview',
    text: 'See your animation as players will. Drag to orbit, right-drag to pan and scroll to zoom. It is an approximation of the in-game result.',
    side: 'bottom',
  },
  {
    target: '#transport',
    title: 'Playback',
    text: 'Play with Space, loop it, change the speed, switch the floor, or hide the player and particles. The item button changes the preview item.',
    side: 'top',
  },
  {
    target: '.tl-toolbar',
    title: 'Add tracks and events',
    text: 'Animate makes a track that moves, rotates, scales or fades the item or text. Trigger adds one-off events like particles, sounds, commands, chat messages and text changes.',
    side: 'top',
    fallback: '#timeline',
  },
  {
    target: '.tl-scroll',
    title: 'The timeline',
    text: 'Click the ruler to scrub. Double-click a lane to add a keyframe or event, drag to move it, and press Delete to remove the selection. Ctrl+scroll zooms the timeline.',
    side: 'top',
    fallback: '#timeline',
  },
  {
    target: '#inspector',
    title: 'Inspector',
    text: 'Select a keyframe or event to edit its exact values, easing, particle, sound and more.',
    side: 'left',
  },
  {
    target: '#btnSave',
    title: 'Save',
    text: 'Save with Ctrl+S. The animation applies on the server immediately, with no reload needed. Press F8 any time to see performance info.',
    side: 'bottom',
  },
];

let active = null;

export function tourSeen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch (error) {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch (error) {
    /* storage unavailable: the tour will simply show again next time */
  }
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function findTarget(step) {
  if (!step.target) return null;
  const candidates = [step.target, step.fallback];
  for (const selector of candidates) {
    if (!selector) continue;
    const node = document.querySelector(selector);
    if (node && node.getClientRects().length > 0) return node;
  }
  return null;
}

export function startTour() {
  if (active) return;

  const layer = make('div', 'tour');
  const spot = make('div', 'tour-spot');
  const card = make('div', 'tour-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-live', 'polite');
  const title = make('h3');
  const text = make('p');
  const dots = make('div', 'tour-dots');
  const buttons = make('div', 'tour-actions');
  const skip = make('button', 'tour-skip', 'Skip tour');
  const back = make('button', '', 'Back');
  const next = make('button', 'primary', 'Next');
  buttons.append(skip, make('span', 'tour-gap'), back, next);
  card.append(title, text, dots, buttons);
  layer.append(spot, card);
  document.body.append(layer);

  let index = 0;

  const close = () => {
    markSeen();
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    layer.remove();
    active = null;
  };

  const place = () => {
    const step = STEPS[index];
    const node = findTarget(step);
    const margin = 14;
    card.style.visibility = 'hidden';

    if (!node) {
      spot.style.cssText = 'left:50%;top:50%;width:0;height:0';
      card.style.left = `${Math.round((window.innerWidth - card.offsetWidth) / 2)}px`;
      card.style.top = `${Math.round((window.innerHeight - card.offsetHeight) / 2)}px`;
      card.removeAttribute('data-side');
      card.style.visibility = '';
      return;
    }

    const rect = node.getBoundingClientRect();
    const pad = 6;
    const box = {
      left: Math.max(4, rect.left - pad),
      top: Math.max(4, rect.top - pad),
      right: Math.min(window.innerWidth - 4, rect.right + pad),
      bottom: Math.min(window.innerHeight - 4, rect.bottom + pad),
    };
    spot.style.left = `${box.left}px`;
    spot.style.top = `${box.top}px`;
    spot.style.width = `${box.right - box.left}px`;
    spot.style.height = `${box.bottom - box.top}px`;

    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const space = {
      bottom: window.innerHeight - box.bottom,
      top: box.top,
      right: window.innerWidth - box.right,
      left: box.left,
    };
    const need = { bottom: height + margin, top: height + margin, right: width + margin, left: width + margin };
    const order = [step.side, 'bottom', 'top', 'right', 'left'];
    let side = order.find((candidate) => candidate && space[candidate] >= need[candidate]);
    let left;
    let top;

    if (!side) {
      side = 'inside';
      left = box.left + (box.right - box.left - width) / 2;
      top = box.top + (box.bottom - box.top - height) / 2;
    } else if (side === 'bottom') {
      left = box.left + (box.right - box.left - width) / 2;
      top = box.bottom + margin;
    } else if (side === 'top') {
      left = box.left + (box.right - box.left - width) / 2;
      top = box.top - height - margin;
    } else if (side === 'right') {
      left = box.right + margin;
      top = box.top + Math.min(24, (box.bottom - box.top) / 2) - 24;
    } else {
      left = box.left - width - margin;
      top = box.top + Math.min(24, (box.bottom - box.top) / 2) - 24;
    }

    left = Math.min(Math.max(12, left), window.innerWidth - width - 12);
    top = Math.min(Math.max(12, top), window.innerHeight - height - 12);
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
    card.setAttribute('data-side', side);

    if (side === 'bottom' || side === 'top') {
      const centre = box.left + (box.right - box.left) / 2 - left;
      card.style.setProperty('--arrow', `${Math.min(Math.max(20, centre), width - 20)}px`);
    } else {
      const centre = box.top + Math.min(24, (box.bottom - box.top) / 2) - top;
      card.style.setProperty('--arrow', `${Math.min(Math.max(20, centre), height - 20)}px`);
    }
    card.style.visibility = '';
  };

  const show = (direction = 1) => {
    while (index >= 0 && index < STEPS.length && STEPS[index].target && !findTarget(STEPS[index])) {
      index += direction;
    }
    if (index >= STEPS.length) { close(); return; }
    if (index < 0) index = 0;

    const step = STEPS[index];
    const node = findTarget(step);
    if (node) node.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    title.textContent = step.title;
    text.textContent = step.text;
    dots.replaceChildren(...STEPS.map((_, i) => make('i', i === index ? 'on' : '')));
    back.hidden = index === 0;
    next.textContent = index === STEPS.length - 1 ? 'Done' : index === 0 ? 'Start tour' : 'Next';
    skip.hidden = index === STEPS.length - 1;
    place();
    next.focus({ preventScroll: true });
  };

  const go = (direction) => {
    index += direction;
    if (index >= STEPS.length) { close(); return; }
    show(direction);
  };

  const onKey = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); go(1); return; }
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); event.stopPropagation(); go(-1); return; }
    if (event.key === ' ' || event.key === 'Enter') {
      if (document.activeElement === skip || document.activeElement === back) return;
      event.preventDefault();
      event.stopPropagation();
      go(1);
    }
  };

  next.addEventListener('click', () => go(1));
  back.addEventListener('click', () => go(-1));
  skip.addEventListener('click', close);
  layer.addEventListener('pointerdown', (event) => {
    if (!card.contains(event.target)) event.stopPropagation();
  }, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', place);

  active = { close };
  show(1);
}
