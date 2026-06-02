// Cut the green-screen zombie-girl reference JPEG into two clean transparent
// spritesheets (standing anims + lying death/rise). Chroma-keys the green bg,
// tight-crops each labeled frame by an explicit box, normalizes to a uniform
// cell per sheet, and lays rows out for Phaser load.spritesheet.
//
//   npm i -D jpeg-js pngjs   # one-time (dev-only; not shipped)
//   node scripts/cut-zombie-sheet.mjs
//
// Source: assets-src/twdc-defense/zombie-sheet-ref.jpeg (the master reference).
// Output: games/twdc-defense/public/enemies/zombie-girl-{stand,lie}.png
// Frame boxes were derived from connected-component analysis of the reference;
// re-run after editing ROWS if you swap the source art.
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'assets-src/twdc-defense/zombie-sheet-ref.jpeg';
const OUT = 'games/twdc-defense/public/enemies';
const raw = jpeg.decode(readFileSync(SRC), { useTArray: true });
const { width: W, height: H, data } = raw;

// green-screen test tuned to the ~rgb(45,165,70) bg (also removes JPEG halo).
const isBg = (r, g, b) => g > 105 && g - r > 22 && g - b > 22;

// explicit [x0,y0,x1,y1] frame boxes per animation row (irregular sheet layout).
const ROWS = [
  { name: 'idle',    boxes: [[26,34,125,162],[182,34,283,162],[337,34,438,162],[492,34,594,162]] },
  { name: 'walk',    boxes: [[25,200,112,329],[180,200,268,329],[338,200,426,329],[493,200,580,329],[648,200,736,329],[805,200,893,329]] },
  { name: 'attackA', boxes: [[24,363,117,487],[174,363,281,487],[320,363,431,487],[472,363,575,487],[613,363,708,487]] },
  { name: 'attackB', boxes: [[22,520,130,641],[180,520,289,641],[341,520,446,641],[490,520,603,641],[653,520,751,641],[803,520,905,641]] },
  { name: 'takeDamage', boxes: [[19,675,131,806],[181,675,289,806],[334,675,435,806]] },
  { name: 'death', boxes: [[334,675,435,806],[392,775,544,843],[575,775,727,843]] },
  { name: 'rise', boxes: [[24,888,177,960],[210,893,363,960],[406,888,556,960],[616,856,724,961],[789,824,890,961]] },
  { name: 'victory', boxes: [[34,994,140,1130],[187,994,296,1130],[343,994,451,1130],[503,994,611,1130]] },
];

function cropRegion(x0, x1, y0, y1) {
  let minX = x1, maxX = x0, minY = y1, maxY = y0, any = false;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * W + x) * 4;
    if (!isBg(data[i], data[i + 1], data[i + 2])) {
      any = true;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!any) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((minY + y) * W + (minX + x)) * 4, di = (y * w + x) * 4;
    const r = data[si], g = data[si + 1], b = data[si + 2];
    if (isBg(r, g, b)) out[di + 3] = 0;
    else { out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 255; }
  }
  return { pixels: out, w, h };
}

const rowFrames = ROWS.map(row => ({
  name: row.name,
  frames: row.boxes.map(([x0, y0, x1, y1]) => cropRegion(x0, x1, y0, y1)).filter(Boolean),
}));

function buildSheet(names, outPng) {
  const rows = rowFrames.filter(r => names.includes(r.name));
  let CW = 0, CH = 0;
  for (const r of rows) for (const f of r.frames) { CW = Math.max(CW, f.w); CH = Math.max(CH, f.h); }
  CW += 4; CH += 4;
  const COLS = Math.max(...rows.map(r => r.frames.length));
  const sheetW = CW * COLS, sheetH = CH * rows.length;
  const sheet = new PNG({ width: sheetW, height: sheetH });
  sheet.data.fill(0);
  const blit = (frame, cx, cy) => {
    const ox = cx + Math.floor((CW - frame.w) / 2), oy = cy + (CH - frame.h) - 2;
    for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) {
      const si = (y * frame.w + x) * 4;
      if (frame.pixels[si + 3] === 0) continue;
      const di = ((oy + y) * sheetW + (ox + x)) * 4;
      for (let k = 0; k < 4; k++) sheet.data[di + k] = frame.pixels[si + k];
    }
  };
  const anims = {};
  rows.forEach((r, ri) => { anims[r.name] = { row: ri, frames: r.frames.length }; r.frames.forEach((f, ci) => blit(f, ci * CW, ri * CH)); });
  writeFileSync(outPng, PNG.sync.write(sheet));
  return { cellW: CW, cellH: CH, cols: COLS, rows: rows.length, anims };
}

const stand = buildSheet(['idle', 'walk', 'attackA', 'attackB', 'takeDamage', 'victory'], `${OUT}/zombie-girl-stand.png`);
const lie = buildSheet(['death', 'rise'], `${OUT}/zombie-girl-lie.png`);
console.log('STAND', JSON.stringify(stand));
console.log('LIE  ', JSON.stringify(lie));
