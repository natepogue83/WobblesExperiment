// drag.js — pointer dragging for tray items and Wobblins (mouse and touch).
// A press that never moves is a tap; past a few pixels it becomes a drag.

const NS = 'http://www.w3.org/2000/svg';
const TAP_SLOP = 6;

export function toSvgPoint(svg, clientX, clientY) {
  const p = svg.createSVGPoint();
  p.x = clientX; p.y = clientY;
  const m = svg.getScreenCTM();
  return m ? p.matrixTransform(m.inverse()) : { x: clientX, y: clientY };
}

export function overSvg(svg, clientX, clientY) {
  const r = svg.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

// press(el, { onTap, onStart, onMove, onDrop, onCancel }) — wires one element.
export function press(el, handlers) {
  el.addEventListener('pointerdown', down => {
    if (down.button !== undefined && down.button !== 0) return;
    down.preventDefault();
    const sx = down.clientX, sy = down.clientY;
    let dragging = false;
    // Listen on window, not the element: a lifted Wobblin is re-ordered in
    // the SVG, which would drop pointer capture.
    const move = ev => {
      if (ev.pointerId !== down.pointerId) return;
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > TAP_SLOP) {
        dragging = true;
        handlers.onStart && handlers.onStart(ev);
      }
      if (dragging && handlers.onMove) handlers.onMove(ev);
    };
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (dragging) handlers.onDrop && handlers.onDrop(ev);
      else handlers.onTap && handlers.onTap(ev);
    };
    const cancel = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (dragging && handlers.onCancel) handlers.onCancel(ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  });
}

// A floating copy of the tray icon that follows the finger.
export function makeGhost(iconHtml, label) {
  const g = document.createElement('div');
  g.className = 'drag-ghost';
  g.innerHTML = iconHtml + (label ? `<span>${label}</span>` : '');
  document.body.append(g);
  return {
    move(x, y) { g.style.transform = `translate(${x - 32}px, ${y - 56}px)`; },
    remove() { g.remove(); }
  };
}

// The drop preview drawn into the valley: a ring where it will land.
export function drawHint(svg, hint) {
  let g = svg.querySelector('#drag-hint');
  if (!g) { g = document.createElementNS(NS, 'g'); g.id = 'drag-hint'; svg.append(g); }
  g.replaceChildren();
  if (!hint) return;
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', hint.x); c.setAttribute('cy', hint.y); c.setAttribute('r', hint.r || 24);
  c.setAttribute('class', 'drop-ring' + (hint.ok ? '' : ' bad'));
  g.append(c);
  if (hint.label) {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', hint.x); t.setAttribute('y', hint.y - (hint.r || 24) - 8);
    t.setAttribute('class', 'drop-label');
    t.textContent = hint.label;
    g.append(t);
  }
}

export function clearHint(svg) {
  const g = svg.querySelector('#drag-hint');
  if (g) g.remove();
}
