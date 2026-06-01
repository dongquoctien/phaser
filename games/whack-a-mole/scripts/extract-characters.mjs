// Extract individual chibi pixel-art characters from the three user-provided
// sprite sheets, trim the transparent border, and resize to a uniform on-screen
// height. Output: one trimmed RGBA PNG per chosen character into <outDir>, ready
// to be packed into the sprites atlas.
//
// The user pre-removed the background (the *-removebg-preview.png files already
// have a transparent background), so we only SLICE + TRIM + RESIZE — no
// white-knockout flood-fill needed any more.
//
// Run from the repo root (where node_modules/sharp lives):
//   node games/whack-a-mole/scripts/extract-characters.mjs
//
// The source art is USER-PROVIDED (the player's own pixel art), so no external
// license applies — we are only re-cutting their sheets.

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'D:/Docs-Game/game-v/twdc-defense';
const OUT = path.join(import.meta.dirname, '..', 'art-src', 'chars');

// Grid layout of each sheet — the background-removed versions.
const SHEETS = {
  s1: { file: '1-removebg-preview.png', cols: 3, rows: 3 },
  s2: { file: '2-removebg-preview.png', cols: 3, rows: 2 },
  s3: { file: '3-removebg-preview.png', cols: 3, rows: 2 },
};

// The roster: which cell -> what game name. (r,c) is the cell. ALL 21 cells of
// the three sheets are extracted (9 + 6 + 6).
const ROSTER = [
  // --- sheet 1 (3x3) ---
  { sheet: 's1', r: 0, c: 0, name: 'cat-black' }, // black cat w/ book
  { sheet: 's1', r: 0, c: 1, name: 'bear-samurai' }, // samurai bear
  { sheet: 's1', r: 0, c: 2, name: 'schoolgirl' }, // schoolgirl
  { sheet: 's1', r: 1, c: 0, name: 'monster-green' }, // green monster
  { sheet: 's1', r: 1, c: 1, name: 'capybara' }, // capybara w/ tulips (friendly)
  { sheet: 's1', r: 1, c: 2, name: 'cat-pink' }, // pink cat w/ camera
  { sheet: 's1', r: 2, c: 0, name: 'hamster' }, // beanie hamster
  { sheet: 's1', r: 2, c: 1, name: 'alpaca' }, // alpaca (friendly)
  { sheet: 's1', r: 2, c: 2, name: 'cat-tuxedo' }, // tuxedo cat
  // --- sheet 2 (3x2) ---
  { sheet: 's2', r: 0, c: 0, name: 'man-glasses' }, // cheering man
  { sheet: 's2', r: 0, c: 1, name: 'teddy' }, // teddy w/ boba (friendly)
  { sheet: 's2', r: 0, c: 2, name: 'boy-blue' }, // blue-hair boy
  { sheet: 's2', r: 1, c: 0, name: 'cat-ragdoll' }, // ragdoll cat
  { sheet: 's2', r: 1, c: 1, name: 'rabbit' }, // crying rabbit w/ roses (friendly)
  { sheet: 's2', r: 1, c: 2, name: 'mole-boss' }, // muscular mole-bear (BOSS)
  // --- sheet 3 (3x2) ---
  { sheet: 's3', r: 0, c: 0, name: 'kid-pig' }, // pig-onesie kid
  { sheet: 's3', r: 0, c: 1, name: 'kid-panda' }, // panda-hood kid yelling
  { sheet: 's3', r: 0, c: 2, name: 'kid-cat' }, // cat-hood kid
  { sheet: 's3', r: 1, c: 0, name: 'kid-blue' }, // blue-outfit kid
  { sheet: 's3', r: 1, c: 1, name: 'woman' }, // long-hair woman
  { sheet: 's3', r: 1, c: 2, name: 'blob' }, // blue blob (friendly)
];

const TARGET_H = 96; // baked source height; on-screen scale is set in-game

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {}; // name -> {w,h}
  for (const item of ROSTER) {
    const sheet = SHEETS[item.sheet];
    const src = path.join(SRC, sheet.file);
    const m = await sharp(src).metadata();
    const cw = Math.floor(m.width / sheet.cols);
    const ch = Math.floor(m.height / sheet.rows);

    const out = path.join(OUT, `${item.name}.png`);
    // Slice the cell first; trimming a fully-bordered transparent cell can throw
    // ("bad extract area"), so trim defensively and fall back to the raw cell.
    const cellBuf = await sharp(src)
      .extract({ left: item.c * cw, top: item.r * ch, width: cw, height: ch })
      .png()
      .toBuffer();
    let trimmed;
    try {
      trimmed = await sharp(cellBuf).trim({ threshold: 1 }).png().toBuffer();
    } catch {
      trimmed = cellBuf; // nothing to trim / edge-touching content
    }
    const info = await sharp(trimmed)
      .resize({ height: TARGET_H, fit: 'inside', kernel: 'nearest' })
      .png()
      .toFile(out);
    meta[item.name] = { w: info.width, h: info.height };
    console.log(item.name.padEnd(14), `${info.width}x${info.height}`);
  }
  fs.writeFileSync(path.join(OUT, '_meta.json'), JSON.stringify(meta, null, 2));
  console.log('\nExtracted', ROSTER.length, 'characters ->', OUT);
})();
