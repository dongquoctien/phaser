#!/usr/bin/env node
// pixelate.mjs — turn an ordinary (or AI-"faux-pixel") PNG into a true low-res
// pixel sprite suitable for a Phaser `pixelArt: true` game.
//
// Why this exists: art like games/twdc-defense/public/heroes/*.png is ~119–145px
// RGBA with anti-aliased edges and an off-grid "pixel" look. Under pixelArt:true +
// Scale.FIT that renders blurry/jagged. Downscaling to a real pixel grid (and
// reducing the palette) gives a crisp sprite that Phaser then scales up with
// nearest-neighbor cleanly. Output is left SMALL on purpose — let the engine
// upscale, never bake the upscale into the file.
//
// Pipeline (the classic image->pixel-art recipe):
//   1. read RGBA          (pngjs)
//   2. auto-trim          drop fully-transparent border so the sprite fills the grid
//   3. box-average down   merge AA detail into solid blocks (better than nearest here)
//   4. quantize palette   median-cut to N colours; preserves alpha (hard cutoff)
//   5. write at grid res   no upscale — Phaser does the nearest-neighbor scale
//
// Usage:
//   node scripts/pixelate.mjs <input.png> [--out file] [--h 56] [--colors 24]
//                                         [--alpha 128] [--no-trim]
//
//   --h       target sprite HEIGHT in pixels (width follows aspect). default 56
//   --colors  max palette size (median-cut). default 24. 0 = no quantization
//   --alpha   alpha threshold 0–255; pixels below become fully transparent. default 128
//   --no-trim skip transparent-border trim
//
// Examples:
//   node scripts/pixelate.mjs games/twdc-defense/public/heroes/oreo.png
//   node scripts/pixelate.mjs in.png --h 48 --colors 16 --out out.png
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { PNG } from 'pngjs';

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (!argv.length || argv[0].startsWith('-')) {
  console.error('usage: node scripts/pixelate.mjs <input.png> [--out f] [--h 56] [--colors 24] [--alpha 128] [--no-trim]');
  process.exit(1);
}
const input = argv[0];
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const has = (name) => argv.includes(`--${name}`);

const targetH = parseInt(flag('h', '56'), 10);
const maxColors = parseInt(flag('colors', '24'), 10);
const alphaCut = parseInt(flag('alpha', '128'), 10);
const doTrim = !has('no-trim');
const outArg = flag('out', null);

// default output: <dir>/../<dir-name>-pixel/<file> next to a heroes/ folder, else *-px.png
function defaultOut(p) {
  const dir = dirname(p);
  const file = basename(p);
  if (/heroes$/.test(dir)) return join(dir, '..', 'heroes-pixel', file);
  return join(dir, file.replace(/\.png$/i, '-px.png'));
}
const output = outArg ?? defaultOut(input);

// ── read ─────────────────────────────────────────────────────────────────────
const src = PNG.sync.read(readFileSync(input));
const { width: W, height: H, data } = src;
const at = (x, y) => (y * W + x) * 4;

// ── 1. auto-trim transparent border ──────────────────────────────────────────
let x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1;
if (doTrim) {
  const op = (x, y) => data[at(x, y) + 3] > alphaCut;
  let top = 0, bot = H - 1, left = 0, right = W - 1;
  outer: for (; top <= bot; top++) for (let x = 0; x < W; x++) if (op(x, top)) break outer;
  outer: for (; bot >= top; bot--) for (let x = 0; x < W; x++) if (op(x, bot)) break outer;
  outer: for (; left <= right; left++) for (let y = top; y <= bot; y++) if (op(left, y)) break outer;
  outer: for (; right >= left; right--) for (let y = top; y <= bot; y++) if (op(right, y)) break outer;
  if (right >= left && bot >= top) { x0 = left; y0 = top; x1 = right; y1 = bot; }
}
const cropW = x1 - x0 + 1;
const cropH = y1 - y0 + 1;

