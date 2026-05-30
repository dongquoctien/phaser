// Lospec "Sweetie-16" — a CC0 16-colour palette (https://lospec.com/palette-list/sweetie-16).
// One small cohesive palette is the foundation of the pixel-art skill: every
// sprite, tile, and the hub draws from these so the whole project reads as one.
//
// Three shapes of the same data:
//  - SWEETIE16        : 0xRRGGBB ints (Phaser fill colours)
//  - SWEETIE16_HEX    : "#rrggbb" strings (game.json thumbs, CSS)
//  - SWEETIE16_ARRAY  : ordered length-16 list (Phaser Textures.generate palette)

export const SWEETIE16 = {
  black: 0x1a1c2c,
  purple: 0x5d275d,
  red: 0xb13e53,
  orange: 0xef7d57,
  yellow: 0xffcd75,
  lime: 0xa7f070,
  green: 0x38b764,
  teal: 0x257179,
  darkblue: 0x29366f,
  blue: 0x3b5dc9,
  cyan: 0x41a6f6,
  skyblue: 0x73eff7,
  white: 0xf4f4f4,
  grey: 0x94b0c2,
  slate: 0x566c86,
  dark: 0x333c57,
} as const;

export type Sweetie16Name = keyof typeof SWEETIE16;

/** Same palette as "#rrggbb" strings, for game.json thumb maps and CSS. */
export const SWEETIE16_HEX = Object.fromEntries(
  Object.entries(SWEETIE16).map(([k, v]) => [k, '#' + v.toString(16).padStart(6, '0')]),
) as Record<Sweetie16Name, string>;

/** Ordered 16-entry list (index = Phaser Textures.generate palette slot). */
export const SWEETIE16_ARRAY: readonly number[] = Object.values(SWEETIE16);
