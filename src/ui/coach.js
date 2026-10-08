// coach.js — a few friendly pointers for a brand-new Keeper, then out of the
// way: drag something in, pick a Wobblin up, watch them think, claim a goal.
// Steps come from the save and world, so a reload resumes where you were.

const DONE_KEY = 'wobblins.coachDone';
let done = false;
try { done = localStorage.getItem(DONE_KEY) === '1'; } catch { /* private mode */ }

export function coachStep(save, world) {
  if (done || !save || !world || !save.progression) return null;
  if ((world.goalsClaimed || []).some(id => !id.startsWith('trick_'))) { finish(); return null; }
  if (world.tick > 72) { finish(); return null; }
  const acts = save.actions;
  const powers = acts.filter(a => a.type === 'power' || a.type === 'gift').length;
  const carries = acts.filter(a => a.type === 'nudge' && a.nudge === 'carry').length;
  const found = Object.keys(world.discoveries).length;
  if (!powers) return { id: 'drag', anchor: 'tile:stones', text: 'Drag the stones from your tray and drop them right next to a Wobblin.' };
  if (!carries) return { id: 'pickup', anchor: 'wobblin', text: 'You can pick Wobblins up, too. Grab one and set it down somewhere new. Or fling it!' };
  if (!found) return { id: 'watch', anchor: 'wobblin', text: 'Now watch. Curious ones poke at new things until they work something out. Tap one to see what it\'s thinking.' };
  return { id: 'claim', anchor: 'goal', text: 'They figured something out! Claim your milestone at the top. Their belief unlocks new powers.' };
}

export function finish() {
  done = true;
  try { localStorage.setItem(DONE_KEY, '1'); } catch { /* ignore */ }
  document.getElementById('coach')?.remove();
}

// Place the bubble near its anchor (screen coordinates).
export function drawCoach(step, anchorRect) {
  let el = document.getElementById('coach');
  if (!step || !anchorRect) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'coach';
    el.innerHTML = '<p></p><button type="button">Got it</button><i class="arrow"></i><span class="hand" aria-hidden="true"></span>';
    el.querySelector('button').onclick = () => finish();
    document.body.append(el);
  }
  if (el.dataset.step !== step.id) { el.dataset.step = step.id; el.querySelector('p').textContent = step.text; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  const w = Math.min(300, window.innerWidth - 24);
  const below = anchorRect.top < 200;            // anchors near the top get the bubble underneath
  let x = anchorRect.left + anchorRect.width / 2 - w / 2;
  x = Math.max(12, Math.min(window.innerWidth - w - 12, x));
  el.style.width = w + 'px';
  el.style.left = x + 'px';
  el.style.top = (below ? anchorRect.bottom + 14 : anchorRect.top - 14) + 'px';
  el.classList.toggle('below', below);
  el.style.setProperty('--ax', (anchorRect.left + anchorRect.width / 2 - x) + 'px');
}
