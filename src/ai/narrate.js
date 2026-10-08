// narrate.js — AI hook. Week 1 STUB: returns the template lines, source "template".
// Week 2 replaces the body with a grounded model call (CONTRACT.md section 10):
// the model sees only recapInput, every line must cite eventIds from it, a
// validator rejects anything ungrounded, and rejected lines fall back to these.

// recapInput comes from buildRecapInput(world, fromTick, toTick) in src/sim/recap.js.
export async function narrateRecap(recapInput) {
  return {
    header: recapInput.header,
    lines: recapInput.templateLines.slice(0, 7).map(l => ({ text: l.text.slice(0, 280), eventIds: l.eventIds })),
    source: 'template'
  };
}

// Week 1: the seeded name and a quirk from the hobby. Week 2: an AI name and
// one-line personality at birth, cached in the save so replay stays stable.
export async function namePersonality(wobblin) {
  return { name: wobblin.name, quirk: 'loves ' + wobblin.hobby, source: 'template' };
}
