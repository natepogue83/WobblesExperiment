// puppets.js — the Wobblins you watch. The sim decides once per colony day
// where each Wobblin is and what it is doing; puppets act that out
// continuously: walking over, eating at a bush, warming at the fire, napping,
// stacking stones, chatting with a friend. Render-only: uses Math.random and
// real time freely and never touches the world.
import { ZONES } from '../sim/geometry.js';
import { ITEM_ICONS } from '../render/sprites.js';
import { wobblinScale } from '../render/render.js';

const WALK = 46, RUN = 120;          // SVG units per second (RUN for long trips)
const NOTE = '<path d="M-2 4 V-5 L5 -7 V2" stroke="#6b4fb0" stroke-width="1.8" fill="none"/><circle cx="-3.5" cy="4" r="2.4" fill="#6b4fb0"/><circle cx="3.5" cy="2" r="2.4" fill="#6b4fb0"/>';
const CHAT_ICONS = ['heart', 'friend', 'berry', 'note', 'fire', 'stones', 'idea'];

const HOBBY_KINDS = {
  'stacking stones': ['stones', 'boulder'], 'collecting shiny things': ['gift', 'curio', 'clay'],
  'chasing bugs': ['bush', 'tree'], 'sniffing flowers': ['bush', 'sprout'], 'poking puddles': ['pond', 'fish']
};

function rand(a, b) { return a + Math.random() * (b - a); }
function zonePoint(zone) {
  const z = ZONES[zone];
  const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.75;
  return { x: z.cx + Math.cos(a) * z.rx * d, y: z.cy + 6 + Math.sin(a) * z.ry * d * 0.8 };
}

export class Puppets {
  constructor() { this.p = new Map(); this.last = 0; this.sortAt = 0; this.taught = []; }

  // Called after every redraw with the fresh render state.
  sync(rs) {
    this.rs = rs;
    const ids = new Set(rs.wobblins.map(w => w.id));
    for (const id of [...this.p.keys()]) if (!ids.has(id)) this.p.delete(id);
    const now = performance.now();
    for (const w of rs.wobblins) {
      let p = this.p.get(w.id);
      if (!p) {
        p = { id: w.id, x: w.x, y: w.y, tx: w.x, ty: w.y, face: Math.random() < 0.5 ? 1 : -1, zone: w.zone, activity: w.activity, idleUntil: 0, arrived: false };
        this.p.set(w.id, p);
        p.w = w;
        this.retarget(p, now);
      }
      p.w = w;
      if (p.placed) {                          // just set down by the Keeper: stay a moment
        p.placed = false; p.zone = w.zone; p.activity = w.activity;
        this.retarget(p, now, true);
      } else if (p.zone !== w.zone || p.activity !== w.activity) {
        p.zone = w.zone; p.activity = w.activity;
        this.retarget(p, now);
      }
    }
  }

  pin(id, on) { const p = this.p.get(id); if (p) p.pinned = on; }

  // Scurry off a little way (UI only: poked one time too many).
  flee(id) {
    const p = this.p.get(id);
    if (!p) return;
    const z = ZONES[p.zone] || ZONES.meadow;
    const dir = p.x < z.cx ? 1 : -1;
    p.tx = Math.max(z.cx - z.rx * 0.8, Math.min(z.cx + z.rx * 0.8, p.x + dir * rand(90, 150)));
    p.ty = Math.max(z.cy - z.ry * 0.5, Math.min(z.cy + z.ry * 0.6, p.y + rand(-20, 20)));
    p.ax = p.tx; p.ay = p.ty; p.arrived = false; p.idleUntil = performance.now() + 6000;
    p.face = dir;
  }

  // The Keeper put it down at (x, y).
  place(id, x, y) {
    const p = this.p.get(id);
    if (!p) return;
    p.x = p.tx = x; p.y = p.ty = y; p.pinned = false; p.placed = true;
  }

  position(id) { const p = this.p.get(id); return p ? { x: p.x, y: p.y } : null; }

  // Note who taught whom this tick, so they can be seen "talking" about it.
  noteTeaching(pairs) { this.taught = pairs; }

