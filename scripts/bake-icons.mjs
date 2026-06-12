#!/usr/bin/env node
// bake-icons.mjs — rasterize the pixelarticons (MIT) UI icons this game uses into
// crisp 24px PNGs under games/cave-collector/public/assets/icons/.
//
// Why bake offline (not this.load.svg): the game is pixelArt:true at a 400x240
// internal res; SVGs rasterized at runtime + integer-scaled go blurry. pixelarticons
// are authored on a 24px pixel grid, so baking each at exactly 24px (nearest-kernel)
// gives a true pixel sprite the engine then nearest-neighbor scales cleanly.
//
// Source SVGs are vendored under assets-src/pixelarticons/ (a pinned copy of the MIT
// repo's svg/ folder). Run once after adding/removing an icon:
//   node scripts/bake-icons.mjs

import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const SRC = 'games/cave-collector/assets-src/pixelarticons';
const OUT = 'games/cave-collector/public/assets/icons';
mkdirSync(OUT, { recursive: true });

// icon file (in SRC) -> output key. White fill; the game tints per-use.
const ICONS = {
  'menu': 'menu',
  'pen-square': 'edit',
  'volume': 'volume-off',  // speaker, no waves  -> muted
  'volume-3': 'volume-on', // speaker with waves -> sound on
  'trophy': 'trophy',
  'close': 'close',
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  'arrow-up': 'arrow-up',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
};

const SIZE = 24; // native pixelarticons grid

let made = 0;
for (const [src, key] of Object.entries(ICONS)) {
  const file = join(SRC, `${src}.svg`);
  if (!existsSync(file)) { console.warn(`  ! missing ${src}.svg`); continue; }
  const svg = readFileSync(file, 'utf8').replace(/currentColor/g, '#ffffff');
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(SIZE, SIZE, { kernel: 'nearest' })
    .png()
    .toFile(join(OUT, `${key}.png`));
  made++;
}
console.log(`baked ${made} icons @ ${SIZE}px -> ${OUT}`);
