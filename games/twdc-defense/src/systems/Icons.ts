import Phaser from 'phaser';

// Hand-drawn PIXEL-ART UI icons (project rule: NO emoji — every in-game icon is
// drawn, never a color-emoji glyph). This is a PIXEL game, so icons are authored as a
// tiny bitmap (a string grid, one char per pixel) and rendered as crisp square cells
// via fillRect — NOT smooth vector arcs — so they match the game's pixel-art tone and
// stay sharp at any integer scale. Each helper returns a Container centred on (x, y);
// the caller can setScale / tween / nest it freely.
//
// Bitmap chars → palette colours. '.' = transparent. Add chars to a per-icon palette.

type Palette = Record<string, number>;

/** Render a string-grid bitmap as square pixel cells into a Container centred on (x,y).
 *  `cell` = on-screen px per bitmap pixel. Rows are top→bottom. */
function drawPixels(
  scene: Phaser.Scene, x: number, y: number, rows: string[], palette: Palette, cell: number,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const ox = -(w * cell) / 2, oy = -(h * cell) / 2; // centre the grid on (0,0)
  for (let r = 0; r < h; r++) {
    const row = rows[r];
    for (let col = 0; col < row.length; col++) {
      const ch = row[col];
      if (ch === '.' || ch === ' ') continue;
      const colr = palette[ch];
      if (colr === undefined) continue;
      g.fillStyle(colr, 1).fillRect(ox + col * cell, oy + r * cell, cell, cell);
    }
  }
  c.add(g);
  return c;
}

// ── palettes ─────────────────────────────────────────────────────────────────────
const P_CROWN: Palette = {
  Y: 0xffd23f, // gold
  d: 0x7a5a00, // gold shadow/outline
  w: 0xffffff, // point jewels (white)
  r: 0xff3b3b, g: 0x5ee62e, b: 0x3be0ff, // band gems
};
const P_TROPHY: Palette = {
  Y: 0xffd23f, d: 0x7a5a00, l: 0xfff0a8, // gold + shadow + highlight
};
const P_LOCK: Palette = {
  S: 0xc9d4e6, d: 0x5a6478, k: 0x2a3038, // steel + shadow + keyhole
};

// ── icon bitmaps (12-wide grids; '.' transparent) ────────────────────────────────
// Crown: three points (tall centre), gold body, point jewels + band gems.
const CROWN_ROWS = [
  '.....w......',
  '..w..Y..w...',
  '.dYd.Y.dYd..',
  '.dYYdYdYYd..',
  '.dYYYYYYYd..',
  '.dYrYgYbYd..',
  '.ddddddddd..',
];
// Trophy: a cup with handles, stem, and base.
const TROPHY_ROWS = [
  'd YYYYYYY d',
  'dYlYYYYYlYd',
  'dYYYYYYYYYd',
  'dYYYYYYYYYd',
  '.dYYYYYYYd.',
  '..dYYYYYd..',
  '....dYd....',
  '...dddddd..',
  '..dddddddd.',
];
// Lock: shackle (U) on top, body, keyhole.
const LOCK_ROWS = [
  '...dddd...',
  '..d....d..',
  '..d....d..',
  '.dSSSSSSd.',
  '.dSSkkSSd.',
  '.dSSkkSSd.',
  '.dSSSkSSd.',
  '.dSSSSSSd.',
  '.dddddddd.',
];

/** A royal crown for CHAMPION markers. `size` ≈ on-screen height in px. */
export function drawCrown(scene: Phaser.Scene, x: number, y: number, size = 16): Phaser.GameObjects.Container {
  const cell = Math.max(1, Math.round(size / CROWN_ROWS.length));
  return drawPixels(scene, x, y, CROWN_ROWS, P_CROWN, cell);
}

/** A victory trophy — replaces the trophy emoji on the leaderboard title + menu. */
export function drawTrophy(scene: Phaser.Scene, x: number, y: number, size = 16): Phaser.GameObjects.Container {
  const cell = Math.max(1, Math.round(size / TROPHY_ROWS.length));
  return drawPixels(scene, x, y, TROPHY_ROWS, P_TROPHY, cell);
}

/** A padlock — replaces the lock emoji for locked maps. */
export function drawLock(scene: Phaser.Scene, x: number, y: number, size = 16): Phaser.GameObjects.Container {
  const cell = Math.max(1, Math.round(size / LOCK_ROWS.length));
  return drawPixels(scene, x, y, LOCK_ROWS, P_LOCK, cell);
}
