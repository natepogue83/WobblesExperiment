// keeper.js — what the Wobblins call you, from what you have actually done
// lately (the event log): the Rainmaker, the Thrower, the Gentle Hand... and
// whether they say it fondly or nervously. Pure; UI only.

const RECENT = 120;   // days of memory for a reputation

export function keeperTitle(world) {
  const from = world.tick - RECENT;
  const count = {};
  let love = 0, fear = 0, acts = 0;
  const add = (k, n = 1) => { count[k] = (count[k] || 0) + n; };
  for (let i = world.events.length - 1; i >= 0; i--) {
    const e = world.events[i];
    if (e.t < from) break;
    if (e.kind !== 'keeper_power' && e.kind !== 'keeper_nudge' && e.kind !== 'keeper_gift') continue;
    const d = e.data || {};
    acts++;
    for (const r of Object.values(d.reactions || {})) { if (r === 'love' || r === 'like') love++; else if (r === 'scared' || r === 'upset') fear++; }
    if (e.kind === 'keeper_gift') { add('generous', 2); continue; }
    if (d.onto) add(d.power === 'plant' ? 'flowers' : d.power === 'lightning' ? 'storm' : 'bonker', 2);
    switch (d.power || d.nudge) {
      case 'rain': add('rain'); break;
      case 'lightning': add('storm'); break;
      case 'plant': add('garden'); break;
      case 'stone': add('builder'); break;
      case 'quake': add('shaker', 2); break;
      case 'water': add('water'); break;
      case 'season': add(d.variant === 'cold' ? 'frost' : 'sun'); break;
      case 'bless': case 'miracle': add('generous'); break;
      case 'carry': add(d.thrown ? 'thrower' : d.cradled ? 'gentle' : d.shaken ? 'shaker' : 'mover', d.thrown || d.cradled || d.shaken ? 2 : 1); break;
      case 'rename': add('namer'); break;
    }
  }
  if (acts < 4) return null;
  const NAMES = { rain: 'the Rainmaker', storm: 'the Storm-Bringer', garden: 'the Gardener', builder: 'the Stone-Giver', shaker: 'the Shaker',
    water: 'the River-Bender', frost: 'the Frost-Bringer', sun: 'the Sun-Bringer', generous: 'the Generous', thrower: 'the Thrower',
    gentle: 'the Gentle Hand', mover: 'the Big Hand', bonker: 'the Bonker', flowers: 'the Flower-Giver', namer: 'the Namer' };
  const top = Object.entries(count).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  if (!top) return null;
  const tone = love > fear * 2 ? 'fond' : fear > love ? 'wary' : 'plain';
  return { name: NAMES[top[0]], tone };
}
