#!/usr/bin/env node
// cut-g1.mjs — slice the g1 AI sprite sheets into clean, Phaser-ready pixel
// textures for cave-collector.
//
// Two source flavours are handled (see isBg / ALPHA_ONLY):
//   - original: MAGENTA (#FF00FF-ish) background + a thin WHITE BORDER box per
//     frame (no baked text labels) — chroma-keyed + border-stripped + despeckled.
//   - "<name> - trans.png": a real TRANSPARENT background (black + alpha=0), no
//     magenta/border — keyed off alpha only (much cleaner). The collectibles sheet
//     uses this flavour.
// Strategy: segment rows then columns by background gutters, KEEP ONLY wide bands
// (thin border lines / sparkle clusters read narrow and are dropped), trim each
// frame to content, recenter into a uniform tile, downscale to a real pixel grid
// (pixelArt), and emit one packed PNG + atlas JSON per sheet.
//
//   node scripts/cut-g1.mjs
//
// Output: games/cave-collector/public/assets/<key>.png + <key>.json (atlas)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const SRC = 'D:/Github/0assets/gif/g1';
const OUT = 'games/cave-collector/public/assets';
mkdirSync(OUT, { recursive: true });

// ---- pixel helpers --------------------------------------------------------
// Two source flavours exist in g1: the original magenta-bg + white-bordered AI
// sheets, and newer "<name> - trans.png" exports with a real transparent
// background (alpha=0) and NO magenta/border. ALPHA_ONLY switches the keying:
// when true, background = transparent pixels only (much cleaner — no chroma key,
// no border strip, no sparkle despill needed).
let ALPHA_ONLY = false;

// Magenta background: high R, high B, low G — and the AA ring where magenta bleeds
// into the sprite. Wider net removes the pink halo around frames.
const isMagenta = (d, i) => {
  const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
  if (a < 20) return true;
  if (r > 175 && b > 135 && g < 125) return true; // core magenta
  return r > 120 && b > 90 && r - g > 55 && b - g > 25; // AA ring
};
const isWhiteBorder = (d, i) => {
  const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
  return a > 40 && r > 200 && g > 200 && b > 200; // near-white frame line
};
// "Background" for the current source. Alpha sources: just the transparent pixels.
const isBg = (d, i) =>
  ALPHA_ONLY ? d[i + 3] < 40 : (isMagenta(d, i) || isWhiteBorder(d, i));
// A pixel is "foreground" (real sprite) if it's not background and has alpha.
const isFg = (d, i) => !isBg(d, i) && d[i + 3] >= 40;

function load(file) {
  return PNG.sync.read(readFileSync(join(SRC, file)));
}

// Segment a 1-D occupancy profile into bands of "content", keeping only bands at
// least `minWide` px (drops the thin white-border lines).
function bands(profile, threshold, minWide) {
  const out = [];
  let inb = false, start = 0;
  for (let i = 0; i < profile.length; i++) {
    const content = profile[i] < threshold;
    if (content && !inb) { inb = true; start = i; }
    else if (!content && inb) { inb = false; if (i - start >= minWide) out.push([start, i - 1]); }
  }
  if (inb && profile.length - start >= minWide) out.push([start, profile.length - 1]);
  return out;
}

// Background occupancy fraction across a horizontal range for each row.
function rowProfile(png, x0, x1) {
  const { width: W, data } = png;
  const prof = [];
  for (let y = 0; y < png.height; y++) {
    let c = 0, n = 0;
    for (let x = x0; x <= x1; x++) { n++; const i = (y * W + x) * 4; if (isBg(data, i)) c++; }
    prof.push(c / n);
  }
  return prof;
}
function colProfile(png, y0, y1) {
  const { width: W, data } = png;
  const prof = [];
  for (let x = 0; x < W; x++) {
    let c = 0, n = 0;
    for (let y = y0; y <= y1; y++) { n++; const i = (y * W + x) * 4; if (isBg(data, i)) c++; }
    prof.push(c / n);
  }
  return prof;
}

