// Pure data — NO imports — so it can never form an import cycle. config/objects/
// systems import dimensions + Tuning from HERE, not from config.ts.

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

export const Tuning = {
  // Battle cadence (auto-battle — no per-tap input)
  attackInterval: 850, // ms between a unit's auto-attacks (scaled by haste)
  roundsPerFloor: 8, // clear this many enemy waves to advance a floor
  recruitEveryFloors: 5, // a new pet hero joins every N floors cleared

  // Team
  teamSize: 3, // heroes chosen at the start
  maxTeam: 8, // hard cap once pets join

  // Base hero stats (per archetype multipliers live in types/roster)
  heroBaseHp: 1200,
  heroBaseAtk: 95,
  heroBaseDef: 18,

  // Enemy scaling
  enemyBaseHp: 320,
  enemyBaseAtk: 60,
  enemyHpPerFloor: 0.28, // +28% hp per floor
  enemyAtkPerFloor: 0.2,
  enemiesPerRoundMin: 2,
  enemiesPerRoundMax: 4,
  bossEveryFloors: 5, // floor multiple spawns a boss wave

  // Leveling
  xpPerKill: 12,
  xpBase: 40,
  xpGrowth: 1.35,

  // Layout (battlefield band)
  heroLineX: 150, // heroes cluster on the left
  enemyLineX: 360, // enemies on the right
  laneTop: 250,
  laneBottom: 470,
} as const;
