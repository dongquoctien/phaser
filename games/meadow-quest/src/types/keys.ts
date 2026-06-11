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

// Characters — hand-drawn 32×32 pixel sprites baked from src/art.ts (Sweetie-16).
// Each has an idle frame + an attack frame. The overworld uses the idle frame;
// the leader/mob walk-bob is a code tween, the battle uses idle↔attack.
export const CharKeys = {
  // party heroes
  RemIdle: 'rem-idle', RemAttack: 'rem-attack',
  HollisIdle: 'hollis-idle', HollisAttack: 'hollis-attack',
  MozIdle: 'moz-idle', MozAttack: 'moz-attack',
  // monsters
  SnakeIdle: 'snake-idle', SnakeAttack: 'snake-attack',
  BirdIdle: 'bird-idle', BirdAttack: 'bird-attack',
  SlimeIdle: 'slime-idle', SlimeAttack: 'slime-attack',
  BeetleIdle: 'beetle-idle', BeetleAttack: 'beetle-attack',
} as const;
export type CharKey = (typeof CharKeys)[keyof typeof CharKeys];

// party overworld sprites (idle frame used as the walking sprite)
export const PARTY = [CharKeys.RemIdle, CharKeys.HollisIdle, CharKeys.MozIdle] as const;
// monsters that can roam the overworld + appear in battle
export const MONSTERS = [
  { idle: CharKeys.SnakeIdle, attack: CharKeys.SnakeAttack, name: 'Snake' },
  { idle: CharKeys.BirdIdle, attack: CharKeys.BirdAttack, name: 'Raven' },
  { idle: CharKeys.SlimeIdle, attack: CharKeys.SlimeAttack, name: 'Slime' },
  { idle: CharKeys.BeetleIdle, attack: CharKeys.BeetleAttack, name: 'Beetle' },
] as const;

export const AudioKeys = {
  // none yet — overworld is silent for the first pass (sound added in a later PR)
} as const;