// Extract the content bbox of a cell, dropping magenta + white-border pixels.
// `despeckle` runs a connected-component pass and keeps only components whose
// size is >= 12% of the largest (removes the stray AI sparkle dots scattered
// around stars/coins) — the union bbox of the kept components is returned.
function cellBox(png, x0, y0, x1, y1, despeckle = false) {
  const { width: W, data } = png;
  if (!despeckle) {
    let minx = x1, miny = y1, maxx = x0, maxy = y0, any = false, area = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!isFg(data, (y * W + x) * 4)) continue;
        any = true; area++;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
    return any ? { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1, area } : null;
  }

  // flood-fill connected components within the cell
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const label = new Int32Array(cw * ch).fill(-1);
  const comps = []; // {size, minx,miny,maxx,maxy}
  const stack = [];
  for (let ly = 0; ly < ch; ly++) {
    for (let lx = 0; lx < cw; lx++) {
      const li = ly * cw + lx;
      if (label[li] !== -1) continue;
      if (!isFg(data, ((y0 + ly) * W + (x0 + lx)) * 4)) { label[li] = -2; continue; }
      const id = comps.length;
      const c = { size: 0, minx: lx, miny: ly, maxx: lx, maxy: ly };
      stack.length = 0; stack.push(li); label[li] = id;
      while (stack.length) {
        const p = stack.pop();
        const px = p % cw, py = (p - px) / cw;
        c.size++;
        if (px < c.minx) c.minx = px; if (px > c.maxx) c.maxx = px;
        if (py < c.miny) c.miny = py; if (py > c.maxy) c.maxy = py;
        const nb = [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]];
        for (const [nx, ny] of nb) {
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          const ni = ny * cw + nx;
          if (label[ni] !== -1) continue;
          if (!isFg(data, ((y0 + ny) * W + (x0 + nx)) * 4)) { label[ni] = -2; continue; }
          label[ni] = id; stack.push(ni);
        }
      }
      comps.push(c);
    }
  }
  if (!comps.length) return null;
  const maxSize = Math.max(...comps.map((c) => c.size));
  const kept = comps.filter((c) => c.size >= Math.max(6, maxSize * 0.12));
  let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1, area = 0;
  for (const c of kept) {
    area += c.size;
    if (c.minx < minx) minx = c.minx; if (c.maxx > maxx) maxx = c.maxx;
    if (c.miny < miny) miny = c.miny; if (c.maxy > maxy) maxy = c.maxy;
  }
  return { x: x0 + minx, y: y0 + miny, w: maxx - minx + 1, h: maxy - miny + 1, area };
}

// Box-average downscale a sub-rect of `png` into a tile of size tw x th,
// writing into dst at (dx,dy). Foreground = pixels that are neither magenta nor
// white-border. A destination pixel is opaque only if the majority of its source
// box is foreground (so edges stay crisp, background stays transparent).
function blitScaled(png, box, dst, dx, dy, tw, th) {
  const { width: W, data } = png;
  const scale = Math.min(tw / box.w, th / box.h);
  const ow = Math.max(1, Math.round(box.w * scale));
  const oh = Math.max(1, Math.round(box.h * scale));
  const offx = Math.floor((tw - ow) / 2);
  const offy = Math.floor((th - oh) / 2);
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      const sx0 = box.x + Math.floor((ox / ow) * box.w);
      const sx1 = Math.max(sx0 + 1, box.x + Math.floor(((ox + 1) / ow) * box.w));
      const sy0 = box.y + Math.floor((oy / oh) * box.h);
      const sy1 = Math.max(sy0 + 1, box.y + Math.floor(((oy + 1) / oh) * box.h));
      let r = 0, g = 0, b = 0, fg = 0, total = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          total++;
          const i = (sy * W + sx) * 4;
          if (!isFg(data, i)) continue;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; fg++;
        }
      }
      if (fg === 0 || fg / total < 0.5) continue; // majority background -> transparent
      const di = ((dy + offy + oy) * dst.width + (dx + offx + ox)) * 4;
      dst.data[di] = Math.round(r / fg);
      dst.data[di + 1] = Math.round(g / fg);
      dst.data[di + 2] = Math.round(b / fg);
      dst.data[di + 3] = 255;
    }
  }
}

// Build a packed atlas (one row of N tiles) and write PNG + JSON.
function writeAtlas(key, frames, tile) {
  const cols = frames.length;
  const out = new PNG({ width: cols * tile, height: tile });
  out.data.fill(0);
  const json = { frames: {}, meta: { image: `${key}.png`, size: { w: cols * tile, h: tile }, scale: '1' } };
  frames.forEach((f, idx) => {
    blitScaled(f.png, f.box, out, idx * tile, 0, tile, tile);
    json.frames[String(idx)] = {
      frame: { x: idx * tile, y: 0, w: tile, h: tile },
      rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: tile, h: tile },
      sourceSize: { w: tile, h: tile },
    };
  });
  writeFileSync(join(OUT, `${key}.png`), PNG.sync.write(out));
  writeFileSync(join(OUT, `${key}.json`), JSON.stringify(json));
  console.log(`  ${key}: ${frames.length} frames @ ${tile}px -> ${key}.png/.json`);
}

