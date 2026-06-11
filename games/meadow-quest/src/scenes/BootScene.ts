import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';

// Boot is the lightest possible scene: it configures global render/scale state
// and loads ONLY the few assets the preloader's progress bar needs, then hands
// off to PreloadScene which loads the bulk.
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  preload(): void {
    // Load only what the loading bar itself needs. Often nothing — the bar can
    // be drawn with Graphics. If you have a logo, load it here:
    // this.load.image('logo', 'assets/logo.png');
  }

  create(): void {
    this.scene.start(SceneKeys.Preload);
  }
}
