#!/usr/bin/env node
// slice-spritesheet.mjs — turn a labeled, chroma-keyed character sheet (like the
// ones in 0assets/hero-animation: a green background, a grid of cells, a text
// label above each animation row) into clean, Phaser-ready animation assets.
//
// Why this exists: AI-generated character sheets come as ONE big PNG with
//   - a bright chroma-green background (#00ff00-ish, sometimes spilled onto edges)
//   - rows of frames, each row a different animation (IDLE, WALK, ATTACK, ...)
//   - a TEXT LABEL baked into the image above each row
//   - VARIABLE frames per row and slightly off-grid sprites
// You cannot just `load.spritesheet({frameWidth})` that — the label text and the
// uneven spacing break a naive uniform grid. This script detects the real content,
// segments it into rows and frames, drops the green, trims+recenters every frame
// into a uniform tile, and emits BOTH:
//   - one packed PNG + a Phaser **atlas JSON** (frame names like `idle_0`), and
//   - a `*.anims.json` you can feed straight into `anims.create` (see README out).
//
// Pipeline (the robust recipe — see the skill SKILL.md "How it works"):
//   1. read RGBA (pngjs)
//   2. chroma-key: green -> transparent, with a despill pass on edge pixels
//   3. ROW segmentation by GUTTERS (scanlines that are >=92% background) -> animation
//      rows (NOT connected-components — baked-in label text would bridge cells)
//   4. per row, COLUMN segmentation by gutters >= --gutter wide -> frame bboxes
//      (handles variable frame widths; narrow gaps inside a sprite don't split it)
//   5. drop baked-in text labels per row (no OCR — by aspect/colour/saturation)
//   6. trim each frame to its content bbox, recenter into a uniform TILE; --anchor
//      bottom feet-anchors AND writes a feet pivot so the game origin lands on the feet
//   7. pack rows top-to-bottom into one atlas PNG + atlas JSON + anims JSON
//
// Usage:
//   node scripts/slice-spritesheet.mjs <sheet.png> [options]
//
//   --out <dir>        output directory (default: ./<sheetname>-sliced/)
//   --name <key>       base texture key (default: sheet filename, kebab-cased)
//   --anchor <pos>     center | bottom  (bottom = feet-anchored + feet pivot; default center)
//   --tile <px>        uniform output tile size, square (default: auto from content)
//   --gutter <px>      min gutter width to split two frames (default 4)
//   --rows <n>         force N evenly-split rows (skip row auto-detect)
//   --cols <n>         divide each row into N equal cells (clean grids; immune to gaps)
//   --green <hex>      chroma key color hint (default auto-sample sheet corners)
//   --tol <0..255>     chroma key tolerance (default 90)
//   --min-frame <px>   ignore detected frames narrower than this (default 8)
//   --keep-labels      do NOT drop baked-in text labels
//   --label-aspect <r> w/h >= r looks like a wide text label (default 1.7)
//   --label-sat <0..1> coloured-pixel fraction < this looks like text (default 0.30)
//   --names a,b,c      override row names in order (else canonical 11 set, or row_0..)
//   --fps <n>          default anim frameRate written into anims JSON (default 10)
//   --debug            also write _debug.png with detected frame boxes drawn
//
// Examples:
//   node scripts/slice-spritesheet.mjs D:/Github/0assets/hero-animation/Anzu.png \
//        --name anzu --anchor bottom --tile 64 \
//        --out games/twdc-defense/public/heroes-anim/anzu
//
//   # whole folder:
//   for f in D:/Github/0assets/hero-animation/*.png; do \
//     node scripts/slice-spritesheet.mjs "$f" --anchor bottom; done
//
// Output (in --out):
//   <name>.png         packed atlas image (transparent bg)
//   <name>.json        Phaser atlas — TexturePacker `textures[]`+`frames[]` array form
//                      (each frame carries filename, frame rect, sourceSize, pivot),
//                      parsed by load.atlas via Phaser's JSONArray parser
//   <name>.anims.json  [{ key, frames:[names], frameRate, repeat }] for anims.create
//   _debug.png         (with --debug) source overlaid with detected boxes
//
// No native deps — pngjs only (already in devDependencies).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join, extname } from 'node:path';
import { PNG } from 'pngjs';

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(`--${n}`);
const input = argv[0];
if (!input || input.startsWith('--')) {
  console.error('usage: node scripts/slice-spritesheet.mjs <sheet.png> [options] (see header)');
  process.exit(1);
}

