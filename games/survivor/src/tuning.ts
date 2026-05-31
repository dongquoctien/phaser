// Pure data — no imports — so it can't create an import cycle. Everything else
// (config, objects, systems) imports Tuning/dimensions from HERE, not config.ts.

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

export const Tuning = {
  // Hero
  heroSpeed: 175,
  heroMaxHp: 100,
  heroPickupRadius: 56,
  heroHitIFrames: 700,
  heroRadius: 14,
  // Default weapon (Bolt)
  fireInterval: 420,
  bulletSpeed: 440,
  bulletDamage: 12,
  bulletLifetime: 1100,
  bulletRadius: 6,
  projectileCount: 1,
  // Enemies
  enemyWalkerSpeed: 52,
  enemyWalkerHp: 22,
  enemyWalkerRadius: 16,
  enemyRunnerSpeed: 104,
  enemyRunnerHp: 12,
  enemyRunnerRadius: 13,
  enemyContactDamage: 9,
  enemySeparation: 0.5,
  // Boss
  bossHp: 1400,
  bossSpeed: 38,
  bossRadius: 40,
  bossContactDamage: 22,
  bossFirstSpawn: 45,
  bossInterval: 60,
  // Spawn director
  spawnInterval: 620,
  spawnIntervalMin: 170,
  spawnRingRadius: 380,
  spawnBatch: 3,
  enemyHpScalePer30s: 0.22,
  runnerUnlockSec: 20,
  // XP / leveling
  gemValue: 5,
  gemPickupRadius: 14,
  xpBase: 18,
  xpGrowth: 1.34,
  // Pools
  poolEnemies: 500,
  poolBullets: 300,
  poolGems: 400,
  poolEquip: 16,
  // Equipment drops
  equipDropChance: 0.04, // per non-boss kill; bosses always drop
  // Broad-phase
  hashCellSize: 28,
} as const;
