// contextmenu.js — right-click (or press and hold) on anything in the valley:
// a little paper note that says what it is and what it might lead to, with the
// things you can do to it underneath. One menu at a time; click away to close.

let open = null;

export function closeMenu() {
  if (open) { open.remove(); open = null; }
}

// items: [{ label, hint?, onClick?, disabled? }]
export function showMenu(x, y, { title, lines = [], leads = '', items = [] }) {
  closeMenu();
  const el = document.createElement('div');
  el.className = 'ctx';
  el.setAttribute('role', 'menu');
  const head = document.createElement('div'); head.className = 'ctx-head';
  const h = document.createElement('b'); h.textContent = title; head.append(h);
  for (const t of lines) { const p = document.createElement('p'); p.textContent = t; head.append(p); }
  if (leads) { const p = document.createElement('p'); p.className = 'leads'; p.textContent = leads; head.append(p); }
  el.append(head);
  const doable = items.filter(Boolean);
  if (doable.length) {
    const ul = document.createElement('ul');
    for (const it of doable) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.disabled = !!it.disabled;
      b.innerHTML = `<span>${it.label}</span>` + (it.hint ? `<small>${it.hint}</small>` : '');
      b.onclick = ev => { ev.stopPropagation(); closeMenu(); it.onClick && it.onClick(); };
      li.append(b); ul.append(li);
    }
    el.append(ul);
  }
  document.body.append(el);
  // Keep it on screen.
  const r = el.getBoundingClientRect();
  const left = Math.min(x + 8, window.innerWidth - r.width - 8), top = Math.min(y + 8, window.innerHeight - r.height - 8);
  el.style.left = Math.max(8, left) + 'px'; el.style.top = Math.max(8, top) + 'px';
  open = el;
  setTimeout(() => {
    const away = ev => { if (!el.contains(ev.target)) { closeMenu(); window.removeEventListener('pointerdown', away, true); } };
    window.addEventListener('pointerdown', away, true);
  }, 0);
  return el;
}

export function menuOpen() { return !!open; }

// Press and hold on touch screens opens the same menu as a right-click.
export function longPress(target, onOpen, ms = 520) {
  let timer = null, start = null;
  target.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse') return;
    start = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    clearTimeout(timer);
    timer = setTimeout(() => {
      // Cancel whatever drag was starting, then open.
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: start.id, bubbles: true }));
      onOpen(ev);
    }, ms);
  }, true);
  const stop = ev => { if (start && ev.pointerId === start.id && (ev.type !== 'pointermove' || Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8)) { clearTimeout(timer); start = null; } };
  window.addEventListener('pointermove', stop, true);
  window.addEventListener('pointerup', stop, true);
  window.addEventListener('pointercancel', stop, true);
}