// Slice a uniform-grid sheet: detect rows, then per row detect frame columns.
// `rowsExpected` lets us validate. Returns rows -> array of {png,box}.
function sliceGrid(png, { minRowH = 60, minColW = 30, despeckle = false, minFrame = 12, dropWeak = false } = {}) {
  const W = png.width;
  const rp = rowProfile(png, 0, W - 1);
  const rows = bands(rp, 0.985, minRowH);
  const result = [];
  for (const [y0, y1] of rows) {
    const cp = colProfile(png, y0, y1);
    const cols = bands(cp, 0.985, minColW);
    let frames = [];
    for (const [x0, x1] of cols) {
      const box = cellBox(png, x0, y0, x1, y1, despeckle);
      if (box && box.w >= minFrame && box.h >= minFrame) frames.push({ png, box });
    }
    // Drop weak frames: any frame with < 25% the foreground area of the row's
    // biggest frame is noise (stray AI sparkle clusters between collectibles).
    // Only for uniform-size rows (collectibles) — NOT props that vary in size.
    if (dropWeak && frames.length) {
      const maxArea = Math.max(...frames.map((f) => f.box.area || 0));
      frames = frames.filter((f) => (f.box.area || 0) >= maxArea * 0.25);
    }
    if (frames.length) result.push(frames);
  }
  return result;
}

// ---- per-sheet jobs -------------------------------------------------------
console.log('Slicing g1 sheets ->', OUT);

// 1. HERO — rows: idle(4) run(6) jump(3) punch(3). One atlas with all frames in
//    sheet order; anims map by index ranges (declared in textures.ts).
{
  const png = load('hero_bg_pink.png');
  const rows = sliceGrid(png, { minRowH: 80, minColW: 40 });
  const counts = rows.map((r) => r.length);
  const flat = rows.flat();
  writeAtlas('hero', flat, 48);
  console.log('   hero row counts:', counts.join(','), '(expect 4,6,3,3)');
}

// 2. SENTRY-BOT — 1 row of 4.
{
  const png = load('Sentry-bot enemy.png');
  const rows = sliceGrid(png, { minRowH: 80, minColW: 40 });
  writeAtlas('bot', rows.flat(), 32);
  console.log('   bot counts:', rows.map((r) => r.length).join(','), '(expect 4)');
}

// 3. SHURIKEN — 1 row of 4.
{
  const png = load('Shuriken-hazard.png');
  const rows = sliceGrid(png, { minRowH: 60, minColW: 30 });
  writeAtlas('shuriken', rows.flat(), 24);
  console.log('   shuriken counts:', rows.map((r) => r.length).join(','), '(expect 4)');
}

// 4. COLLECTIBLES — star(6) coin(4) [spark(3) + heart full/empty], all from the
//    user's TRANSPARENT re-cut (black + alpha). The latest re-cut has clean star +
//    coin (coin segments to 4, no sparkle split), so the whole sheet comes from it.
{
  ALPHA_ONLY = true; // keep true through writeAtlas (blitScaled keys off it too)
  const png = load('Collectibles, FX & HUD - trans.png');
  const rows = sliceGrid(png, { minRowH: 60, minColW: 28, despeckle: true, dropWeak: true });
  console.log('   collectibles[trans] row counts:', rows.map((r) => r.length).join(','), '(expect 6,4,5)');
  if (rows[0]) writeAtlas('star', rows[0].slice(0, 6), 16);
  if (rows[1]) writeAtlas('coin', rows[1].slice(0, 4), 16);
  if (rows[2]) {
    const r = rows[2]; // row 3 = spark x3 then heart-full, heart-empty
    writeAtlas('spark', r.slice(0, 3), 16);
    if (r.length >= 5) writeAtlas('heart', r.slice(3, 5), 12);
    else if (r.length >= 4) writeAtlas('heart', r.slice(3), 12);
  }
  ALPHA_ONLY = false;
}

// 5. BLOCKS/DOOR/DECOR — block, used-block, door(big), crystal, mushroom.
{
  const png = load('Blocks, door & decor.png');
  const rows = sliceGrid(png, { minRowH: 60, minColW: 40, despeckle: true });
  const r = rows.flat();
  console.log('   blocks/door/decor count:', r.length, '(expect 5)');
  if (r[0]) writeAtlas('block', [r[0]], 16);
  if (r[1]) writeAtlas('block-used', [r[1]], 16);
  if (r[2]) writeAtlas('door', [r[2]], 48);
  if (r[3]) writeAtlas('crystal', [r[3]], 16);
  if (r[4]) writeAtlas('mushroom', [r[4]], 16);
}

// 6. TILESET — 5 irregular pieces: ground-top, fill, edge, edge2, platform.
{
  const png = load('Toxic-cave tileset.png');
  const rows = sliceGrid(png, { minRowH: 40, minColW: 40 });
  const r = rows.flat();
  console.log('   tileset piece count:', r.length, '(expect ~5)');
  const names = ['tile-top', 'tile-fill', 'tile-edge', 'tile-edge2', 'tile-platform'];
  r.forEach((f, i) => { if (names[i]) writeAtlas(names[i], [f], 16); });
}

// 7. PARALLAX — single full image, just copy as-is (background, no slicing).
{
  const png = load('Parallax background.png');
  writeFileSync(join(OUT, 'parallax.png'), PNG.sync.write(png));
  console.log('  parallax: copied full image -> parallax.png');
}

console.log('Done.');