// ── 2. box-average downscale to target grid (keep aspect from cropped box) ────
const outH = Math.max(1, targetH);
const outW = Math.max(1, Math.round((cropW / cropH) * outH));
const out = new PNG({ width: outW, height: outH });

for (let oy = 0; oy < outH; oy++) {
  for (let ox = 0; ox < outW; ox++) {
    // source box for this output pixel
    const sx0 = x0 + Math.floor((ox / outW) * cropW);
    const sx1 = x0 + Math.max(sx0 + 1, Math.floor(((ox + 1) / outW) * cropW));
    const sy0 = y0 + Math.floor((oy / outH) * cropH);
    const sy1 = y0 + Math.max(sy0 + 1, Math.floor(((oy + 1) / outH) * cropH));
    let r = 0, g = 0, b = 0, a = 0, n = 0, av = 0;
    for (let sy = sy0; sy < sy1; sy++) {
      for (let sx = sx0; sx < sx1; sx++) {
        const i = at(sx, sy);
        const al = data[i + 3];
        // premultiply by alpha so transparent pixels don't pollute colour
        r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al;
        a += al; av += al > 0 ? 1 : 0; n++;
      }
    }
    const oi = (oy * outW + ox) * 4;
    const meanA = n ? a / n : 0;
    if (a > 0) { out.data[oi] = r / a; out.data[oi + 1] = g / a; out.data[oi + 2] = b / a; }
    else { out.data[oi] = out.data[oi + 1] = out.data[oi + 2] = 0; }
    // hard alpha cutoff -> crisp edge (no semi-transparent fringe)
    out.data[oi + 3] = meanA >= alphaCut ? 255 : 0;
  }
}

// ── 3. median-cut colour quantization (opaque pixels only) ────────────────────
if (maxColors > 0) {
  const pixels = []; // {i, r,g,b}
  for (let p = 0; p < outW * outH; p++) {
    const oi = p * 4;
    if (out.data[oi + 3] === 0) continue;
    pixels.push({ i: oi, r: out.data[oi], g: out.data[oi + 1], b: out.data[oi + 2] });
  }
  const boxes = [pixels];
  const channelRange = (box, c) => {
    let lo = 255, hi = 0;
    for (const px of box) { const v = px[c]; if (v < lo) lo = v; if (v > hi) hi = v; }
    return hi - lo;
  };
  while (boxes.length < maxColors) {
    // pick box with largest channel range
    let bi = -1, bc = 'r', best = -1;
    for (let k = 0; k < boxes.length; k++) {
      if (boxes[k].length < 2) continue;
      for (const c of ['r', 'g', 'b']) {
        const range = channelRange(boxes[k], c);
        if (range > best) { best = range; bi = k; bc = c; }
      }
    }
    if (bi < 0 || best <= 0) break;
    const box = boxes[bi];
    box.sort((p, q) => p[bc] - q[bc]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  // map each box to its average colour, write back
  for (const box of boxes) {
    if (!box.length) continue;
    let r = 0, g = 0, b = 0;
    for (const px of box) { r += px.r; g += px.g; b += px.b; }
    r = Math.round(r / box.length); g = Math.round(g / box.length); b = Math.round(b / box.length);
    for (const px of box) { out.data[px.i] = r; out.data[px.i + 1] = g; out.data[px.i + 2] = b; }
  }
}

// ── write ─────────────────────────────────────────────────────────────────────
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, PNG.sync.write(out));
const colorsUsed = (() => {
  const s = new Set();
  for (let p = 0; p < outW * outH; p++) { const o = p * 4; if (out.data[o + 3]) s.add(`${out.data[o]},${out.data[o + 1]},${out.data[o + 2]}`); }
  return s.size;
})();
console.log(`${input}  ${W}x${H}  ->  ${output}  ${outW}x${outH}  (${colorsUsed} colours)`);
