// Pure data — NO imports — so it can never form an import cycle.

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

// Grid map (Kingdom-Rush style). Zombies walk a fixed waypoint path; heroes are
// placed onto fixed PADS beside the path. CELL is the tile size; the field is
// GRID_COLS × GRID_ROWS, the rest of the height is the HUD strip.
export const CELL = 40;
export const GRID_COLS = 12; // 12 * 40 = 480
export const GRID_ROWS = 16; // 16 * 40 = 640 → field; the rest is HUD
export const FIELD_H = GRID_ROWS * CELL; // 640
export const HUD_TOP = FIELD_H; // HUD strip 640..800 (160px)

export const Tuning = {
  startGold: 260,
  startLives: 20,
  bountyBase: 28, // gold per kill (scaled by zombie tier) — ×5 then −20% (35→28)

  // Joicy quake knockback-immunity window (ms). After a slam pushes a zombie it's
  // KB/stun-immune this long, so a wall of out-of-phase Joicys can't stun-lock the
  // horde in place. ~1.2s < Joicy's 1.7s fire interval, so a lone Joicy still pushes
  // on (nearly) every slam — only rapid stacked slams get throttled.
  quakeKbImmuneMs: 1200,

  // Wave spawning
  spawnInterval: 650, // ms between zombies in a wave
  waveCount: 20,
  prepSeconds: 8, // countdown before wave 1 (time to place heroes)
  betweenSeconds: 10, // countdown between waves
  skipBonus: 15, // gold reward for skipping the countdown early
  // end-of-wave gold reward = waveRewardBase + wave × waveRewardPerWave. (×10.)
  waveRewardBase: 200,
  waveRewardPerWave: 40,
  enemyHpPerWave: 0.2, // +20% zombie hp per wave (geometric)
  enemyCountBase: 6,
  enemyCountPerWave: 1.6,

  // Zombie movement (px/s, per-type multiplier in roster)
  enemySpeed: 52,

  // Projectiles / pools
  projectileSpeed: 340,
  poolBullets: 120,
  poolEnemies: 140,
} as const;
