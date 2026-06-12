import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';

// Boot is the lightest possible scene. Art + audio are streamed in PreloadScene.
// We first wait for the Pixelify Sans webfont to load — Phaser caches text glyphs
// at draw time, so any text rendered before the font is ready would bake the
// fallback font and never update. document.fonts.ready resolves once @font-face
// (declared in index.html) has loaded.
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    const go = () => this.scene.start(SceneKeys.Preload);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.load) {
      Promise.all([
        fonts.load('700 16px "Pixelify Sans"'),
        fonts.load('400 16px "Pixelify Sans"'),
      ])
        .then(() => fonts.ready)
        .then(go)
        .catch(go); // never block boot on a font failure
    } else {
      go();
    }
  }
}