const die = (msg) => { console.error(`slice-spritesheet: ${msg}`); process.exit(1); };
// positive-number flag with validation: rejects NaN / <=0 so a typo can't silently
// produce a NaN-sized atlas or a 0-px PNG (pngjs throws on those, with a cryptic msg).
const numFlag = (n, d) => {
  const raw = flag(n, null);
  if (raw === null) return d;
  const v = +raw;
  if (!Number.isFinite(v) || v <= 0) die(`--${n} must be a positive number (got "${raw}")`);
  return v;
};

const nameKebab = (s) => s.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const NAME = flag('name', nameKebab(basename(input)));
const OUT = flag('out', `./${NAME}-sliced`);
const ANCHOR = flag('anchor', 'center');
if (ANCHOR !== 'center' && ANCHOR !== 'bottom') die(`--anchor must be center|bottom (got "${ANCHOR}")`);
const TOL = numFlag('tol', 90);
const MIN_FRAME = numFlag('min-frame', 8);
const MIN_GUTTER = numFlag('gutter', 4); // min gutter width (px) to split two frames
const FPS = numFlag('fps', 10);
const TILE_ARG = flag('tile', null) === null ? null : numFlag('tile', null);
const ROWS_ARG = flag('rows', null) === null ? null : numFlag('rows', null);
const COLS_ARG = flag('cols', null) === null ? null : numFlag('cols', null); // fixed cols/row
const NAMES_ARG = flag('names', null);
const DEBUG = has('debug');

// canonical animation labels found in the 0assets hero sheets, in sheet order,
// mapped to short Phaser-friendly keys. Used to auto-name rows by count/order.
const CANON = [
  'idle', 'upgrade', 'power', 'walk', 'attack_a', 'attack_b',
  'hurt', 'death', 'spawn', 'victory', 'think',
];

// ---- load -----------------------------------------------------------------
const src = PNG.sync.read(readFileSync(input));
const W = src.width, H = src.height, D = src.data;
const at = (x, y) => (y * W + x) << 2;

// --crop-left / --crop-right <px>: blank a vertical band on the left/right edge to
// transparent BEFORE any segmentation. Some sheets bake the animation NAME into a
// left margin column (e.g. "IDLE_BREATHING") that overlaps cell 0; the sparse text
// usually trips rejectLabels, but with a clean regular grid (--cols N) label cells
// aren't filtered, so the margin pollutes frame 0. Wiping the band makes --cols N
// reliable. Pixels are set fully transparent so isBg() treats them as background.
// crop bands accept 0 (= no crop), so parse as a non-negative int rather than numFlag
// (which rejects 0). A negative value is a typo — clamp to 0.
const cropFlag = (n) => { const r = flag(n, null); if (r === null) return 0; const v = +r; return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0; };
const CROP_L = cropFlag('crop-left');
const CROP_R = cropFlag('crop-right');
if (CROP_L > 0 || CROP_R > 0) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < CROP_L && x < W; x++) D[at(x, y) + 3] = 0;
    for (let x = Math.max(0, W - CROP_R); x < W; x++) D[at(x, y) + 3] = 0;
  }
}

// ---- chroma key -----------------------------------------------------------
// auto-sample the background colour from the four corners (median) unless given.
function sampleBg() {
  const pts = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3], [W >> 1, 2], [2, H >> 1]];
  const rs = [], gs = [], bs = [];
  for (const [x, y] of pts) { const i = at(x, y); rs.push(D[i]); gs.push(D[i + 1]); bs.push(D[i + 2]); }
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(rs), med(gs), med(bs)];
}
let BG;
const greenArg = flag('green', null);
if (greenArg) { const h = greenArg.replace('#', ''); BG = [0, 2, 4].map(k => parseInt(h.substr(k, 2), 16)); }
else BG = sampleBg();

