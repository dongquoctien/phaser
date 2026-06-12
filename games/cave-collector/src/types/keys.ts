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
  Slime: 'slime', // 32px ground hopper, 4-frame
  Bat: 'bat', // 32px flyer, 4-frame flap
  Beetle: 'beetle', // 32px spiked crawler (un-stompable), 4-frame
  Boss: 'boss', // 48px atlas: idle 0-3, windup 4-6, attack 7-9
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

// UI icon textures — pixelarticons (MIT), baked to 24px PNGs by
// scripts/bake-icons.mjs into public/assets/icons/. White fill; tint per use.
// NO color-emoji glyphs as icons (phaser-ui-ux §8).
export const Icon = {
  Menu: 'ic-menu',
  Edit: 'ic-edit',
  VolumeOn: 'ic-volume-on',
  VolumeOff: 'ic-volume-off',
  Trophy: 'ic-trophy',
  Close: 'ic-close',
  ArrowLeft: 'ic-arrow-left',
  ArrowRight: 'ic-arrow-right',
  ArrowUp: 'ic-arrow-up',
} as const;
export type IconKey = (typeof Icon)[keyof typeof Icon];

// Maps icon texture key -> on-disk filename stem in public/assets/icons/.
export const ICON_FILES: Record<IconKey, string> = {
  [Icon.Menu]: 'menu',
  [Icon.Edit]: 'edit',
  [Icon.VolumeOn]: 'volume-on',
  [Icon.VolumeOff]: 'volume-off',
  [Icon.Trophy]: 'trophy',
  [Icon.Close]: 'close',
  [Icon.ArrowLeft]: 'arrow-left',
  [Icon.ArrowRight]: 'arrow-right',
  [Icon.ArrowUp]: 'arrow-up',
};

// Animation keys.
export const Anim = {
  HeroIdle: 'hero-idle',
  HeroRun: 'hero-run',
  HeroJump: 'hero-jump',
  HeroPunch: 'hero-punch',
  ShurikenSpin: 'shuriken-spin',
  RobotIdle: 'robot-idle',
  SlimeHop: 'slime-hop',
  BatFlap: 'bat-flap',
  BeetleWalk: 'beetle-walk',
  BossIdle: 'boss-idle',
  BossWindup: 'boss-windup',
  BossAttack: 'boss-attack',
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
  SlimeHit: 'slime-hit',
  BossLaser: 'boss-laser',
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
  RunStart: 'run-start', // ms epoch when the current run began (for the leaderboard)
} as const;

// Game events emitted on the GameScene's event emitter for the HUD to read.
export const Ev = {
  ScoreChanged: 'score-changed',
  StarsChanged: 'stars-changed',
  LivesChanged: 'lives-changed',
  LevelCleared: 'level-cleared',
  GameOver: 'game-over',
} as const;
