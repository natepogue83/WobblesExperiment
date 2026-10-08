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
  coldTicks: 4,
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

export const EXPERIMENT = {
  base: { 1: 0.04, 2: 0.02, 3: 0.01, 4: 0.005 },
  successBase: { 1: 0.6, 2: 0.45, 3: 0.35, 4: 0.3 },
  pAttemptCap: 0.35,
  colonyCapPerTick: 2,
  babyRate: 0.2,
  ponderAfter: 12
};

export const MEMORY_LEN = 12;
