// Single source of truth for all string keys.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

// Pixel-art (Sweetie-16, 24×24 sprites) baked via src/pixel. One key per art piece.
export const TextureKeys = {
  // Tiles
  Grass: 'grass',
  Path: 'path',
  Tree: 'tree',
  Barrel: 'barrel',
  Buildable: 'buildable', // highlight for an empty buildable cell
  // Tower bases + rotating turrets (turret drawn separately so it can rotate)
  BaseGun: 'base-gun',
  BaseCannon: 'base-cannon',
  BaseMissile: 'base-missile',
  TurretGun: 'turret-gun',
  TurretCannon: 'turret-cannon',
  TurretMissile: 'turret-missile',
  // Enemy tanks
  EnemyLight: 'enemy-light',
  EnemyMedium: 'enemy-medium',
  EnemyHeavy: 'enemy-heavy',
  // FX / props
  Bullet: 'bullet',
  Shell: 'shell',
  Missile: 'missile',
  Explosion: 'explosion',
} as const;
export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

export const AudioKeys = {
  Shoot: 'shoot',
  Hit: 'hit',
  Explode: 'explode',
  Place: 'place',
  Lose: 'lose',
  Click: 'click',
} as const;
export type AudioKey = (typeof AudioKeys)[keyof typeof AudioKeys];

export const RegistryKeys = {
  BestWave: 'bestWave',
  Muted: 'muted',
} as const;
