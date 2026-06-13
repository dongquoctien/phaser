import Phaser from 'phaser';

// A small fullscreen toggle button, reused on the Menu and the HUD. The icon is
// drawn as SOLID pixel-art via Graphics (no emoji / runtime-SVG — phaser-ui-ux §8),
// matching the reference: four chunky right-angle corner brackets.
//  - "enter" = corners point OUTWARD (⌜ ⌝ ⌞ ⌟ open — expand)
//  - "exit"  = corners point INWARD  (folding in — shrink)
// Phaser drives the actual fullscreen via scale.startFullscreen/stopFullscreen,
// which must be triggered from a user gesture (pointerdown) — handled here.

const COLOR = 0x9fe3ff; // match the mute/volume icon tint (was white)

// Authored on a 16x16 pixel grid (matches the reference). '#' = filled cell, '.' = empty.
// ENTER: four corner brackets opening OUTWARD (⌜ ⌝ ⌞ ⌟ — expand).
// EXIT : the same four brackets ROTATED 180° so they fold toward the corners (shrink).
// Integer CELL → true pixel grid (no sub-pixel seams, so no +0.5 fudge needed). The
// glyph is drawn at 16px then setScale()'d down on the container for crisp downscaling.
const CELL = 1; // 1px per grid cell → 16px glyph; container scales it to taste
const GRID = 16;
const GLYPH_SCALE = 0.8; // a touch smaller than before

const ENTER_ROWS = [
  '................',
  '................',
  '..####....####..',
  '..#..........#..',
  '..#..........#..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..#..........#..',
  '..#..........#..',
  '..####....####..',
  '................',
  '................',
];
const EXIT_ROWS = [
  '................',
  '................',
  '..#..........#..',
  '..#..........#..',
  '..####....####..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..####....####..',
  '..#..........#..',
  '..#..........#..',
  '................',
  '................',
];

/** Draw the fullscreen glyph (centred at 0,0) from a 16x16 pixel bitmap. */
function drawGlyph(scene: Phaser.Scene, exit: boolean): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLOR, 1);
  const rows = exit ? EXIT_ROWS : ENTER_ROWS;
  const o = -(GRID * CELL) / 2; // top-left so the grid is centred on (0,0)
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '#') g.fillRect(o + c * CELL, o + r * CELL, CELL, CELL);
    }
  });
  g.setScale(GLYPH_SCALE); // crisp integer-grid bitmap, scaled down a touch
  return g;
}

export interface FullscreenButtonOpts {
  x: number;
  y: number;
  depth?: number;
  onToggle?: (isFullscreen: boolean) => void;
}

/**
 * Adds a fullscreen toggle at (x,y). Returns a destroy() to clean up listeners.
 * The glyph swaps enter/exit as fullscreen state changes (incl. the browser's
 * own Esc / F11 exit, via the scale manager's events).
 */
export function addFullscreenButton(scene: Phaser.Scene, opts: FullscreenButtonOpts): () => void {
  const depth = opts.depth ?? 100;
  const container = scene.add.container(opts.x, opts.y).setDepth(depth);

  let glyph = drawGlyph(scene, scene.scale.isFullscreen);
  container.add(glyph);

  const redraw = () => {
    glyph.destroy();
    glyph = drawGlyph(scene, scene.scale.isFullscreen);
    container.add(glyph);
    opts.onToggle?.(scene.scale.isFullscreen);
  };

  // hit-zone a bit larger than the glyph for easy tapping
  const zone = scene.add.zone(opts.x, opts.y, 20, 20).setOrigin(0.5).setDepth(depth)
    .setInteractive({ useHandCursor: true });
  zone.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
    e.stopPropagation();
    if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
    else scene.scale.startFullscreen();
    // state-change events fire async; redraw both now and on the event for safety
  });

  scene.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, redraw);
  scene.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, redraw);

  const cleanup = () => {
    scene.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, redraw);
    scene.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, redraw);
    zone.destroy();
    container.destroy();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  return cleanup;
}
