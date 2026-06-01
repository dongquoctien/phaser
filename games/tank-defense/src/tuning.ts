// Pure data — NO imports — so it can never form an import cycle.

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

// Grid map. The play field is GRID_COLS × GRID_ROWS cells of CELL px. Enemies
// walk a fixed waypoint path along PATH cells; towers go on buildable grass cells.
export const CELL = 48;
export const GRID_COLS = 10; // 10 * 48 = 480
export const GRID_ROWS = 13; // 13 * 48 = 624 → field; the rest is HUD
export const FIELD_H = GRID_ROWS * CELL; // 624
export const HUD_TOP = FIELD_H; // HUD strip starts here (624..800 = 176px)

export const Tuning = {
  startMoney: 220,
  startLives: 20,
  bountyBase: 8, // money per kill (scaled by enemy tier)

  // Wave spawning
  spawnInterval: 700, // ms between enemies in a wave
  waveCount: 20,
  enemyHpPerWave: 0.22, // +22% enemy hp per wave (geometric)
  enemyCountBase: 6,
  enemyCountPerWave: 1.5,

  // Enemy movement
  enemySpeed: 60, // px/s (light); per-type multiplier in roster

  // Projectiles
  projectileSpeed: 360,
  poolBullets: 80,
  poolEnemies: 120,
} as const;
