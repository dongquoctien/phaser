// Single source of truth for all string keys. Never use raw string literals
// for scene names, texture keys, or animation keys anywhere else in the game.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

// Textures are generated procedurally in PreloadScene (pixel-art, no PNGs), so
// these are the generated-texture keys rather than atlas frame names.
export const TextureKeys = {
  Bird: 'bird',
  Pipe: 'pipe',
  PipeCap: 'pipe-cap',
  Ground: 'ground',
} as const;

export const AudioKeys = {
  Flap: 'flap',
  Score: 'score',
  Hit: 'hit',
} as const;
export type AudioKey = (typeof AudioKeys)[keyof typeof AudioKeys];

export const RegistryKeys = {
  Best: 'best', // persisted high score in the game registry
  Muted: 'muted',
} as const;
