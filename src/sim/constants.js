// constants.js — every tunable number lives here. All are starting guesses.

export const TICK_MS = 3_600_000;           // 1 tick = 1 real hour = 1 colony day
export const WORLD_VERSION = 2;

export const START_WOBBLINS = 3;
export const POP_CAP = 8;

export const LIFE = {
  babyUntil: 12,                // ticks of age
  elderAt: 0.7,                 // fraction of lifespan
  lifespanMin: 150,
  lifespanMax: 220,
  starveTicks: 6,
  coldTicks: 5,
  seedPodDelay: 24
};

// Cooldowns in ticks. Value stored in world.cooldowns is the first usable tick.
export const COOLDOWN = {
  stone: 2, plant: 3, rain: 3, lightning: 8, water: 12, season: 24,
  bless: 4, curio: 6, miracle: 12
};

export const COST = { season: 10, miracle: 20 };   // Devotion

export const POWER = {
  rainTicks: 2,
  wetTicks: 6,                  // soft mud lasts this long after rain
  floodUses: 3, floodWindow: 6,
  sproutGrowTicks: 6,
  seasonTicks: 24,
  blessAdd: 0.3, blessTicks: 24,
  curioTicks: 6,
  miracleTicks: 6
};

export const NATURE = {
  rainChance: 0.06,             // per tick, when not already raining
  coldNightChance: 0.25,
  dryLightningChance: 0.004,
  prowlerChance: 0.03,          // per tick once population >= prowlerPop
  prowlerPop: 5
};

// Per-tick need changes (1 tick = 1 colony day).
export const NEEDS = {
  foodDecay: 0.08,
  forage: { meadow: 0.2, riverbank: 0.16, grove: 0.14, hollow: 0.08, hill: 0.07, pondsite: 0.08 },
  bushFood: 0.12,               // per bush in zone, before Foraging is known
  warmthDrift: 0.15,            // toward 0.75 on a mild day
  coldNight: 0.26,
  rainChill: 0.08,
  shelter: 0.08,                // resting in the sheltered hollow
  huddle: 0.08,                 // per other Wobblin resting in the same zone (max 3)
  fireWarm: 0.15,               // fire in or next to the zone, before Fire Warmth
  restDecay: 0.12,
  restGain: 0.4,
  moodDrift: 0.05,              // toward 0.6
  hobbyMood: 0.08,
  socialMood: 0.03,
  safetyDrift: 0.1,             // toward 0.85
  prowlerFear: 0.5,
  hungry: 0.4, cold: 0.35, tired: 0.3   // thresholds that drive activity
};

export const SOCIAL = {
  pairChance: 0.08, pairSociability: 0.4, pairSociabilityMin: 0.25, pairMood: 0.5,
  birthChance: 0.08, birthFood: 0.3, birthGap: 20,
  injuryDeath: 3, healEvery: 16,
  strangerChance: 0.015, hutBuildChance: 0.06,
  curiosityPull: 24             // Keeper objects this new pull Wobblins over
};

export const FIRE = { burnMin: 3, burnMax: 6, spreadChance: 0.15 };

export const CLIMATE = { driftPeriod: 240, driftAmp: 0.08 };

export const EXPERIMENT = {
  base: { 1: 0.05, 2: 0.035, 3: 0.025, 4: 0.015 },
  successBase: { 1: 0.6, 2: 0.5, 3: 0.45, 4: 0.4 },
  pAttemptCap: 0.35,
  colonyCapPerTick: 2,
  babyRate: 0.2,
  ponderAfter: 12
};

export const TEACH = { base: { 1: 0.12, 2: 0.08, 3: 0.05, 4: 0.04 } };

export const MEMORY_LEN = 12;
