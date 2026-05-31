// Char-grid → cached nearest-neighbor texture. The "draw in code, bake once"
// technique (generalises what flappy-bird/src/scenes/PreloadScene.ts does by
// hand). A sprite is rows of single-char palette keys; '.'/null = transparent.
//
//   const BIRD = { grid: ['.yy.', 'yyok', '.yy.'],
//                  map: { y:'#ffcd75', o:'#ef7d57', k:'#1a1c2c', '.':null } };
//   const { key } = bakeSprite(scene, 'gen:bird', BIRD);
//   scene.add.image(x, y, key);
//
// Bake ONCE (idempotent on key) and reuse — never re-bake per frame.
import Phaser from 'phaser';
import { SWEETIE16_HEX } from './palette';

/** A pixel sprite: equal-length rows; each char maps to a hex or null (clear). */
export interface PixelGrid {
  grid: string[];
  map: Record<string, string | null>;
}

export interface BakeOpts {
  /** logical size of each grid cell in texture pixels (default 1). */
  px?: number;
}

export interface BakeResult {
  key: string;
  width: number;
  height: number;
}

function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * Rasterise a PixelGrid into a cached texture. Returns the texture key + size.
 * Idempotent: if `key` already exists it is reused (safe across HMR / scene
 * restarts). Throws on ragged rows or an unmapped char so mistakes are loud.
 */
export function bakeSprite(
  scene: Phaser.Scene,
  key: string,
  sprite: PixelGrid,
  opts: BakeOpts = {},
): BakeResult {
  const px = opts.px ?? 1;
  const rows = sprite.grid.length;
  const cols = rows ? sprite.grid[0].length : 0;

  if (scene.textures.exists(key)) {
    const src = scene.textures.get(key).getSourceImage();
    return { key, width: src.width, height: src.height };
  }

  const g = scene.make.graphics({ x: 0, y: 0 });
  for (let r = 0; r < rows; r++) {
    const row = sprite.grid[r];
    if (row.length !== cols) {
      g.destroy();
      throw new Error(
        `bakeSprite("${key}"): row ${r} has length ${row.length}, expected ${cols}`,
      );
    }
    for (let c = 0; c < cols; c++) {
      const ch = row[c];
      if (!(ch in sprite.map)) {
        g.destroy();
        throw new Error(`bakeSprite("${key}"): char "${ch}" at ${r},${c} not in map`);
      }
      const hex = sprite.map[ch];
      if (!hex) continue; // transparent
      g.fillStyle(hexToInt(hex), 1);
      g.fillRect(c * px, r * px, px, px);
    }
  }
  const width = cols * px;
  const height = rows * px;
  g.generateTexture(key, width, height);
  g.destroy();
  return { key, width, height };
}

// NOTE: a `bakeIndexed()` helper used to wrap Phaser 3's `textures.generate`
// (ARNE16 indexed palette). Phaser 4 REMOVED `Create.GenerateTexture` and
// `TextureManager.generate` entirely, so that wrapper is gone. Use `bakeSprite`
// (Graphics.generateTexture, still supported) — it's more capable anyway.

// ── Built-in glyphs (Sweetie-16). Used as defaults by the hub. ───────────────
const H = SWEETIE16_HEX;

/** Common map for the built-ins. */
const M: Record<string, string | null> = {
  '.': null,
  k: H.black,
  w: H.white,
  y: H.yellow,
  o: H.orange,
  c: H.skyblue,
  b: H.blue,
  g: H.green,
  s: H.slate,
  d: H.dark,
  r: H.red,
};

/** Arcade cabinet — default game thumbnail when a game declares no `thumb`. */
const cabinet: PixelGrid = {
  map: M,
  grid: [
    '..kkkkkkkk..',
    '.kssssssssk.',
    '.kscccccsk.k',
    '.kscwwwcsk..',
    '.kscccccsk..',
    '.ksssssssk..',
    '.ksbbbbbsk..',
    '.kssssssssk.',
    '.ksgg..ggsk.',
    '.kssssssssk.',
    '..kkkkkkkk..',
    '..k......k..',
  ],
};

/** Gamepad — header logo glyph (16×9, all rows length 16). */
const gamepad: PixelGrid = {
  map: M,
  grid: [
    '................',
    '...kkkkkkkkkk...',
    '..ksssssssssssk.',
    '.ksksksssssrsksk',
    '.kskkkssssrsrksk',
    '.ksksksssssrsksk',
    '.ksssssssssssssk',
    '..kkkssssssskkk.',
    '....k......k....',
  ],
};

/** Bird — generic fallback glyph (8×7, all rows length 8). */
const bird: PixelGrid = {
  map: M,
  grid: [
    '..kkkk..',
    '.kyyyywk',
    'kyyyywwk',
    'kyyyykoo',
    'kyyyykk.',
    '.kyyyk..',
    '..kkk...',
  ],
};

/** Play triangle. */
const play: PixelGrid = {
  map: M,
  grid: [
    'k....',
    'kk...',
    'kgk..',
    'kggk.',
    'kgggk',
    'kggk.',
    'kgk..',
    'kk...',
    'k....',
  ],
};

export const BUILTINS = { cabinet, gamepad, bird, play } as const;
export type BuiltinName = keyof typeof BUILTINS;
