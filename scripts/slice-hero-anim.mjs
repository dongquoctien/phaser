#!/usr/bin/env node
// slice-hero-anim.mjs — batch-slice the 21 labeled green-screen hero sheets in
// 0assets/hero-animation-defense into Phaser atlases under
// games/twdc-defense/public/heroes-anim/<id>/.
//
// Every sheet is the SAME shape: a green field, a 5-row × 8-col grid, and the row
// NAME baked into a left margin ("IDLE_BREATHING", "UPGRADE", "POWER_ACTIVE",
// "ATTACK_A", "ATTACK_B"). The grid is clean and regular, so we slice with
// --rows 5 --cols 8; the only per-sheet variable is HOW WIDE the left label band
// is (most ~210px, but a couple of wide sprites sit closer to the text). So we
// AUTO-DETECT the label band per sheet — the first wide run of real sprite content
// after the sparse text — and pass it as --crop-left to slice-spritesheet.mjs.
//
// Usage: node scripts/slice-hero-anim.mjs            (all 21)
//        node scripts/slice-hero-anim.mjs oreo hakj  (just these)

import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const SRC_DIR = 'D:/Github/0assets/hero-animation-defense';
const OUT_ROOT = join(REPO, 'games/twdc-defense/public/heroes-anim');
const ROW_NAMES = 'idle,upgrade,power,attack_a,attack_b';

// Detect the x where sprite content begins (so we can crop the label margin off).
// Strategy: per-column content fraction; the label is a band of NARROW runs (text
// strokes) near the left, then a clear gutter, then the FIRST sprite — a single
// run that's tall AND part of a wide block. We find the first column that begins a
// run of >= MIN_RUN consecutive content columns whose peak height is "sprite-tall"
// (>= 25% of H), then back off a few px. This skips the text (short strokes) and
// lands just before the first sprite. Returns a safe crop-left in px.
function detectCropLeft(file) {
  const src = PNG.sync.read(readFileSync(file));
  const W = src.width, H = src.height, D = src.data;
  const isBg = (i) => {
    const a = D[i + 3]; if (a < 24) return true;
    const r = D[i], g = D[i + 1], b = D[i + 2];
    return g > r + 40 && g > b + 40 && g > 80; // green-dominant
  };
  // per-column max vertical content (tallest content stretch) and content count
  const colMax = new Int32Array(W);
  for (let x = 0; x < W; x++) {
    let cur = 0, mx = 0;
    for (let y = 0; y < H; y++) {
      if (!isBg(((y * W + x) << 2))) { cur++; if (cur > mx) mx = cur; } else cur = 0;
    }
    colMax[x] = mx;
  }
  // The FIRST column with a tall content run (>= 120px) marks the start of the first
  // sprite. Measured across these sheets: baked label text columns top out at ~20px
  // tall, while character columns run 160–185px — so 120px cleanly skips the whole
  // label band and lands on the first character. Back off 8px so we don't shave the
  // sprite's leading pixels.
  const TALL = 120;
  for (let x = 0; x < W; x++) {
    if (colMax[x] >= TALL) return Math.max(0, x - 8);
  }
  return 0; // fallback: no crop
}

const want = process.argv.slice(2);
const sheets = readdirSync(SRC_DIR).filter(f => f.endsWith('.png'))
  .filter(f => !want.length || want.includes(f.replace('.png', '')));

let ok = 0;
for (const f of sheets) {
  const id = f.replace('.png', '');
  const file = join(SRC_DIR, f);
  const crop = detectCropLeft(file);
  const out = join(OUT_ROOT, id);
  try {
    const log = execFileSync('node', [
      join(HERE, 'slice-spritesheet.mjs'), file,
      '--name', id, '--rows', '5', '--cols', '8', '--crop-left', String(crop),
      '--names', ROW_NAMES, '--anchor', 'bottom', '--tile', '64',
      '--out', out,
    ], { encoding: 'utf8' });
    const first = log.split('\n')[0];
    console.log(`✓ ${id.padEnd(10)} crop-left=${String(crop).padStart(3)}  ${first}`);
    ok++;
  } catch (e) {
    console.error(`✗ ${id}: ${e.message.split('\n')[0]}`);
  }
}
console.log(`\n${ok}/${sheets.length} sheets sliced -> ${OUT_ROOT}`);