// A pixel is background if EITHER (a) it's close to the sampled key shade, OR
// (b) it's unambiguously "green-dominant" — green clearly exceeds red AND blue.
// (b) is essential because these sheets draw DARKER green grid lines (e.g.
// #008900) over the bright green field (#25e522): a single sampled shade + a
// tolerance ball misses the grid lines, they survive as "content", and the whole
// sheet floods into one connected blob. Keying all green-dominant pixels removes
// both the field and the grid. The red/blue margin keeps a genuine green costume
// pixel (which is rarely pure-green-dominant by this margin) from vanishing.
const GREEN_MARGIN = 40;
function isBg(i) {
  const a = D[i + 3];
  if (a < 24) return true;
  const r = D[i], g = D[i + 1], b = D[i + 2];
  if (g > r + GREEN_MARGIN && g > b + GREEN_MARGIN && g > 80) return true;
  const dr = r - BG[0], dg = g - BG[1], db = b - BG[2];
  return dr * dr + dg * dg + db * db <= TOL * TOL;
}

// Build an alpha mask (1 = content) and despill edge pixels (reduce green cast on
// pixels that survived but lean toward the key colour — classic halo fix).
const mask = new Uint8Array(W * H);
for (let p = 0, i = 0; p < W * H; p++, i += 4) mask[p] = isBg(i) ? 0 : 1;

function despill(i) {
  // if green channel notably exceeds red & blue (green halo), clamp it down to
  // the max of the other two so the fringe loses its green cast.
  const r = D[i], g = D[i + 1], b = D[i + 2];
  if (g > r + 12 && g > b + 12) D[i + 1] = Math.max(r, b);
}

// ---- segmentation ---------------------------------------------------------
// These sheets are a REGULAR GRID drawn with chroma-green gridlines/gutters: each
// animation is a row, each frame a cell. The robust way to find the grid is NOT
// connected-components (the baked-in label text bridges cells and floods rows into
// one blob) but to find the GUTTERS: full-width / full-height lines that are
// (almost) entirely background. The gaps between gutters are the cells.
//
// We compute, per scanline, the fraction of background pixels. A row/col that is
// >= GUTTER_FRAC background is a gutter. Runs of non-gutter scanlines are cells.
const GUTTER_FRAC = 0.92;

// Return [start,end] ranges of consecutive NON-gutter scanlines (cells), but only
// treat a gutter as a real cell boundary if it is at least `minGutterRun` wide.
// A 1–2px transparent gap THROUGH a sprite (between an arm and the body, or inside
// an FX puff) is narrower than a real inter-cell gutter; merging across sub-width
// gaps keeps one sprite as one frame. Two-pass: collect raw runs with their gap
// widths, then merge any pair separated by a too-narrow gap.
function gutterSegments(isGutter, n, minGutterRun = 1) {
  const raw = []; // [start, end]
  let s = -1;
  for (let i = 0; i < n; i++) {
    if (!isGutter(i)) { if (s < 0) s = i; }
    else if (s >= 0) { raw.push([s, i - 1]); s = -1; }
  }
  if (s >= 0) raw.push([s, n - 1]);
  if (minGutterRun <= 1 || raw.length < 2) return raw;
  const merged = [raw[0]];
  for (let k = 1; k < raw.length; k++) {
    const prev = merged[merged.length - 1];
    const gap = raw[k][0] - prev[1] - 1; // gutter width between prev and this run
    if (gap < minGutterRun) prev[1] = raw[k][1]; // absorb: gutter too narrow
    else merged.push(raw[k]);
  }
  return merged;
}

// fraction of background pixels per row / per column
const rowBgFrac = new Float32Array(H);
for (let y = 0; y < H; y++) { let bg = 0; const base = y * W; for (let x = 0; x < W; x++) if (!mask[base + x]) bg++; rowBgFrac[y] = bg / W; }
const colBgFrac = new Float32Array(W);
for (let x = 0; x < W; x++) { let bg = 0; for (let y = 0; y < H; y++) if (!mask[y * W + x]) bg++; colBgFrac[x] = bg / H; }