  anchor(p) {
    const w = p.w, rs = this.rs;
    const objs = rs.objects.filter(o => o.zone === w.zone);
    const nearest = kinds => objs.filter(o => kinds.includes(o.kind)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    const beside = (o, d = 26) => ({ x: o.x + (Math.random() < 0.5 ? -d : d) + rand(-6, 6), y: o.y + rand(2, 10) });
    let o;
    switch (w.activity) {
      case 'forage': o = nearest(['bush', 'garden', 'sprout', 'fish', 'tree']); if (o) return { ...beside(o), act: 'eat', wander: 30 }; break;
      case 'warm': o = nearest(['fire', 'hearth']); if (o) return { ...beside(o, 34), act: 'warm', wander: 0 };
        o = nearest(['hut']); if (o) return { ...beside(o, 30), act: 'huddle', wander: 0 };
        { const mates = [...this.p.values()].filter(q => q !== p && q.zone === w.zone); if (mates.length) return { x: mates[0].tx + rand(-26, 26), y: mates[0].ty + rand(-4, 4), act: 'huddle', wander: 0 }; }
        break;
      case 'rest': o = nearest(['hut']); if (o) return { x: o.x + rand(-14, 14), y: o.y + 14, act: 'sleep', wander: 0 }; return { ...zonePoint(w.zone), act: 'sleep', wander: 0 };
      case 'inspect': o = objs.filter(x => x.keeper && x.age <= 24).sort((a, b) => a.age - b.age)[0] || nearest(objs.map(x => x.kind)); if (o) return { ...beside(o, 30), act: 'inspect', wander: 20 }; break;
      case 'hobby': {
        const kinds = HOBBY_KINDS[w.hobby];
        o = kinds && nearest(kinds); if (o) return { ...beside(o), act: w.hobby === 'stacking stones' ? 'stack' : 'play', wander: 40 };
        if (w.hobby === 'humming') { const mates = [...this.p.values()].filter(q => q !== p && q.zone === w.zone); if (mates.length) return { x: mates[0].tx + rand(-36, 36), y: mates[0].ty, act: 'sing', wander: 20 }; }
        return { ...zonePoint(w.zone), act: w.hobby === 'napping in sun' ? 'sleep' : w.hobby === 'watching clouds' ? 'gaze' : 'play', wander: 60 };
      }
      case 'play': {
        const parent = [...this.p.values()].find(q => q.zone === w.zone && q !== p);
        if (parent) return { x: parent.tx + rand(-30, 30), y: parent.ty + rand(4, 12), act: 'play', wander: 40 };
      }
    }
    // Nothing in particular to go to: graze, look around, potter about.
    return { ...zonePoint(w.zone), act: w.activity === 'forage' ? 'eat' : w.activity === 'warm' ? 'huddle' : 'idle', wander: 70 };
  }

  retarget(p, now, stay = false) {
    const a = this.anchor(p);
    p.ax = a.x; p.ay = a.y; p.act = a.act; p.wanderR = a.wander;
    if (stay) { p.tx = p.x; p.ty = p.y; p.idleUntil = now + 2500; p.arrived = true; return; }
    p.tx = a.x; p.ty = a.y; p.arrived = false;
  }

  step(now) {
    const dt = Math.min(0.08, (now - (this.last || now)) / 1000);
    this.last = now;
    for (const p of this.p.values()) {
      if (p.pinned) continue;
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d > 2) {
        const v = (d > 220 || p.chase ? RUN * 0.8 : WALK) * dt;
        p.x += dx / d * Math.min(v, d); p.y += dy / d * Math.min(v, d);
        if (Math.abs(dx) > 1) p.face = dx > 0 ? 1 : -1;
        p.walking = true;
      } else {
        p.walking = false;
        if (!p.arrived) { p.arrived = true; p.idleUntil = now + rand(2500, 7000); }
        if (now > p.idleUntil && p.wanderR > 0) {
          // Potter about near what they're doing.
          p.tx = p.ax + rand(-p.wanderR, p.wanderR); p.ty = p.ay + rand(-p.wanderR * 0.3, p.wanderR * 0.3);
          p.arrived = false;
        }
      }
      if (p.chat && now > p.chat.until) p.chat = null;
    }
    this.separate(dt);
    this.chatter(now);
    this.play(now);
  }

