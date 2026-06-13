import Phaser from 'phaser';

// A small fullscreen toggle button, reused on the Menu and the HUD. The icon is
// drawn as pixel-art via Graphics (no emoji / runtime-SVG — phaser-ui-ux §8):
//  - "enter" = four corner brackets pointing OUT  (⌜ ⌝ ⌞ ⌟ open)
//  - "exit"  = four corner brackets pointing IN   (arrows folding inward)
// Phaser drives the actual fullscreen via scale.startFullscreen/stopFullscreen,
// which must be triggered from a user gesture (pointerdown) — handled here.

const TINT = 0x9fe3ff;

/** Draw the 4-corner fullscreen glyph into a container at (0,0), centred. */
function drawGlyph(scene: Phaser.Scene, exit: boolean): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(1.5, TINT, 1);
  const s = 5;   // arm length
  const o = 5;   // offset from center to each corner
  // corners: [cornerX, cornerY, dirX, dirY] — dir points toward the corner (outward)
  const corners = [
    [-o, -o, -1, -1], [o, -o, 1, -1], [-o, o, -1, 1], [o, o, 1, 1],
  ];
  for (const [cxp, cyp, dx, dy] of corners) {
    if (!exit) {
      // ENTER: bracket sits at the corner, arms run inward from the corner point.
      g.beginPath();
      g.moveTo(cxp, cyp); g.lineTo(cxp - dx * s, cyp);          // horizontal arm
      g.moveTo(cxp, cyp); g.lineTo(cxp, cyp - dy * s);          // vertical arm
      g.strokePath();
    } else {
      // EXIT: bracket sits inset, arms run outward toward the corner (folding in).
      const ix = cxp - dx * s, iy = cyp - dy * s;
      g.beginPath();
      g.moveTo(ix, iy); g.lineTo(ix + dx * s, iy);
      g.moveTo(ix, iy); g.lineTo(ix, iy + dy * s);
      g.strokePath();
    }
  }
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
