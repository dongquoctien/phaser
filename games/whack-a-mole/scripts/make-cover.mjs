// Compose the hub cover.png from the real game art: a grassy field, a hole with
// the mole-boss character emerging from behind the front dirt rim, and a mallet
// poised above — the canonical whack-a-mole icon composition. 3:4 portrait to
// match the hub card's aspect-ratio.
//
//   node games/whack-a-mole/scripts/make-cover.mjs

import sharp from 'sharp';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const CHARS = path.join(ROOT, 'art-src', 'chars');
const OUT = path.join(ROOT, 'cover.png');

const W = 360;
const H = 480; // 3:4

// upscale a pixel char by an integer factor with nearest-neighbor
async function bigChar(name, factor) {
  const src = sharp(path.join(CHARS, `${name}.png`));
  const m = await src.metadata();
  return {
    buf: await src.resize({ width: m.width * factor, kernel: 'nearest' }).png().toBuffer(),
    w: m.width * factor,
    h: m.height * factor,
  };
}

// flat-ish pixel hole + front rim, drawn as an SVG then rasterized
function fieldAndHoleSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#9fd95f"/>
        <stop offset="1" stop-color="#69b53f"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <!-- grass bands -->
    <ellipse cx="${W / 2}" cy="200" rx="280" ry="40" fill="#76bd49" opacity="0.5"/>
    <ellipse cx="${W / 2}" cy="330" rx="300" ry="46" fill="#76bd49" opacity="0.5"/>
    <!-- hole opening -->
    <ellipse cx="${W / 2}" cy="330" rx="120" ry="48" fill="#3a2519"/>
    <ellipse cx="${W / 2}" cy="332" rx="100" ry="38" fill="#1c100a"/>
  </svg>`);
}

// the front dirt rim (drawn over the character's feet), as SVG
function rimSvg() {
  const cx = W / 2;
  let tufts = '';
  for (const dx of [-96, -64, -32, 0, 32, 64, 96]) {
    tufts += `<polygon points="${cx + dx - 6},356 ${cx + dx},340 ${cx + dx + 6},356" fill="#4f9a31"/>`;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <path d="M ${cx - 122} 356 A 122 30 0 0 0 ${cx + 122} 356 L ${cx + 122} 372 A 122 26 0 0 1 ${cx - 122} 372 Z" fill="#6b4a32"/>
    <ellipse cx="${cx}" cy="360" rx="118" ry="20" fill="#86603f"/>
    ${tufts}
  </svg>`);
}

(async () => {
  const hero = await bigChar('mole-boss', 2); // the muscular mole-bear — perfect mascot
  // RED flyswatter, matching the in-game default weapon (red perforated pad on a
  // light handle)
  const holes = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    holes.push(`<circle cx="${30 + c * 17}" cy="${24 + r * 16}" r="5" fill="#6e0c0e"/>`);
  }
  const mallet = await sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="210">
      <!-- handle -->
      <rect x="64" y="86" width="16" height="116" rx="7" fill="#7d8a93"/>
      <rect x="68" y="88" width="6" height="108" fill="#a8b4bc"/>
      <!-- red pad -->
      <rect x="6" y="6" width="132" height="92" rx="26" fill="#7a0f12"/>
      <rect x="11" y="11" width="122" height="82" rx="22" fill="#e23c33"/>
      <rect x="20" y="18" width="104" height="16" rx="8" fill="#f26a5e"/>
      ${holes.join('')}
      <rect x="63" y="86" width="18" height="16" rx="5" fill="#5a6670"/>
    </svg>`),
  )
    .rotate(24, { background: { r: 0, g: 0, b: 0, alpha: 0 } }) // tilt for a "swing" pose
    .png()
    .toBuffer();

  // emerge: hero bottom hidden behind the rim. Place hero so its feet are ~y=360.
  const heroTop = 360 - hero.h + 18;

  await sharp(fieldAndHoleSvg())
    .composite([
      { input: hero.buf, left: Math.round(W / 2 - hero.w / 2), top: Math.round(heroTop) },
      { input: rimSvg(), left: 0, top: 0 }, // rim over the feet
      { input: mallet, left: W / 2 - 4, top: 90, blend: 'over' }, // swatter, tilted
    ])
    .png({ compressionLevel: 9 })
    .toFile(OUT);
  console.log('Wrote', OUT, `${W}x${H}`);
})();
