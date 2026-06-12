import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';

// Boot is the lightest possible scene. Art + audio are streamed in PreloadScene
// (with a progress bar), so Boot just hands off.
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    this.scene.start(SceneKeys.Preload);
  }
}
