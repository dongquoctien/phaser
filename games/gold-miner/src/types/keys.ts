// Single source of truth for all string keys. Never use raw string literals
// for scene names, texture keys, or animation keys anywhere else in the game.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

// Procedurally generated textures (baked via src/pixel in PreloadScene).
export const TextureKeys = {
  Miner: 'miner',
  Hook: 'hook',
  GoldS: 'gold-s',
  GoldL: 'gold-l',
  Rock: 'rock',
} as const;
export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

export const RegistryKeys = {
  Best: 'best',
} as const;
