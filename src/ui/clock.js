// clock.js — the only place real time touches the game.
//
// Two speeds: while you watch, a colony day (one tick) passes every
// WATCH_TICK_MS; while you are away, one per TICK_MS (an hour). The save keeps
// an anchor { anchorMs, anchorTick, mode, beatMs }; the sim only ever sees the
// resulting integer tick, so determinism and replay are untouched.
// A heartbeat (beatMs) guards against a crashed tab being counted as watched.
import { TICK_MS } from '../sim/constants.js';

export const WATCH_TICK_MS = 60_000;
const STALE_MS = 30_000;          // no heartbeat for this long = you were away

function rawTick(save, nowMs) {
  const c = save.clock;
  if (!c) return Math.floor((nowMs - save.createdAt) / TICK_MS);
  if (c.mode !== 'watch') return c.anchorTick + Math.floor((nowMs - c.anchorMs) / TICK_MS);
  const beat = Math.max(c.anchorMs, Math.min(nowMs, c.beatMs ?? c.anchorMs));
  if (nowMs - beat <= STALE_MS) return c.anchorTick + Math.floor((nowMs - c.anchorMs) / WATCH_TICK_MS);
  // The tab went quiet: watched until the last heartbeat, away after it.
  return c.anchorTick + Math.floor((beat - c.anchorMs) / WATCH_TICK_MS) + Math.floor((nowMs - beat) / TICK_MS);
}

export function nowTickFor(save, nowMs, offsetTicks = 0) {
  return Math.max(0, rawTick(save, nowMs) + offsetTicks);
}

// Switch speed at nowMs, keeping the current tick.
export function setClockMode(save, mode, nowMs) {
  const t = Math.max(0, rawTick(save, nowMs));
  save.clock = { anchorMs: nowMs, anchorTick: t, mode, beatMs: nowMs };
}

export function heartbeat(save, nowMs) {
  if (save.clock && save.clock.mode === 'watch') save.clock.beatMs = nowMs;
}

// ms until the next colony day at the current speed.
export function msToNextTick(save, nowMs) {
  const c = save.clock;
  if (!c) return TICK_MS - ((nowMs - save.createdAt) % TICK_MS);
  const rate = c.mode === 'watch' ? WATCH_TICK_MS : TICK_MS;
  return rate - ((nowMs - c.anchorMs) % rate);
}

export function tickLengthMs(save) {
  return save.clock && save.clock.mode === 'watch' ? WATCH_TICK_MS : TICK_MS;
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
