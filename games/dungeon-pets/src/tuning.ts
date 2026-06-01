// Pure data — NO imports — so it can never form an import cycle.

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

export const Tuning = {
  // Combat — the hero shoots projectiles; skills modify HOW it shoots.
  baseAttackInterval: 620, // ms between volleys (lowered by haste skills)
  baseProjectileSpeed: 560, // px/s
  petAttackInterval: 900, // pets fire slower + weaker
  petDamageMul: 0.45,

  roundsPerFloor: 5, // waves to clear a floor
  recruitEveryFloors: 5, // a pet joins every N floors
  maxPets: 3,

  // Base hero stats (archetype multipliers live in types/roster)
  heroBaseHp: 1400,
  heroBaseAtk: 120,
  heroBaseDef: 20,

  // Enemy scaling — idle-style geometric growth → big numbers like the ref.
  enemyBaseHp: 260,
  enemyBaseAtk: 42,
  enemyHpPerFloor: 0.33, // ×1.33 hp per floor
  enemyAtkPerFloor: 0.22,
  enemySpeed: 26, // px/s advance toward the hero
  enemyContactRange: 54, // melee when this close to the hero line
  telegraphMs: 280, // §4: enemy melee wind-up before the strike lands
  enemiesPerRoundMin: 3,
  enemiesPerRoundMax: 5,
  bossEveryFloors: 5,

  // Leveling
  xpPerKill: 10,
  xpBase: 36,
  xpGrowth: 1.32,

  // Layout
  heroX: 96, // hero anchored on the left
  heroY: 380,
  spawnX: 470, // enemies spawn off the right edge and advance left
  laneTop: 250,
  laneBottom: 500,

  // Pools
  poolProjectiles: 80,
} as const;
