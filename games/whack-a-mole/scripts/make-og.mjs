// Build the Open Graph share image (og.png, 1200x630) — a grassy landscape with
// the game title on the left and the cover art (mole-bear + red swatter) on the
// right. Used by the <meta og:image> tags in index.html so shared links show a
// thumbnail. Run after make-cover.mjs (it reuses cover.png).
//
//   node games/whack-a-mole/scripts/make-og.mjs

import sharp from 'sharp';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const COVER = path.join(ROOT, 'cover.png');
// og.png lives in public/ so Vite copies it to dist/whack-a-mole/og.png — that's
// the absolute URL the <meta og:image> tags point at.
const OUT = path.join(ROOT, 'public', 'og.png');

const W = 1200;
const H = 630;

function bgSvg() {
  let blades = '';
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 120; i++) {
    const x = rnd() * W;
    const y = 120 + rnd() * (H - 120);
    const col = rnd() > 0.5 ? '#57a234' : '#8fd457';
    blades += `<polygon points="${x - 3},${y} ${x},${y - 9} ${x + 3},${y}" fill="${col}"/>`;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#96d24f"/>
        <stop offset="1" stop-color="#67ad34"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <ellipse cx="600" cy="240" rx="900" ry="80" fill="#7cc043" opacity="0.45"/>
    <ellipse cx="600" cy="470" rx="950" ry="90" fill="#7cc043" opacity="0.45"/>
    ${blades}
  </svg>`);
}

function titleSvg() {
  // big stroked title, left-aligned, with the TWDC tag above
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <style>
      .tag { font: 800 54px monospace; fill: #ffe14d; stroke: #2f5418; stroke-width: 8px; paint-order: stroke; letter-spacing: 10px; }
      .t1  { font: 800 116px monospace; fill: #ffffff; stroke: #2f5418; stroke-width: 12px; paint-order: stroke; }
      .sub { font: 700 34px monospace; fill: #2f4a18; }
    </style>
    <text x="70" y="210" class="tag">TWDC</text>
    <text x="66" y="320" class="t1">WHACK</text>
    <text x="66" y="430" class="t1">-A-CHAR</text>
    <text x="72" y="500" class="sub">Bonk the cheeky ones — spare the sweet!</text>
  </svg>`);
}

(async () => {
  // cover art scaled up and placed on the right
  const cover = await sharp(COVER).resize({ height: 560, kernel: 'nearest' }).png().toBuffer();
  const cm = await sharp(cover).metadata();

  await sharp(bgSvg())
    .composite([
      { input: titleSvg(), left: 0, top: 0 },
      { input: cover, left: W - cm.width - 60, top: Math.round((H - cm.height) / 2) },
    ])
    .png({ compressionLevel: 9 })
    .toFile(OUT);
  console.log('Wrote', OUT, `${W}x${H}`);
})();
