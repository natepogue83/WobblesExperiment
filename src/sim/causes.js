// causes.js — cause-chain helpers.
// A cause is { action: seq } | { event: id } | { object: id } | { condition, action?, event? }.
// keeperRoot walks the chain breadth-first to the nearest Keeper action.

function eventById(world, id) {
  // Event ids are 1-based and dense, so this is a direct index.
  const e = world.events[id - 1];
  return e && e.id === id ? e : world.events.find(x => x.id === id) || null;
}

function objectById(world, id) { return world.objects.find(o => o.id === id) || null; }

// Returns { action, path } for the nearest Keeper action, or null.
export function keeperRoot(world, event, maxDepth = 4) {
  let frontier = [{ causes: event.causes, path: [{ event: event.id }] }];
  const seen = new Set();
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const c of node.causes) {
        const key = JSON.stringify(c);
        if (seen.has(key)) continue;
        seen.add(key);
        const path = node.path.concat([c]);
        if (c.action !== undefined) return { action: c.action, path };
        if (c.event !== undefined) {
          const e = eventById(world, c.event);
          if (e) next.push({ causes: e.causes, path });
        } else if (c.object !== undefined) {
          const o = objectById(world, c.object);
          if (o) next.push({ causes: [o.origin.natural ? null : o.origin].filter(Boolean), path });
        }
      }
    }
    frontier = next;
  }
  return null;
}

export { eventById };
