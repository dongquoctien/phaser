// Cut a green-screen zombie reference image into clean transparent spritesheets
// (a "stand" sheet + a wide "lie" sheet for death/rise). Chroma-keys the green
// bg, tight-crops each labeled frame by an explicit box, normalizes to a uniform
// cell per sheet, lays rows out for Phaser load.spritesheet.
//
//   npm i -D jpeg-js pngjs       # one-time (dev-only; not shipped)
//   node scripts/cut-zombie-sheet.mjs [girl|boss|speed|all]   (default: all)
//
// Sources live in assets-src/twdc-defense/. Outputs to public/enemies/.
// Frame boxes were derived from connected-component analysis; re-run after
// editing a SHEETS entry if you swap the source art.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OUT = 'games/twdc-defense/public/enemies';

// Per-sheet config: source file, bg detector, and rows of explicit frame boxes
// split into STAND (tall) and LIE (wide) groups (each becomes one PNG).
const SHEETS = {
  girl: {
    src: 'assets-src/twdc-defense/zombie-sheet-ref.jpeg',
    bg: (r, g, b, a) => a < 40 || (g > 105 && g - r > 22 && g - b > 22),
    stand: {
      idle: [[26,34,125,162],[182,34,283,162],[337,34,438,162],[492,34,594,162]],
      walk: [[25,200,112,329],[180,200,268,329],[338,200,426,329],[493,200,580,329],[648,200,736,329],[805,200,893,329]],
      attackA: [[24,363,117,487],[174,363,281,487],[320,363,431,487],[472,363,575,487],[613,363,708,487]],
      attackB: [[22,520,130,641],[180,520,289,641],[341,520,446,641],[490,520,603,641],[653,520,751,641],[803,520,905,641]],
      takeDamage: [[19,675,131,806],[181,675,289,806],[334,675,435,806]],
      victory: [[34,994,140,1130],[187,994,296,1130],[343,994,451,1130],[503,994,611,1130]],
    },
    lie: {
      death: [[334,675,435,806],[392,775,544,843],[575,775,727,843]],
      rise: [[24,888,177,960],[210,893,363,960],[406,888,556,960],[616,856,724,961],[789,824,890,961]],
    },
  },
  // boss.png shares the girl layout exactly (same 928x1131 green sheet).
  boss: {
    src: 'assets-src/twdc-defense/boss.png',
    bg: (r, g, b, a) => a < 40 || (g > 105 && g - r > 22 && g - b > 22),
    stand: {
      idle: [[26,34,125,162],[182,34,283,162],[337,34,438,162],[492,34,594,162]],
      walk: [[25,200,112,329],[180,200,268,329],[338,200,426,329],[493,200,580,329],[648,200,736,329],[805,200,893,329]],
      attackA: [[24,363,117,487],[174,363,281,487],[320,363,431,487],[472,363,575,487],[613,363,708,487]],
      attackB: [[22,520,130,641],[180,520,289,641],[341,520,446,641],[490,520,603,641],[653,520,751,641],[803,520,905,641]],
      takeDamage: [[19,675,131,806],[181,675,289,806],[334,675,435,806]],
      victory: [[34,994,140,1130],[187,994,296,1130],[343,994,451,1130],[503,994,611,1130]],
    },
    lie: {
      death: [[334,675,435,806],[392,775,544,843],[575,775,727,843]],
      rise: [[24,888,177,960],[210,893,363,960],[406,888,556,960],[616,856,724,961],[789,824,890,961]],
    },
  },
  // brute.png (schoolgirl with a yellow satchel) — same girl layout, green sheet.
  brute: {
    src: 'assets-src/twdc-defense/brute.png',
    bg: (r, g, b, a) => a < 40 || (g > 105 && g - r > 22 && g - b > 22),
    stand: {
      idle: [[26,34,125,162],[182,34,283,162],[337,34,438,162],[492,34,594,162]],
      walk: [[25,200,112,329],[180,200,268,329],[338,200,426,329],[493,200,580,329],[648,200,736,329],[805,200,893,329]],
      attackA: [[24,363,117,487],[174,363,281,487],[320,363,431,487],[472,363,575,487],[613,363,708,487]],
      attackB: [[22,520,130,641],[180,520,289,641],[341,520,446,641],[490,520,603,641],[653,520,751,641],[803,520,905,641]],
      takeDamage: [[19,675,131,806],[181,675,289,806],[334,675,435,806]],
      victory: [[34,994,140,1130],[187,994,296,1130],[343,994,451,1130],[503,994,611,1130]],
    },
    lie: {
      death: [[334,675,435,806],[392,775,544,843],[575,775,727,843]],
      rise: [[24,888,177,960],[210,893,363,960],[406,888,556,960],[616,856,724,961],[789,824,890,961]],
    },
  },
  // khoai.png — Normal-map boss (bearded zombie king w/ red cape). Green bg.
  // 6 rows: idle(4) / walk(6) / attackA-cape(4) / attackB-bite(4) / damage+death.
  khoai: {
    src: 'assets-src/twdc-defense/Khoai-zombie-Boss.png',
    bg: (r, g, b, a) => a < 40 || (g > 85 && g - r > 20 && g - b > 15),
    stand: {
      idle: [[46,46,245,234],[276,46,496,234],[514,46,751,234],[765,46,993,234]],
      walk: [[43,263,173,427],[196,263,337,425],[363,263,493,427],[502,263,662,425],[681,263,823,425],[844,263,973,427]],
      attackA: [[66,455,233,609],[294,455,470,609],[542,455,763,609],[804,455,982,609]],
      attackB: [[28,634,251,788],[266,629,486,782],[517,629,743,783],[757,632,980,785]],
      takeDamage: [[25,867,205,1008],[216,872,394,1009]],
      victory: [[46,46,245,234],[276,46,496,234],[514,46,751,234],[765,46,993,234]],
    },
    lie: {
      death: [[405,788,642,1011],[606,921,804,1006],[831,936,993,1005]],
      rise: [[405,788,642,1011],[606,921,804,1006],[831,936,993,1005]],
    },
  },
  // hakj.png — Hard-map boss (crowned fish zombie). Green bg. 3-col layout:
  // idle(3) / move(3) / attack(3) / death(3). No separate attackB/rise.
  hakj: {
    src: 'assets-src/twdc-defense/zombie-boss-hakj.png',
    bg: (r, g, b, a) => a < 40 || (g > 90 && g - r > 25 && g - b > 20),
    stand: {
      idle: [[178,23,384,223],[453,20,660,223],[725,23,929,223]],
      walk: [[177,242,386,466],[456,242,663,469],[728,242,937,466]],
      attackA: [[172,488,404,706],[456,490,697,706],[741,491,968,707]],
      attackB: [[172,488,404,706],[456,490,697,706],[741,491,968,707]],
      takeDamage: [[157,729,369,947],[461,781,714,947]],
      victory: [[178,23,384,223],[453,20,660,223],[725,23,929,223]],
    },
    lie: {
      death: [[157,729,369,947],[461,781,714,947],[751,826,980,947]],
      rise: [[157,729,369,947],[461,781,714,947],[751,826,980,947]],
    },
  },
  // zombie-normal.png — orange chainsaw critter minion. Bright-green sheet, rows:
  // idle(4) / shuffle-walk(6) / attack(5) / take-damage(3) / death(4). No attackB/
  // victory/rise in the source → alias them (B→A, victory→idle, rise→death).
  chainsaw: {
    src: 'assets-src/twdc-defense/zombie-normal.png',
    bg: (r, g, b, a) => a < 40 || (g > 105 && g - r > 22 && g - b > 22),
    stand: {
      idle: [[25,55,174,193],[205,55,361,193],[384,55,533,193],[560,55,706,193]],
      walk: [[6,232,203,394],[204,232,369,394],[370,236,533,394],[545,236,706,394],[716,236,876,394],[883,236,1041,394]],
      attackA: [[24,458,216,596],[226,458,427,596],[437,458,632,596],[637,458,833,596],[838,458,1038,596]],
      attackB: [[24,458,216,596],[226,458,427,596],[437,458,632,596],[637,458,833,596],[838,458,1038,596]],
      takeDamage: [[33,658,220,795],[231,658,433,795],[444,658,634,795]],
      victory: [[25,55,174,193],[205,55,361,193],[384,55,533,193],[560,55,706,193]],
    },
    lie: {
      death: [[31,860,242,999],[281,860,500,999],[544,880,768,999],[811,882,1037,999]],
      rise: [[31,860,242,999],[281,860,500,999],[544,880,768,999],[811,882,1037,999]],
    },
  },
  // speed.png (bucket-head). Darker green bg; different layout (no attackA/B/rise).
  speed: {
    src: 'assets-src/twdc-defense/speed.png',
    bg: (r, g, b, a) => a < 40 || (g > 95 && g - r > 18 && g - b > 18),
    stand: {
      idle: [[86,52,188,229],[302,52,404,229],[516,52,618,229],[733,52,835,229]],
      walk: [[51,272,150,439],[194,272,292,439],[336,272,430,439],[482,272,581,439],[627,272,726,439],[772,272,870,439]],
      attack: [[69,485,192,639],[242,485,366,639],[406,487,519,639],[581,486,706,639],[752,485,872,639]],
      takeDamage: [[68,676,176,826],[239,676,346,826],[414,679,513,826]],
      victory: [[74,996,184,1130],[251,996,357,1130],[423,996,531,1130]],
    },
    lie: {
      death: [[48,863,219,956],[259,876,433,956],[492,866,659,956],[710,880,868,956]],
    },
  },
};

