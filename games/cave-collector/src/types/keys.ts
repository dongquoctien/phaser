// Single source of truth for all string keys. Never use raw string literals
// for scene names, texture keys, or animation keys anywhere else in the game.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
  Hud: 'HudScene',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

// Texture keys. These are baked procedurally at boot (placeholder pixel art)
// in systems/textures.ts — swap for a packed atlas later without touching the
// gameplay code, since everything references these constants.
export const Tex = {
  Hero: 'hero', // 16x24, faces right
  Robot: 'robot', // 16x16 sentry
  Shuriken: 'shuriken', // 12x12 spinning hazard
  Block: 'block', // 16x16 ? item block
  BlockUsed: 'block-used', // 16x16 emptied block
  Star: 'star', // 10x10 collectible
  Coin: 'coin', // 8x8 small collectible
  Door: 'door', // 20x28 level exit
  TileGround: 'tile-ground', // 16x16 magenta platform tile
  Spark: 'spark', // 3x3 particle
  Flower: 'flower', // 7x7 hair-flower HUD/heart icon stand-in
  Heart: 'heart', // 9x8 life icon
} as const;

// Animation keys.
export const Anim = {
  HeroIdle: 'hero-idle',
  HeroRun: 'hero-run',
  HeroJump: 'hero-jump',
  ShurikenSpin: 'shuriken-spin',
  RobotIdle: 'robot-idle',
  StarSpin: 'star-spin',
  CoinSpin: 'coin-spin',
} as const;

// Registry keys (RAM-only; mirror to localStorage for persistence).
export const Reg = {
  Score: 'score',
  Stars: 'stars',
  Lives: 'lives',
  Best: 'cc-best', // localStorage key for high score
} as const;

// Game events emitted on the GameScene's event emitter for the HUD to read.
export const Ev = {
  ScoreChanged: 'score-changed',
  StarsChanged: 'stars-changed',
  LivesChanged: 'lives-changed',
  LevelCleared: 'level-cleared',
  GameOver: 'game-over',
} as const;
