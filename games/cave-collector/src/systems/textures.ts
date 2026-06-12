import Phaser from 'phaser';
import { Tex, Anim } from '../types/keys';

// ---------------------------------------------------------------------------
// Placeholder pixel-art, baked procedurally at boot.
//
// These are deliberate hand-laid pixel grids (NOT random rects) themed to the
// source frames: a flower-haired explorer, magenta slime-topped platforms, a
// glowing toxic cave, a teal sentry-bot, a white shuriken, a ? item-block with
// a star. They read clearly at 16-24px and are easy to swap for a packed atlas
// later — gameplay code only ever references the Tex.* / Anim.* constants.
//
// Palette (cohesive, source-derived):
const C = {
  none: '.', // transparent
  // skin / hero
  skin: '#c97e54',
  skinHi: '#e0a070',
  hair: '#241a2e',
  hairHi: '#3a2c4a',
  flower: '#ff5d9e',
  flowerHi: '#ffa6cf',
  dress: '#3fd47a',
  dressHi: '#7df0a8',
  belt: '#ffe14d',
  // platform (magenta)
  rock: '#c8336e',
  rockDk: '#7d1f49',
  rockLt: '#e85b95',
  slime: '#ff9ec7',
  // cave / robot (teal)
  teal: '#2f7e84',
  tealDk: '#1d4f57',
  tealLt: '#7fd6da',
  white: '#eef6f7',
  glass: '#9fe3ff',
  outline: '#10161c',
  // shiny
  gold: '#ffd23f',
  goldDk: '#e08a1e',
  star: '#fff27a',
  gem: '#ff5dc8',
  gemDk: '#b21f8a',
  qmark: '#3a2c10',
} as const;

type Grid = { grid: string[]; map: Record<string, string> };

// Parse a hex color "#rrggbb" -> [r,g,b]. Cached so we don't reparse per pixel.
const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let v = rgbCache.get(hex);
  if (!v) {
    const c = Phaser.Display.Color.HexStringToColor(hex);
    v = [c.red, c.green, c.blue];
    rgbCache.set(hex, v);
  }
  return v;
}

// Draw `frames` (laid left-to-right) into a Canvas texture via putImageData,
// which guarantees fully-transparent pixels where the grid is '.'. (Graphics +
// generateTexture bakes an opaque background under pixelArt/WebGL — the cause of
// the black boxes — so we go straight to a canvas instead.)
function paint(
  scene: Phaser.Scene,
  key: string,
  frames: Grid[],
  px: number,
): { fw: number; fh: number } {
  const fw = frames[0].grid[0].length;
  const fh = frames[0].grid.length;
  const W = fw * frames.length * px;
  const H = fh * px;
  // Build our own canvas so we control alpha exactly, then hand it to Phaser.
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H); // transparent black (0,0,0,0)
  const data = img.data;
  const put = (px0: number, py0: number, r: number, g: number, b: number) => {
    for (let dy = 0; dy < px; dy++) {
      for (let dx = 0; dx < px; dx++) {
        const i = ((py0 + dy) * W + (px0 + dx)) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
  };
  frames.forEach((f, fi) => {
    const ox = fi * fw;
    for (let y = 0; y < f.grid.length; y++) {
      const row = f.grid[y];
      for (let x = 0; x < row.length; x++) {
        const color = f.map[row[x]];
        if (!color || color[0] !== '#') continue; // '.' / unmapped = transparent
        const [r, g, b] = rgb(color);
        put((ox + x) * px, y * px, r, g, b);
      }
    }
  });
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, canvas);
  return { fw, fh };
}

// Render one pixel grid into the texture manager at `px` device-pixels/cell.
function bake(
  scene: Phaser.Scene,
  key: string,
  grid: Grid,
  px = 1,
): void {
  if (scene.textures.exists(key)) return;
  paint(scene, key, [grid], px);
}

// Bake a multi-frame texture by laying frames left-to-right into one sheet,
// then registering uniform frames so we can drive a Phaser animation off it.
function bakeSheet(
  scene: Phaser.Scene,
  key: string,
  frames: Grid[],
  px = 1,
): void {
  if (scene.textures.exists(key)) return;
  const { fw, fh } = paint(scene, key, frames, px);

  const tex = scene.textures.get(key);
  for (let i = 0; i < frames.length; i++) {
    tex.add(i, 0, i * fw * px, 0, fw * px, fh * px);
  }
}

// ---------------------------------------------------------------------------
// Sprite definitions
// ---------------------------------------------------------------------------

