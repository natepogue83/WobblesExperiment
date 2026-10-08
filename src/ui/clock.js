// clock.js — the only place real time touches the game.
import { TICK_MS } from '../sim/constants.js';

export function nowTickFor(save, nowMs, offsetTicks = 0) {
  return Math.max(0, Math.floor((nowMs - save.createdAt) / TICK_MS) + offsetTicks);
}

// ms until the real clock crosses the next tick boundary.
export function msToNextTick(save, nowMs) {
  const into = (nowMs - save.createdAt) % TICK_MS;
  return TICK_MS - into;
}

// Real-world day index from the local calendar (gift once per real day).
export function localDayIndex(nowMs) {
  const d = new Date(nowMs);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export function localHour(nowMs) {
  const d = new Date(nowMs);
  return d.getHours() + d.getMinutes() / 60;
}