// ROW bands: gutter rows split the sheet into animation rows.
let rowBands;
if (ROWS_ARG) {
  let top = 0, bot = H - 1;
  while (top < H && rowBgFrac[top] >= GUTTER_FRAC) top++;
  while (bot > 0 && rowBgFrac[bot] >= GUTTER_FRAC) bot--;
  const n = +ROWS_ARG;
  if (n > bot - top + 1) die(`--rows ${n} exceeds the ${bot - top + 1}px of content height`);
  const step = (bot - top + 1) / n;
  rowBands = Array.from({ length: n }, (_, k) => [Math.round(top + k * step), Math.round(top + (k + 1) * step) - 1]);
} else {
  rowBands = gutterSegments((y) => rowBgFrac[y] >= GUTTER_FRAC, H, MIN_GUTTER)
    .filter(([a, b]) => b - a + 1 >= 12); // drop hairline noise bands
}

// Note: row labels are NOT excluded by an x-cut (their text has internal gaps that
// fool a "first wide gutter" walk, and labels in different rows start at different
// x). Instead `rejectLabels()` below drops them per row by pixel-count/fill — text
// is the sparse outlier among the equal-sized sprite cells. OCR-free and robust to
// where the label sits.

// tighten a candidate cell rect to its own content bbox; also report how many
// content pixels it holds and its fill ratio (content / bbox area). Text labels
// are SPARSE (low fill, few pixels); sprites are DENSE — this is what lets us drop
// the baked-in row labels without OCR.
function tighten(x0, x1, y0, y1) {
  let mnX = x1, mxX = x0, mnY = y1, mxY = y0, n = 0, satN = 0;
  const palette = new Set(); // coarse 5-bit-per-channel colour buckets
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = y * W + x;
    if (!mask[p]) continue;
    n++; if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y;
    const i = p << 2, r = D[i], g = D[i + 1], b = D[i + 2];
    palette.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx >= 60 && mx - mn >= 40) satN++; // a clearly coloured (not gray/dark) pixel
  }
  if (!n) return null;
  const w = mxX - mnX + 1, h = mxY - mnY + 1;
  return { x0: mnX, x1: mxX, y0: mnY, y1: mxY, n, fill: n / (w * h), colors: palette.size, satFrac: satN / n };
}

// per-row COLUMN segmentation. Two modes:
//  - FIXED (--cols N): divide the row's content X-range into N equal cells. Use
//    this when the sheet is a clean regular grid — it's immune to internal gaps in
//    a sprite (an outstretched arm or detached FX won't split a frame).
//  - AUTO (default): vertical gutters between cells, excluding the label margin,
//    merging across sub-`--gutter` gaps. Use when frame widths vary per row.
function framesIn(y0, y1) {
  if (COLS_ARG) {
    const n = +COLS_ARG;
    // content X extent of this row
    let left = 0, right = W - 1;
    while (left < W && colBgFracRow(left, y0, y1) >= GUTTER_FRAC) left++;
    while (right > left && colBgFracRow(right, y0, y1) >= GUTTER_FRAC) right--;
    const step = (right - left + 1) / n, out = [];
    for (let k = 0; k < n; k++) {
      const cx0 = Math.round(left + k * step), cx1 = Math.round(left + (k + 1) * step) - 1;
      const t = tighten(cx0, cx1, y0, y1);
      if (t && t.x1 - t.x0 + 1 >= MIN_FRAME) out.push(t);
    }
    return out;
  }
  const rh = y1 - y0 + 1;
  const colBg = new Float32Array(W);
  for (let x = 0; x < W; x++) { let bg = 0; for (let y = y0; y <= y1; y++) if (!mask[y * W + x]) bg++; colBg[x] = bg / rh; }
  const cand = gutterSegments((x) => colBg[x] >= GUTTER_FRAC, W, MIN_GUTTER)
    .filter(([x0, x1]) => x1 - x0 + 1 >= MIN_FRAME)
    .map(([x0, x1]) => tighten(x0, x1, y0, y1))
    .filter(f => f && f.x1 - f.x0 + 1 >= MIN_FRAME);
  return rejectLabels(cand);
}

