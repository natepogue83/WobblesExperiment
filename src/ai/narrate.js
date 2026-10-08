// narrate.js — AI hook. Week 1 STUB: template lines only, source "template".
// Week 2 replaces the body with a grounded model call (CONTRACT.md section 10)
// and keeps these templates as the fallback.

const NAMES = {
  keeper_power: e => 'You used ' + (e.data.power === 'stone' ? 'Drop Stone' : e.data.power) + '.',
  keeper_nudge: e => 'You blessed a Wobblin with ' + e.data.trait + '.',
  keeper_gift: e => 'You left a gift: ' + String(e.data.giftId).replace(/_/g, ' ') + '.',
  became_elder: () => 'A Wobblin grew old and wise.',
  colony_founded: e => e.data.colonyName + ' was founded.'
};

export async function narrateRecap({ world, events }) {
  const lines = [];
  for (const e of events.slice().sort((a, b) => b.salience - a.salience || b.t - a.t).slice(0, 7)) {
    const f = NAMES[e.kind];
    if (f) lines.push({ text: f(e, world), eventIds: [e.id] });
  }
  if (!lines.length) lines.push({ text: 'A quiet stretch. Everyone ate, napped, and hummed.', eventIds: [] });
  return { lines, source: 'template' };
}

export async function namePersonality(wobblin) {
  return { name: wobblin.name, quirk: 'loves ' + wobblin.hobby, source: 'template' };
}
