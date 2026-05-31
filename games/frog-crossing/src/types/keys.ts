// Single source of truth for all string keys.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

// All art is baked as smooth SVG-style vector textures via Graphics (no atlas
// needed for this small, geometric set). One texture key per art piece.
export const TextureKeys = {
  Frog: 'frog',
  FrogHop: 'frog-hop', // legs-out mid-hop frame
  CarOrange: 'car-orange',
  CarBlue: 'car-blue',
  CarRed: 'car-red',
  Log: 'log',
  Bush: 'bush',
} as const;
export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

export const AudioKeys = {
  Hop: 'hop',
  Splash: 'splash',
  Crash: 'crash',
  Score: 'score',
} as const;
export type AudioKey = (typeof AudioKeys)[keyof typeof AudioKeys];

export const RegistryKeys = {
  Best: 'bestDistance',
  Muted: 'muted',
} as const;
