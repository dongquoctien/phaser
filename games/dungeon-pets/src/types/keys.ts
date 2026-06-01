// Single source of truth for all string keys.

export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
  LevelUp: 'LevelUpScene',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

// All art baked as smooth vector textures via Graphics (no atlas). One key each.
export const TextureKeys = {
  // Heroes (capybara-go style roster)
  Capybara: 'capybara',
  Cat: 'cat',
  Duck: 'duck',
  Frog: 'frog',
  Owl: 'owl', // pet recruit
  // Enemies
  Skeleton: 'skeleton',
  Slime: 'slime',
  Boss: 'boss',
  // FX / props
  Slash: 'slash',
  Arrow: 'arrow',
} as const;
export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

export const AudioKeys = {
  Hit: 'hit',
  Skill: 'skill',
  LevelUp: 'levelup',
  Defeat: 'defeat',
  Click: 'click',
} as const;
export type AudioKey = (typeof AudioKeys)[keyof typeof AudioKeys];

export const RegistryKeys = {
  BestFloor: 'bestFloor',
  Muted: 'muted',
  Team: 'team', // chosen hero ids
} as const;
