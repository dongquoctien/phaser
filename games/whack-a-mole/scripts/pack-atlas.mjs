// Pack the extracted character PNGs (public/assets/chars/*.png) into ONE texture
// atlas: public/assets/sprites.png + sprites.json (Phaser JSON-Array format).
// One atlas per category = one draw-call batch, per the monorepo conventions.
//
//   node games/whack-a-mole/scripts/pack-atlas.mjs

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ASSETS = path.join(import.meta.dirname, '..', 'public', 'assets');
const CHARS = path.join(import.meta.dirname, '..', 'art-src', 'chars');
const PAD = 2; // transparent gutter so bilinear/edge bleed never leaks neighbors

(async () => {
  const files = fs
    .readdirSync(CHARS)
    .filter((f) => f.endsWith('.png'))
    .sort();

  const sprites = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(CHARS, f));
    const m = await sharp(buf).metadata();
    sprites.push({ name: f.replace(/\.png$/, ''), w: m.width, h: m.height, buf });
  }

  // Shelf-pack into a roughly-square sheet. Sort tallest-first for tight shelves.
  sprites.sort((a, b) => b.h - a.h);
  const MAXW = 512;
  let x = PAD,
    y = PAD,
    shelfH = 0,
    sheetW = 0;
  for (const s of sprites) {
    if (x + s.w + PAD > MAXW) {
      x = PAD;
      y += shelfH + PAD;
      shelfH = 0;
    }
    s.x = x;
    s.y = y;
    x += s.w + PAD;
    shelfH = Math.max(shelfH, s.h);
    sheetW = Math.max(sheetW, x);
  }
  const sheetH = y + shelfH + PAD;

  const composites = sprites.map((s) => ({ input: s.buf, left: s.x, top: s.y }));
  await sharp({
    create: { width: sheetW, height: sheetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ASSETS, 'sprites.png'));

  const atlas = {
    frames: sprites.map((s) => ({
      filename: s.name,
      frame: { x: s.x, y: s.y, w: s.w, h: s.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: s.w, h: s.h },
      sourceSize: { w: s.w, h: s.h },
    })),
    meta: {
      app: 'wam-pack-atlas',
      image: 'sprites.png',
      format: 'RGBA8888',
      size: { w: sheetW, h: sheetH },
      scale: '1',
    },
  };
  fs.writeFileSync(path.join(ASSETS, 'sprites.json'), JSON.stringify(atlas));
  console.log(`Packed ${sprites.length} frames -> sprites.png ${sheetW}x${sheetH}`);
})();
