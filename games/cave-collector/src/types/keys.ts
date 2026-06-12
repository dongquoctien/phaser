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

// Texture keys. Loaded from sliced atlases (public/assets/<key>.png+.json,
// produced by scripts/cut-g1.mjs from the g1 art). Gameplay code only ever
// references these constants, so the art source can change without touching it.
export const Tex = {
  Hero: 'hero', // 48px atlas: idle0-3, run4-9, jump10-12, punch13-15
  Robot: 'bot', // 32px sentry, 4-frame hover
  Shuriken: 'shuriken', // 24px spinning hazard, 4 frames
  Block: 'block', // 16px ? item block
  BlockUsed: 'block-used', // 16px emptied block
  Star: 'star', // 16px collectible, 6-frame spin
  Coin: 'coin', // 16px collectible, 4-frame spin
  Door: 'door', // 48px level exit
  TileTop: 'tile-top', // 16px platform surface (mossy)
  TileFill: 'tile-fill', // 16px platform body
  TilePlatform: 'tile-platform', // 16px floating platform
  Spark: 'spark', // 16px hit/poof, 3 frames
  Heart: 'heart', // 12px life icon (0=full, 1=empty)
  Crystal: 'crystal', // 16px decor
  Mushroom: 'mushroom', // 16px decor
  Parallax: 'parallax', // full cave background image
} as const;

// Animation keys.
export const Anim = {
  HeroIdle: 'hero-idle',
  HeroRun: 'hero-run',
  HeroJump: 'hero-jump',
  HeroPunch: 'hero-punch',
  ShurikenSpin: 'shuriken-spin',
  RobotIdle: 'robot-idle',
  StarSpin: 'star-spin',
  CoinSpin: 'coin-spin',
  SparkBurst: 'spark-burst',
} as const;

// Audio keys — files live in public/audio/<key>.{m4a,ogg} (dual-format; iOS
// can't decode Ogg so m4a ships too and is listed first). Sliced from g1/music.
export const Audio = {
  BgmMenu: 'bgm-menu',
  BgmGame: 'bgm-game',
  Footstep: 'footstep',
  Jump: 'jump',
  Land: 'land',
  Punch: 'punch', // bot hit / whiff
  BlockPay: 'block-pay', // ? block payout "ding"
  Star: 'star-sfx',
  Coin: 'coin-sfx',
  Hurt: 'hurt',
  BotHit: 'bot-hit',
  LevelClear: 'level-clear',
  GameOver: 'game-over',
  Select: 'select',
} as const;
export type AudioKey = (typeof Audio)[keyof typeof Audio];

// Registry keys (RAM-only; mirror to localStorage for persistence).
export const Reg = {
  Score: 'score',
  Stars: 'stars',
  Lives: 'lives',
  Best: 'cc-best', // localStorage key for high score
  Muted: 'cc-muted', // localStorage key for mute pref
} as const;

// Game events emitted on the GameScene's event emitter for the HUD to read.
export const Ev = {
  ScoreChanged: 'score-changed',
  StarsChanged: 'stars-changed',
  LivesChanged: 'lives-changed',
  LevelCleared: 'level-cleared',
  GameOver: 'game-over',
} as const;