// HERO — 16 wide x 24 tall, faces right. Flower-haired explorer in a green
// dress. Two run frames (legs swap) + a jump pose.
const heroMap = {
  '.': C.none,
  o: C.outline,
  s: C.skin,
  h: C.skin,
  S: C.skinHi,
  H: C.hair,
  G: C.hairHi,
  f: C.flower,
  F: C.flowerHi,
  d: C.dress,
  D: C.dressHi,
  b: C.belt,
  k: C.hair, // boots
};
const heroIdle = {
  map: heroMap,
  grid: [
    '......ooo......',
    '.....oHHHo.....',
    '....oHHHHHo.fF.',
    '....oHGGHHoffF.',
    '....oHsssHoFf..',
    '....oHsSsHo....',
    '....osSsSso....',
    '.....ossso.....',
    '......ooo......',
    '.....oddo......',
    '....oddddo.....',
    '...odDddDdo....',
    '...oddbbddo....',
    '...odddddddo...',
    '...oddddddo....',
    '....oddddo.....',
    '....os..so.....',
    '....os..so.....',
    '....os..so.....',
    '....os..so.....',
    '...oks..sko....',
    '...okko.okko...',
    '...ooo...ooo...',
    '...............',
  ],
};
const heroRunA = {
  map: heroMap,
  grid: [
    '......ooo......',
    '.....oHHHo.....',
    '....oHHHHHo.fF.',
    '....oHGGHHoffF.',
    '....oHsssHoFf..',
    '....oHsSsHo....',
    '....osSsSso....',
    '.....ossso.....',
    '......ooo......',
    '.....oddo......',
    '....oddddo.....',
    '...odDddDdo....',
    '...oddbbddo....',
    '..oddddddddo...',
    '...oddddddo....',
    '....oddddo.....',
    '....os..so.....',
    '...oss..sso....',
    '..oks....sko...',
    '..okko..okko...',
    '..ooo....ooo...',
    '...............',
    '...............',
    '...............',
  ],
};
const heroRunB = {
  map: heroMap,
  grid: [
    '......ooo......',
    '.....oHHHo.....',
    '....oHHHHHo.fF.',
    '....oHGGHHoffF.',
    '....oHsssHoFf..',
    '....oHsSsHo....',
    '....osSsSso....',
    '.....ossso.....',
    '......ooo......',
    '.....oddo......',
    '....oddddo.....',
    '...odDddDdo....',
    '...oddbbddo....',
    '...odddddddo...',
    '...oddddddo....',
    '....oddddo.....',
    '.....os.so.....',
    '....oss.sso....',
    '....kso.oks....',
    '...okko.okko...',
    '...ooo...ooo...',
    '...............',
    '...............',
    '...............',
  ],
};
const heroJump = {
  map: heroMap,
  grid: [
    '......ooo......',
    '.....oHHHo.fF..',
    '....oHHHHHoffF.',
    '....oHGGHHoFf..',
    '....oHsssHo....',
    '....oHsSsHo....',
    '..o.osSsSso..o.',
    '..oso.osso.oso.',
    '..ossoooooosso.',
    '...osddddddso..',
    '....oddddddo...',
    '...odDddbDdo...',
    '...oddbbdddo...',
    '...oddddddddo..',
    '...oddddddo....',
    '....odddo......',
    '....os.so......',
    '...oss.sso.....',
    '...ks...sko....',
    '..okko.okko....',
    '..ooo...ooo....',
    '...............',
    '...............',
    '...............',
  ],
};

// ROBOT — 16x16 teal sentry with a glass dome + single eye. Two-frame idle
// (eye pulse).
const robotMap = {
  '.': C.none,
  o: C.outline,
  t: C.teal,
  T: C.tealLt,
  d: C.tealDk,
  w: C.white,
  g: C.glass,
  e: C.flower,
  E: C.flowerHi,
};
const robotA = {
  map: robotMap,
  grid: [
    '.....ooo....',
    '....ogggo...',
    '...oggwggo..',
    '...ogwwwgo..',
    '..ottttttto.',
    '..otTTTTtto.',
    '..otteettto.',
    '..ottEEttto.',
    '..otteettto.',
    '..ottttttto.',
    '..odtttttdo.',
    '...oddddddo.',
    '...o.oooo.o.',
  ],
};
const robotB = {
  map: robotMap,
  grid: [
    '.....ooo....',
    '....ogggo...',
    '...oggwggo..',
    '...ogwwwgo..',
    '..ottttttto.',
    '..otTTTTtto.',
    '..otttttto.o',
    '..otteettto.',
    '..ottEEttto.',
    '..ottttttto.',
    '..odtttttdo.',
    '...oddddddo.',
    '...o.oooo.o.',
  ],
};

