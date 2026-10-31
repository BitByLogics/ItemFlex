import { renderIcon, itemName } from './mc.js';
import { loadSprites } from './particles.js';
import { playSound, unlockAudio } from './audio.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* kind: 'item' | 'particle' | 'sound'
 * entries: item ids, {name, key} particles, or sound keys. */
export function openPicker({ kind, title, entries, current, onPick }) {
  const backdrop = make('div', 'modal-backdrop');
  const modal = make('div', 'modal');
  const header = make('div', 'modal-head');
  const search = make('input', 'modal-search');
  search.type = 'text';
  search.placeholder = 'Search...';
  const count = make('span', 'modal-count');
  const close = make('button', 'icon-btn', '✕');
  header.append(make('h2', '', title), search, count, close);
  const body = make('div', kind === 'sound' ? 'modal-body list' : 'modal-body grid');
  modal.append(header, body);
  backdrop.append(modal);
  document.body.append(backdrop);

  const dispose = () => { observer.disconnect(); backdrop.remove(); window.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); dispose(); } };
  window.addEventListener('keydown', onKey, true);
  close.addEventListener('click', dispose);
  backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) dispose(); });

  const lazy = new Map();
  const observer = new IntersectionObserver((records) => {
    for (const record of records) {
      if (!record.isIntersecting) continue;
      const fn = lazy.get(record.target);
      if (fn) { lazy.delete(record.target); observer.unobserve(record.target); fn(); }
    }
  }, { root: body, rootMargin: '200px' });

  const label = (entry) => {
    if (kind === 'item') return itemName(entry);
    if (kind === 'particle') return entry.name;
    return entry;
  };
  const identity = (entry) => (kind === 'item' || kind === 'sound' ? entry : entry.name);

  let firstMatch = null;
  const rebuild = () => {
    const query = search.value.trim().toLowerCase();
    body.innerHTML = '';
    lazy.clear();
    observer.disconnect();
    const filtered = entries.filter((entry) => {
      if (!query) return true;
      const text = `${identity(entry)} ${label(entry)}`.toLowerCase();
      return text.includes(query);
    });
    count.textContent = `${filtered.length}`;
    firstMatch = filtered.length > 0 ? identity(filtered[0]) : null;
    if (filtered.length === 0) body.append(make('div', 'note wide', 'No matches.'));
    const shown = filtered.slice(0, 1500);

    for (const entry of shown) {
      const id = identity(entry);
      const row = make('div', `pick${id === current ? ' current' : ''}`);
      row.title = id;

      if (kind === 'sound') {
        const play = make('button', 'icon-btn', '▶');
        play.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); playSound(id, 1, 1); });
        row.append(play, make('span', 'pick-label', id));
      } else {
        const holder = make('div', 'pick-icon');
        row.append(holder, make('span', 'pick-label', label(entry)));
        const load = kind === 'item'
          ? async () => { const canvas = await renderIcon(id, 40); canvas.className = 'icon'; holder.append(canvas.cloneNode ? copyCanvas(canvas) : canvas); }
          : async () => {
            const sprites = await loadSprites(entry.key);
            if (sprites[0]) { const img = sprites[0].cloneNode(); img.className = 'icon sprite'; holder.append(img); }
          };
        lazy.set(row, load);
        observer.observe(row);
      }

      row.addEventListener('click', () => { dispose(); onPick(id); });
      body.append(row);
    }
    if (filtered.length > shown.length) body.append(make('div', 'note wide', `Showing the first ${shown.length}. Refine your search to see more.`));
  };

  let typing = null;
  search.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(rebuild, 120); });
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    clearTimeout(typing);
    rebuild();
    if (firstMatch !== null) { dispose(); onPick(firstMatch); }
  });
  rebuild();
  search.focus();
}

function copyCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.className = 'icon';
  canvas.getContext('2d').drawImage(source, 0, 0);
  return canvas;
}