// Drop baked-in text labels from a row's candidate frames. A character sprite and
// a multi-word text label differ on several axes; we combine them so no single
// noisy signal decides. For each candidate we score "label-likeness" and drop the
// clear ones. Signals (vs the row's OWN median sprite, so it's scale-free):
//   - ASPECT: characters are taller-than-wide or ~square (w/h ≲ 1.3); a wrapped
//     multi-word label is distinctly wide (w/h ≳ 1.8). Strongest signal here.
//   - COLOUR variety: a label has far fewer distinct colours than a real sprite
//     (even with AA) — compare to the row median, not an absolute cutoff.
//   - SATURATION: text is dark/flat (low coloured-pixel fraction); a character is
//     colourful (skin/hair/clothes).
//   - tiny specks (stray dots) by pixel count + fill.
// Two or more strong hits ⇒ drop. `--keep-labels` disables; thresholds via flags.
const LABEL_ASPECT = +flag('label-aspect', 1.7);   // w/h >= this looks like wide text
const LABEL_MIN_SAT = +flag('label-sat', 0.30);    // satFrac < this looks like text
const LABEL_COL_FRAC = +flag('label-colors', 0.25);// colours < this * row median = text
const LABEL_PIX_FRAC = 0.18;
let droppedLabels = 0;
function rejectLabels(cand) {
  if (has('keep-labels')) return cand;
  if (cand.length < 2) return cand; // nothing to compare against; keep it
  const sortN = cand.map(f => f.n).slice().sort((a, b) => a - b);
  const sortC = cand.map(f => f.colors).slice().sort((a, b) => a - b);
  const medN = sortN[sortN.length >> 1] || 1;
  const medC = sortC[sortC.length >> 1] || 1;
  const kept = cand.filter(f => {
    const aspect = (f.x1 - f.x0 + 1) / (f.y1 - f.y0 + 1);
    let strikes = 0;
    if (aspect >= LABEL_ASPECT) strikes += 2;                  // wide text block (decisive)
    if (f.colors < LABEL_COL_FRAC * medC) strikes += 1;        // far fewer colours than peers
    if (f.satFrac < LABEL_MIN_SAT) strikes += 1;               // dark / unsaturated
    if (f.n < LABEL_PIX_FRAC * medN && f.fill < 0.3) strikes += 2; // tiny speck
    return strikes < 2;
  });
  droppedLabels += cand.length - kept.length;
  // Never let label-rejection empty a row that HAD candidates — a single wide sprite
  // (arms-out victory pose, stretched FX) can trip the aspect strike. Fall back to the
  // largest candidate so the row survives; the user can --keep-labels if it's wrong.
  if (!kept.length) return [cand.reduce((a, b) => (b.n > a.n ? b : a))];
  return kept;
}
function colBgFracRow(x, y0, y1) { let bg = 0; for (let y = y0; y <= y1; y++) if (!mask[y * W + x]) bg++; return bg / (y1 - y0 + 1); }

const rows = rowBands.map(([y0, y1]) => ({ y0, y1, frames: framesIn(y0, y1) })).filter(r => r.frames.length);

if (!rows.length) {
  console.error('No sprite rows detected. Try --rows <n>, adjust --tol/--green, or --keep-labels.');
  process.exit(2);
}

// ---- uniform tile ---------------------------------------------------------
let maxW = 0, maxH = 0;
for (const r of rows) for (const f of r.frames) { maxW = Math.max(maxW, f.x1 - f.x0 + 1); maxH = Math.max(maxH, f.y1 - f.y0 + 1); }
const TILE = TILE_ARG ? +TILE_ARG : Math.max(maxW, maxH) + 4; // pad 2px each side

// ---- row names ------------------------------------------------------------
let rowNames;
if (NAMES_ARG) rowNames = NAMES_ARG.split(',').map(s => s.trim());
else if (rows.length === CANON.length) rowNames = [...CANON];     // exact canonical match
else rowNames = rows.map((_, k) => `row_${k}`);
while (rowNames.length < rows.length) rowNames.push(`row_${rowNames.length}`);

// ---- pack into atlas ------------------------------------------------------
const cols = Math.max(...rows.map(r => r.frames.length));
const atlasW = cols * TILE, atlasH = rows.length * TILE;
const out = new PNG({ width: atlasW, height: atlasH });
const frames = {}; // name -> {frame:{x,y,w,h}, ...}
const anims = [];

