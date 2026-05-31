// Single source of truth for all string keys.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
  LevelUp: 'LevelUpScene',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

// All sprites are baked procedurally as top-down pixel art (src/pixel) — the
// Kenney atlas read poorly upscaled, so we draw our own crisp pixel sprites.
export const TextureKeys = {
  Hero: 'hero',
  Walker: 'walker',
  Runner: 'runner',
  Boss: 'boss',
  Bullet: 'bullet',
  Gem: 'gem',
  // Equipment overlays — baked on the SAME 10x11 grid as Hero (only the slot
  // region painted) so they align pixel-perfect when copying the hero transform.
  OvHat: 'ov-hat',
  OvShirt: 'ov-shirt',
  OvGun: 'ov-gun',
  OvShoes: 'ov-shoes',
  // Equipment drop / footer icons (small, standalone).
  IcoHat: 'ico-hat',
  IcoShirt: 'ico-shirt',
  IcoGun: 'ico-gun',
  IcoShoes: 'ico-shoes',
  // Skill icons (level-up cards + footer).
  SkDmg: 'sk-dmg',
  SkRate: 'sk-rate',
  SkMulti: 'sk-multi',
  SkSpeed: 'sk-speed',
  SkHp: 'sk-hp',
  SkMagnet: 'sk-magnet',
  SkHeal: 'sk-heal',
  SkGlass: 'sk-glass',
} as const;
export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

export const AudioKeys = {
  Shoot: 'shoot',
  Hit: 'hit',
  Hurt: 'hurt',
  Pickup: 'pickup',
  LevelUp: 'levelup',
  Click: 'click',
} as const;
export type AudioKey = (typeof AudioKeys)[keyof typeof AudioKeys];

export const RegistryKeys = {
  BestTime: 'bestTime',
  Muted: 'muted',
  Difficulty: 'difficulty',
} as const;
