// index.js — the public sim API (CONTRACT.md section 1).
export { createWorld } from './world.js';
export { tick } from './tick.js';
export { validateAction, applyAction, giftOptions, POWERS, NUDGES, BLESS_TRAITS, CURIOS, GIFT_POOL } from './actions.js';
export { replay, sortActions } from './replay.js';
export { stateHash, stableStringify } from './util.js';
export { eventsBetween } from './events.js';
export { GOALS, AGES, goalStates, ageOf, progressOf } from './goals.js';
export * as GEO from './geometry.js';
export * as CONST from './constants.js';