// SHURIKEN — 12x12 white spinning star. 4 rotation frames.
const shMap = { '.': C.none, o: C.outline, w: C.white, t: C.tealLt };
const shuriken = (i: number): Grid => {
  const fr = [
    [
      '.....oo.....',
      '....owwo....',
      '....owwo....',
      'oo..owwo..oo',
      'owwoowwoowwo',
      '.owwwwwwwwo.',
      '.owwwwwwwwo.',
      'owwoowwoowwo',
      'oo..owwo..oo',
      '....owwo....',
      '....owwo....',
      '.....oo.....',
    ],
    [
      '..o......o..',
      '.owwo..owwo.',
      '..owwooowwo.',
      '...owwwwwo..',
      '..owwwwwwwo.',
      'owwwwwwwwwwo',
      'owwwwwwwwwwo',
      '.owwwwwwwo..',
      '..owwwwwo...',
      '.owwooowwo..',
      '.owwo..owwo.',
      '..o......o..',
    ],
  ];
  return { map: shMap, grid: fr[i % 2] };
};

// ? ITEM BLOCK — 16x16 dark-outlined box with a pink gem + star. Plus an
// "used" (emptied) variant.
const blockMap = {
  '.': C.none,
  o: C.outline,
  g: C.gem,
  G: C.gemDk,
  s: C.star,
  q: C.qmark,
  r: C.goldDk,
};
const block = {
  map: blockMap,
  grid: [
    'oooooooooooooooo',
    'oGGGGGGGGGGGGGGo',
    'oGggggggggggggGo',
    'oGgg..ssss..ggGo',
    'oGg..sssssss.gGo',
    'oGg.ssssqssss.go',
    'oGg.sssqqqsss.go',
    'oGg.ssqqsqqss.go',
    'oGg.sqq.s.qqs.go',
    'oGg.q.sssss.q.go',
    'oGg..sssssss..go',
    'oGgg.ssssss..gGo',
    'oGgggg....ggggGo',
    'oGGggggggggggGGo',
    'orGGGGGGGGGGGGro',
    'oooooooooooooooo',
  ],
};
const blockUsed = {
  map: { '.': C.none, o: C.outline, d: C.tealDk, t: C.teal },
  grid: [
    'oooooooooooooooo',
    'oddddddddddddddo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'odttttttttttttdo',
    'oddddddddddddddo',
    'oooooooooooooooo',
  ],
};

// STAR — 10x10 gold collectible, 2-frame twinkle.
const starMap = { '.': C.none, o: C.outline, s: C.star, g: C.gold, d: C.goldDk };
const starA = {
  map: starMap,
  grid: [
    '....oo....',
    '....ss....',
    '...osso...',
    '.oosssoo..',
    'osssssssso',
    '.ogsssssgo',
    '..oggggo..',
    '..og..go..',
    '.oo....oo.',
    '..o....o..',
  ],
};
const starB = {
  map: starMap,
  grid: [
    '....o.....',
    '....s.....',
    '...oso....',
    '..ossso...',
    'oosssssoo.',
    '.ogssssgo.',
    '..oggggo..',
    '..o.gg.o..',
    '..oo..oo..',
    '...o..o...',
  ],
};

// COIN — 8x8 small gold, 3-frame spin (round -> edge -> round).
const coinMap = { '.': C.none, o: C.outline, g: C.gold, s: C.star, d: C.goldDk };
const coinWide = {
  map: coinMap,
  grid: [
    '..oooo..',
    '.ogssgo.',
    'ogsssgo.',
    'ogsssgo.',
    'ogggggo.',
    'odgggdo.',
    '.odddo..',
    '..oooo..',
  ],
};
const coinMid = {
  map: coinMap,
  grid: [
    '...oo...',
    '..oggo..',
    '..osgo..',
    '..osgo..',
    '..oggo..',
    '..odgo..',
    '..oddo..',
    '...oo...',
  ],
};
const coinThin = {
  map: coinMap,
  grid: [
    '...o....',
    '...go...',
    '...sg...',
    '...sg...',
    '...gg...',
    '...dg...',
    '...do...',
    '...o....',
  ],
};

