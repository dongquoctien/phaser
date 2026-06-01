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
  Sprites: 'sprites', // the character atlas (sprites.png + sprites.json)
} as const;

// Procedurally-generated textures (see systems/art.ts) — kept distinct from the
// atlas frame names so it's obvious what is baked vs. authored.
export const TexKeys = {
  Hole: 'tex-hole', // the dark hole opening (drawn behind the character)
  Mound: 'tex-mound', // the raised dirt rim (drawn in front, clips the body)
  Dirt: 'tex-dirt', // a flying dirt-clod particle
  Star: 'tex-star', // a sparkle particle for a good hit
  Ring: 'tex-ring', // expanding impact ring on a successful bonk
  Marker: 'tex-marker', // ground halo under a popped char (tinted red/green)
  // the three pickable weapons (cursor / striker) — no hand, just weapon + shaft
  WeaponPan: 'tex-weapon-pan',
  WeaponMace: 'tex-weapon-mace',
  WeaponSwatter: 'tex-weapon-swatter',
} as const;

// Pickable weapons. The chosen id is stored in the registry under REG_WEAPON so
// it survives the Menu -> Game scene change.
export const Weapons = ['pan', 'mace', 'swatter'] as const;
export type WeaponId = (typeof Weapons)[number];
export const REG_WEAPON = 'weapon';

export const AudioKeys = {
  // sound is added by the phaser-audio skill later
} as const;
