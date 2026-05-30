// Single source of truth for all string keys. Never use raw string literals
// for scene names, texture keys, or animation keys anywhere else in the game.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

export const AtlasKeys = {
  Sprites: 'sprites', // gameplay sprites
  UI: 'ui', // buttons, hud
  FX: 'fx', // particles, effects
} as const;

export const AudioKeys = {
  // Music: 'music',
  // Click: 'click',
} as const;