// DOOR — 20x28 stone exit with a teal glow.
const doorMap = {
  '.': C.none,
  o: C.outline,
  r: C.rockDk,
  R: C.rock,
  L: C.rockLt,
  g: C.tealLt,
  G: C.glass,
};
const door = {
  map: doorMap,
  grid: [
    '....oooooooooo....',
    '...orrrrrrrrrro...',
    '..orRRRRRRRRRRro..',
    '.orRLLLLLLLLLLRro.',
    'orRLgggggggggLLRro',
    'orRLgGGGGGGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGgg..GGgLLRro',
    'orRLgGgg..GGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgGggggGGgLLRro',
    'orRLgggggggggLLRro',
    'orRLLLLLLLLLLLLRro',
    'orRRRRRRRRRRRRRRro',
    'orrrrrrrrrrrrrrrro',
    '.oooooooooooooooo.',
    '..o............o..',
    '..o............o..',
  ],
};

// GROUND TILE — 16x16 magenta rock with a slime-drip top edge. Tiles
// seamlessly left-right; the top row reads as the platform surface.
const tileMap = {
  '.': C.none,
  o: C.outline,
  s: C.slime,
  r: C.rock,
  R: C.rockLt,
  d: C.rockDk,
};
const tileGround = {
  map: tileMap,
  grid: [
    'ssssssssssssssss',
    'sRRsRRRsRRsRRRsR',
    'rRrrRRrrRrrRRrrR',
    'rrrrrrrrrrrrrrrr',
    'rrdrrrrrdrrrrdrr',
    'rrrrddrrrrddrrrr',
    'rdrrrrrrdrrrrrrd',
    'rrrrrdrrrrrrdrrr',
    'rrddrrrrrddrrrrr',
    'drrrrrrdrrrrrrdr',
    'rrrrddrrrrddrrrr',
    'rrdrrrrdrrrrdrrr',
    'rrrrrrrrrrrrrrrr',
    'drrddrrrddrrddrr',
    'rddrrddrrddrrddr',
    'rrrrrrrrrrrrrrrr',
  ],
};

// SPARK — 3x3 particle (used for block-hit + collect bursts).
const spark = {
  map: { '.': C.none, s: C.star },
  grid: ['.s.', 'sss', '.s.'],
};

// HEART — 9x8 life icon.
const heart = {
  map: { '.': C.none, o: C.outline, h: C.flower, H: C.flowerHi },
  grid: [
    '.oo.oo...',
    'oHHohHo..',
    'oHhhhhHo.',
    'oHhhhhHo.',
    '.oHhhHo..',
    '..oHHo...',
    '...oo....',
    '.........',
  ],
};

// ---------------------------------------------------------------------------
// Public: bake everything + register animations. Call once in BootScene.
// ---------------------------------------------------------------------------
export function bakeAllTextures(scene: Phaser.Scene): void {
  bakeSheet(scene, Tex.Hero, [heroIdle, heroRunA, heroRunB, heroJump]);
  bakeSheet(scene, Tex.Robot, [robotA, robotB]);
  bakeSheet(scene, Tex.Shuriken, [shuriken(0), shuriken(1), shuriken(0), shuriken(1)]);
  bakeSheet(scene, Tex.Star, [starA, starB]);
  bakeSheet(scene, Tex.Coin, [coinWide, coinMid, coinThin, coinMid]);

  bake(scene, Tex.Block, block);
  bake(scene, Tex.BlockUsed, blockUsed);
  bake(scene, Tex.Door, door);
  bake(scene, Tex.TileGround, tileGround);
  bake(scene, Tex.Spark, spark, 1);
  bake(scene, Tex.Heart, heart);
}

export function registerAnims(scene: Phaser.Scene): void {
  const a = scene.anims;
  if (!a.exists(Anim.HeroIdle)) {
    a.create({ key: Anim.HeroIdle, frames: [{ key: Tex.Hero, frame: 0 }], frameRate: 1, repeat: -1 });
    a.create({ key: Anim.HeroRun, frames: [{ key: Tex.Hero, frame: 1 }, { key: Tex.Hero, frame: 2 }], frameRate: 10, repeat: -1 });
    a.create({ key: Anim.HeroJump, frames: [{ key: Tex.Hero, frame: 3 }], frameRate: 1, repeat: -1 });
    a.create({ key: Anim.RobotIdle, frames: a.generateFrameNumbers(Tex.Robot, { start: 0, end: 1 }), frameRate: 3, repeat: -1 });
    a.create({ key: Anim.ShurikenSpin, frames: a.generateFrameNumbers(Tex.Shuriken, { start: 0, end: 3 }), frameRate: 18, repeat: -1 });
    a.create({ key: Anim.StarSpin, frames: a.generateFrameNumbers(Tex.Star, { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
    a.create({ key: Anim.CoinSpin, frames: a.generateFrameNumbers(Tex.Coin, { start: 0, end: 3 }), frameRate: 12, repeat: -1 });
  }
}
