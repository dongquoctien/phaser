// Phaser smoke-test probe. Paste the body of `probe()` (or the whole IIFE) into
// a Playwright `browser_evaluate` call. It reads the live Phaser.Game instance
// exposed as window.__PHASER_GAME__ and returns a JSON verdict — no game code
// changes needed beyond exposing that handle in dev.
//
// FPS needs ~2s of running to be meaningful, so the evaluate call should be made
// AFTER the game has been visible for a couple of seconds (wait first, then run).

(function probe() {
  const game = /** @type {any} */ (window).__PHASER_GAME__;
  const out = {
    booted: false,
    sceneKeys: [],
    activeScene: null,
    canvasOk: false,
    rendererType: null,
    fps: null,
    errors: [],
  };

  if (!game) {
    out.errors.push('window.__PHASER_GAME__ is undefined — expose it in main.ts (dev only).');
    return out;
  }

  // Scenes
  try {
    const scenes = game.scene.getScenes(false); // all scenes
    out.sceneKeys = scenes.map((s) => s.scene.key);
    const active = game.scene.getScenes(true); // only running
    out.activeScene = active.length ? active[active.length - 1].scene.key : null;
    out.booted = active.length > 0;
  } catch (e) {
    out.errors.push('scene introspection failed: ' + e);
  }

  // Canvas + renderer
  try {
    const c = game.canvas;
    out.canvasOk = !!c && c.width > 0 && c.height > 0;
    out.rendererType =
      game.renderer && game.renderer.type === Phaser.WEBGL
        ? 'WEBGL'
        : game.renderer && game.renderer.type === Phaser.CANVAS
          ? 'CANVAS'
          : 'UNKNOWN';
  } catch (e) {
    out.errors.push('canvas/renderer check failed: ' + e);
  }

  // FPS — live value; meaningful only after the loop has run a bit.
  try {
    out.fps = Math.round(game.loop.actualFps);
  } catch (e) {
    out.errors.push('fps read failed: ' + e);
  }

  return out;
})();

// --- Console-warning patterns the smoke-test treats as failures ---------------
// Use these substrings when filtering browser_console_messages: any console.error
// fails; warnings containing these strings also fail (asset/load problems that
// Phaser logs as warnings rather than throwing).
window.__PHASER_SMOKE_WARN_PATTERNS__ = [
  'Failed to load',
  'Texture',           // "Texture key already in use" / missing frame
  'frame',             // "Cannot create animation, frame ... missing"
  'Missing',
  'audio',             // decode/load failures
  '404',
];
