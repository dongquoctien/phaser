// Single source of truth for all string keys. Never use raw string literals
// for scene names, texture keys, or animation keys anywhere else in the game.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Game: 'GameScene', // the overworld
  Battle: 'BattleScene', // turn-based combat (stub for now; built in a later PR)
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

// Ground/decor tiles (reused from twdc-defense's meadow art — same pixel style).
export const TileKeys = {
  Grass0: 'grass0', Grass1: 'grass1', Grass2: 'grass2', Grass3: 'grass3', Grass4: 'grass4',
  Dirt: 'dirt',
  // decor (transparent, drawn on top of grass)
  Flowers: 'flowers', Bush: 'bush', Mushroom: 'mushroom', Log: 'log',
  TreeRound: 'tree_round', TreePine: 'tree_pine', TreeSmall1: 'tree_small1', TreeSmall2: 'tree_small2',
  RockBig1: 'rock_big1', RockMed1: 'rock_med1',
} as const;
export type TileKey = (typeof TileKeys)[keyof typeof TileKeys];

export const GRASS_VARIANTS = [
  TileKeys.Grass0, TileKeys.Grass1, TileKeys.Grass2, TileKeys.Grass3, TileKeys.Grass4,
] as const;

// Characters.
export const CharKeys = {
  // party heroes (static single-frame pixel sprites — front-facing)
  Rem: 'hero-rem',
  Hollis: 'hero-hollis',
  Moz: 'hero-moz',
  // roaming mob spritesheet (6×6 grid of 118×141 frames; we use a few as a walk cycle)
  MobWalker: 'mob-walker',
} as const;
export type CharKey = (typeof CharKeys)[keyof typeof CharKeys];

export const AnimKeys = {
  MobWalk: 'mob-walk',
} as const;

export const AudioKeys = {
  // none yet — overworld is silent for the first pass (sound added in a later PR)
} as const;
