import Phaser from 'phaser';
import { Tex } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// Parallax cave background using the sliced g1 art (Tex.Parallax). The image is
// drawn as a TileSprite so it repeats across wide levels, and scrolls slower than
// the camera for depth. A dark vignette overlay keeps foreground sprites readable.
export function buildBackground(scene: Phaser.Scene, worldW: number, worldH: number): void {
  // Cover the actual viewport, not a hard-coded size — so a wider aspect (16:9)
  // or a fullscreen resize never leaves a gap at the right/bottom edge.
  const viewW = Math.max(scene.scale.width, GAME_WIDTH);
  const viewH = Math.max(scene.scale.height, GAME_HEIGHT);

  // Far parallax: a repeating tile-sprite pinned to the viewport, scrolled
  // manually each frame from the camera (scrollFactor 0 + tilePositionX).
  const bg = scene.add
    .tileSprite(0, 0, viewW, viewH, Tex.Parallax)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(-100);

  // Scale the source so its height fills the view (image is wider than tall).
  const tex = scene.textures.get(Tex.Parallax).getSourceImage();
  const sy = viewH / tex.height;
  bg.setTileScale(sy, sy);

  // Keep the tile-sprite covering the viewport if the canvas is resized (fullscreen).
  const onResize = (gameSize: Phaser.Structs.Size) => {
    bg.setSize(Math.max(gameSize.width, GAME_WIDTH), Math.max(gameSize.height, GAME_HEIGHT));
  };
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, onResize));

  scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
    bg.tilePositionX = scene.cameras.main.scrollX * 0.4 / sy;
  });

  // Subtle dark gradient overlay at the bottom so platforms/hero pop.
  const shade = scene.add.graphics().setScrollFactor(0).setDepth(-90);
  shade.fillStyle(0x0a1418, 0.35).fillRect(0, viewH * 0.55, viewW, viewH * 0.45);

  void worldW;
  void worldH;
}