function loadRGBA(path) {
  if (path.endsWith('.png')) {
    const p = PNG.sync.read(readFileSync(path));
    return { W: p.width, H: p.height, data: p.data };
  }
  // jpeg: lazy import so PNG-only runs don't need jpeg-js installed
  const jpeg = require('jpeg-js');
  const raw = jpeg.decode(readFileSync(path), { useTArray: true });
  return { W: raw.width, H: raw.height, data: raw.data };
}

function cut(name, cfg) {
  if (!existsSync(cfg.src)) { console.log(`SKIP ${name}: missing ${cfg.src}`); return; }
  const { W, H, data } = loadRGBA(cfg.src);
  const isBg = (i) => cfg.bg(data[i], data[i + 1], data[i + 2], data[i + 3]);

  const cropRegion = (x0, y0, x1, y1) => {
    let mnx = x1, mxx = x0, mny = y1, mxy = y0, any = false;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!isBg((y * W + x) * 4)) { any = true; if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
    }
    if (!any) return null;
    const w = mxx - mnx + 1, h = mxy - mny + 1, out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const si = ((mny + y) * W + (mnx + x)) * 4, di = (y * w + x) * 4;
      if (isBg(si)) out[di + 3] = 0;
      else { out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = 255; }
    }
    return { pixels: out, w, h };
  };

  const buildSheet = (group, outPng) => {
    if (!group) return null;
    const rows = Object.entries(group).map(([anim, boxes]) => ({
      anim, frames: boxes.map(b => cropRegion(b[0], b[1], b[2], b[3])).filter(Boolean),
    }));
    let CW = 0, CH = 0;
    for (const r of rows) for (const f of r.frames) { CW = Math.max(CW, f.w); CH = Math.max(CH, f.h); }
    CW += 4; CH += 4;
    const COLS = Math.max(...rows.map(r => r.frames.length));
    const sheetW = CW * COLS, sheetH = CH * rows.length;
    const sheet = new PNG({ width: sheetW, height: sheetH });
    sheet.data.fill(0);
    const blit = (f, cx, cy) => {
      const ox = cx + Math.floor((CW - f.w) / 2), oy = cy + (CH - f.h) - 2;
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
        const si = (y * f.w + x) * 4; if (f.pixels[si + 3] === 0) continue;
        const di = ((oy + y) * sheetW + (ox + x)) * 4;
        for (let k = 0; k < 4; k++) sheet.data[di + k] = f.pixels[si + k];
      }
    };
    const meta = {};
    rows.forEach((r, ri) => { meta[r.anim] = { row: ri, frames: r.frames.length }; r.frames.forEach((f, ci) => blit(f, ci * CW, ri * CH)); });
    writeFileSync(outPng, PNG.sync.write(sheet));
    return { cellW: CW, cellH: CH, cols: COLS, rows: rows.length, anims: meta };
  };

  const stand = buildSheet(cfg.stand, `${OUT}/zombie-${name}-stand.png`);
  const lie = buildSheet(cfg.lie, `${OUT}/zombie-${name}-lie.png`);
  console.log(name, 'STAND', JSON.stringify(stand));
  if (lie) console.log(name, 'LIE  ', JSON.stringify(lie));
}

const which = process.argv[2] || 'all';
const names = which === 'all' ? Object.keys(SHEETS) : [which];
for (const n of names) cut(n, SHEETS[n]);