rows.forEach((r, ri) => {
  const key = rowNames[ri];
  const names = [];
  r.frames.forEach((f, fi) => {
    const cw = f.x1 - f.x0 + 1, ch = f.y1 - f.y0 + 1;
    // fit content within the tile (minus 2px pad each side); only ever DOWNSCALE,
    // never enlarge — let Phaser nearest-neighbor-upscale at render time so the art
    // stays crisp (same rule as pixelate.mjs).
    const scale = Math.min(1, (TILE - 4) / Math.max(cw, ch));
    const dw = Math.max(1, Math.round(cw * scale)), dh = Math.max(1, Math.round(ch * scale));
    const dx = fi * TILE + Math.floor((TILE - dw) / 2);
    const dy = ri * TILE + (ANCHOR === 'bottom' ? (TILE - dh - 2) : Math.floor((TILE - dh) / 2));
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const sx = f.x0 + Math.min(cw - 1, Math.floor(x / scale));
      const sy = f.y0 + Math.min(ch - 1, Math.floor(y / scale));
      if (!mask[sy * W + sx]) continue;
      const si = at(sx, sy);
      despill(si);
      const oi = ((dy + y) * atlasW + (dx + x)) << 2;
      out.data[oi] = D[si]; out.data[oi + 1] = D[si + 1]; out.data[oi + 2] = D[si + 2]; out.data[oi + 3] = 255;
    }
    const fname = `${key}_${fi}`;
    frames[fname] = {
      frame: { x: fi * TILE, y: ri * TILE, w: TILE, h: TILE },
      rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: TILE, h: TILE },
      sourceSize: { w: TILE, h: TILE },
      // Custom pivot (normalized) — Phaser reads this into the sprite ORIGIN when the
      // atlas frame is used. Without it the origin is the tile CENTER (0.5,0.5), so a
      // feet-anchored frame would still be placed by its centre and the character
      // floats above `groundY`. For bottom anchor the foot line sits at (TILE-2)/TILE
      // (the 2px bottom pad); centre anchor keeps 0.5,0.5.
      pivot: ANCHOR === 'bottom' ? { x: 0.5, y: (TILE - 2) / TILE } : { x: 0.5, y: 0.5 },
    };
    names.push(fname);
  });
  anims.push({ key, frames: names, frameRate: FPS, repeat: key === 'idle' || key === 'walk' ? -1 : 0 });
});

// ---- write ----------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
const pngPath = join(OUT, `${NAME}.png`);
const jsonPath = join(OUT, `${NAME}.json`);
const animPath = join(OUT, `${NAME}.anims.json`);
writeFileSync(pngPath, PNG.sync.write(out));
writeFileSync(jsonPath, JSON.stringify({
  textures: [{ image: `${NAME}.png`, format: 'RGBA8888', size: { w: atlasW, h: atlasH }, scale: 1,
    frames: Object.entries(frames).map(([filename, v]) => ({ filename, ...v })) }],
  meta: { app: 'slice-spritesheet.mjs', version: '1.0' },
}, null, 2));
writeFileSync(animPath, JSON.stringify(anims, null, 2));

if (DEBUG) {
  const dbg = PNG.sync.read(readFileSync(input));
  const line = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = at(x, y); dbg.data[i] = r; dbg.data[i + 1] = g; dbg.data[i + 2] = b; dbg.data[i + 3] = 255; };
  rows.forEach((r) => r.frames.forEach((f) => {
    for (let x = f.x0; x <= f.x1; x++) { line(x, f.y0, 255, 0, 0); line(x, f.y1, 255, 0, 0); }
    for (let y = f.y0; y <= f.y1; y++) { line(f.x0, y, 255, 0, 0); line(f.x1, y, 255, 0, 0); }
  }));
  writeFileSync(join(OUT, '_debug.png'), PNG.sync.write(dbg));
}

console.log(`${NAME}: ${rows.length} rows, ${Object.keys(frames).length} frames, tile ${TILE}px, anchor ${ANCHOR}` +
  (droppedLabels ? `, dropped ${droppedLabels} label/speck frame(s)` : ''));
rows.forEach((r, i) => {
  const warn = r.frames.length === 1 ? '  <- 1 frame: likely over-merged (lower --gutter) or a label fallback' : '';
  console.log(`  ${rowNames[i].padEnd(10)} ${r.frames.length} frames${warn}`);
});
if (rows.length !== CANON.length && !NAMES_ARG) {
  console.log(`note: ${rows.length} rows != ${CANON.length} canonical -> rows named row_0.. (pass --rows ${CANON.length} or --names to fix)`);
}
console.log(`-> ${pngPath}\n-> ${jsonPath}\n-> ${animPath}`);