  // Soft personal space, so a crowd spreads out instead of stacking up.
  separate(dt) {
    const ps = [...this.p.values()].filter(p => !p.pinned);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      const dx = b.x - a.x, dy = (b.y - a.y) * 1.6, d = Math.hypot(dx, dy) || 0.01;
      // Sized to the drawn bodies, so they touch when huddling but never overlap.
      const size = (a.w ? wobblinScale(a.w) : 1.7) + (b.w ? wobblinScale(b.w) : 1.7);
      const want = size * (a.act === 'huddle' || b.act === 'huddle' ? 13 : 17);
      if (d >= want) continue;
      const push = (want - d) * Math.min(1, dt * 4) / 2;
      a.x -= dx / d * push; b.x += dx / d * push;
      a.y -= dy / d * push * 0.4; b.y += dy / d * push * 0.4;
      if (a.arrived) { a.tx = a.x; a.ty = a.y; }
      if (b.arrived) { b.tx = b.x; b.ty = b.y; }
    }
  }

  // Happy, playful ones sometimes play tag: one dashes after another, who scampers off.
  play(now) {
    for (const p of this.p.values()) if (p.chase && now > p.chase.until) { p.chase = null; p.arrived = false; p.tx = p.ax; p.ty = p.ay; }
    if (Math.random() > 0.0015) return;   // now and then, not all the time
    const ps = [...this.p.values()].filter(p => !p.pinned && !p.chase && p.w && p.w.stage !== 'elder' && (p.w.mood || 0) > 0.65 && p.act !== 'sleep');
    if (ps.length < 2) return;
    const a = ps[Math.floor(Math.random() * ps.length)];
    const b = ps.filter(q => q !== a && Math.hypot(q.x - a.x, q.y - a.y) < 220).sort((x, y) => Math.hypot(x.x - a.x, x.y - a.y) - Math.hypot(y.x - a.x, y.y - a.y))[0];
    if (!b) return;
    const z = ZONES[b.zone] || ZONES.meadow;
    const away = b.x < a.x ? -1 : 1;
    b.chase = { until: now + 2600 }; a.chase = { until: now + 2600 };
    b.tx = Math.max(z.cx - z.rx * 0.85, Math.min(z.cx + z.rx * 0.85, b.x + away * rand(80, 140))); b.ty = b.y + rand(-15, 15); b.arrived = false; b.face = away;
    a.tx = b.tx - away * 30; a.ty = b.ty; a.arrived = false; a.face = away;
    a.chat = { icon: 'heart', until: now + 1400 };
  }

  // Friends nearby chat in little picture bubbles; teachers "explain" ideas.
  chatter(now) {
    const ps = [...this.p.values()].filter(p => !p.walking && !p.pinned && p.act !== 'sleep');
    for (const [a, b] of this.taught) {
      const pa = this.p.get(a), pb = this.p.get(b);
      if (pa && pb && !pa.chat && Math.random() < 0.02) {
        pa.chat = { icon: 'idea', until: now + 2200 };
        pb.reply = { icon: 'idea', at: now + 1100 };
      }
    }
    for (const p of ps) {
      if (p.reply && now > p.reply.at) { p.chat = { icon: p.reply.icon, until: now + 2000 }; p.reply = null; }
      if (p.chat || Math.random() > 0.004) continue;
      const friend = ps.find(q => q !== p && !q.chat && Math.hypot(q.x - p.x, q.y - p.y) < 80);
      if (!friend) continue;
      const icon = CHAT_ICONS[Math.floor(Math.random() * CHAT_ICONS.length)];
      p.chat = { icon, until: now + 2200 };
      friend.reply = { icon: Math.random() < 0.6 ? icon : 'heart', at: now + 1200 };
      p.face = friend.x > p.x ? 1 : -1; friend.face = -p.face;
    }
  }

  // Write positions and pose classes onto the SVG.
  apply(svg, now) {
    for (const p of this.p.values()) {
      if (p.pinned) continue;
      const g = svg.querySelector('#' + p.id);
      if (!g || !p.w) continue;
      const s = wobblinScale(p.w);
      g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${s})`);
      const flip = g.querySelector('.flip');
      const want = p.face < 0 ? 'scale(-1,1)' : '';
      if (flip && flip.getAttribute('transform') !== want) flip.setAttribute('transform', want);
      const doing = p.walking ? 'walking' : p.arrived ? 'doing-' + p.act : '';
      if (g.dataset.doing !== doing) {
        if (g.dataset.doing) g.classList.remove(g.dataset.doing);
        if (doing) g.classList.add(doing);
        g.dataset.doing = doing;
        g.querySelector('.zzz')?.remove();
        if (doing === 'doing-sleep') g.insertAdjacentHTML('beforeend', '<g class="zzz" transform="translate(16 -52)"><text x="0" y="0">z</text><text x="7" y="-9">z</text><text x="14" y="-20">Z</text></g>');
      }
      // Speech bubbles (counter-flipped so icons read the right way).
      const has = g.querySelector('.chat');
      if (p.chat && !has) {
        const icon = p.chat.icon === 'note' ? NOTE : ITEM_ICONS[p.chat.icon] || ITEM_ICONS.idea;
        g.insertAdjacentHTML('beforeend', `<g class="chat" transform="translate(-20 -64)"><path d="M-13 -11 h26 a5 5 0 0 1 5 5 v12 a5 5 0 0 1 -5 5 h-12 l-5 6 v-6 h-9 a5 5 0 0 1 -5 -5 v-12 a5 5 0 0 1 5 -5 Z" fill="#fff" stroke="#c9c2b0"/><g transform="translate(0 0.5)">${icon}</g></g>`);
      } else if (!p.chat && has) has.remove();
    }
    // Keep depth order right as they walk past each other.
    if (now - this.sortAt > 400) {
      this.sortAt = now;
      const layer = svg.querySelector('#layer-wobblins');
      if (layer) {
        const cur = [...layer.children];
        const kids = cur.slice().sort((a, b) => (this.p.get(a.id)?.y ?? 0) - (this.p.get(b.id)?.y ?? 0));
        if (kids.some((k, i) => k !== cur[i]) && !kids.some(k => this.p.get(k.id)?.pinned)) for (const k of kids) layer.append(k);
      }
    }
  }
}
