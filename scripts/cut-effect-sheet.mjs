#!/usr/bin/env node
// cut-effect-sheet.mjs — extract a single FX animation row from one of the
// 0assets/effect sheets (928×1131, ~93px cell pitch, label row above each sprite
// row) into a clean horizontal spritesheet for Phaser.
//
// The source rows are green-keyed (chroma green ~#5aaa5a). We:
//   1. take a Y band (the sprite row, excluding its text label)
//   2. walk a fixed COLUMN PITCH across the width, taking `frames` cells
//   3. for each cell: drop green pixels to transparent, trim, then re-center
//      into a fixed FRAME×FRAME tile so every frame lines up
//
// Usage:
//   node scripts/cut-effect-sheet.mjs <sheet.png> --out <out.png> \
//        --y0 263 --y1 327 --x0 18 --pitch 93 --frames 7 --tile 64
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const input = argv[0];
const out = flag('out', null);
const y0 = +flag('y0', 0), y1 = +flag('y1', 0);
const x0 = +flag('x0', 18), pitch = +flag('pitch', 93);
const frames = +flag('frames', 7), tile = +flag('tile', 64);

const src = PNG.sync.read(readFileSync(input));
const W = src.width;
const dropDark = +flag('dark', 0); // if >0, treat pixels darker than this (max channel) as background
// Background = the chroma green OR (optionally) the dark cell border. We key only
// pixels where green clearly dominates by a wide margin AND red+blue are both low,
// so cyan/teal FX (high green + high blue) survive instead of being eaten.
const isBg = (r, g, b, a) => {
  if (a <= 20) return true;
  const pureGreen = g > 90 && g > r + 60 && g > b + 60 && r < 120 && b < 120;
  const dark = dropDark > 0 && Math.max(r, g, b) < dropDark;
  return pureGreen || dark;
};

// gather each frame's opaque (non-green) pixels, trim to bbox, recenter into tile
const out_png = new PNG({ width: tile * frames, height: tile });
for (let f = 0; f < frames; f++) {
  const cx0 = x0 + f * pitch;
  const cx1 = Math.min(W, cx0 + pitch);
  // bbox of content
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = y0; y < y1; y++) for (let x = cx0; x < cx1; x++) {
    const i = (y * W + x) << 2;
    const a = src.data[i + 3];
    if (a > 30 && !isBg(src.data[i], src.data[i + 1], src.data[i + 2], a)) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) continue; // empty frame
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const scale = Math.min(1, (tile - 4) / Math.max(cw, ch)); // fit within tile
  const dw = Math.round(cw * scale), dh = Math.round(ch * scale);
  const ox = f * tile + Math.floor((tile - dw) / 2), oy = Math.floor((tile - dh) / 2);
  for (let dy = 0; dy < dh; dy++) for (let dx = 0; dx < dw; dx++) {
    const sx = minX + Math.floor(dx / scale), sy = minY + Math.floor(dy / scale);
    const si = (sy * W + sx) << 2;
    const a = src.data[si + 3];
    if (a <= 30 || isBg(src.data[si], src.data[si + 1], src.data[si + 2], a)) continue;
    const di = ((oy + dy) * out_png.width + (ox + dx)) << 2;
    out_png.data[di] = src.data[si]; out_png.data[di + 1] = src.data[si + 1];
    out_png.data[di + 2] = src.data[si + 2]; out_png.data[di + 3] = 255;
  }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, PNG.sync.write(out_png));
console.log(`${out}  ${tile}x${tile} × ${frames} frames`);
