import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';

// Boot is the lightest possible scene: it configures global state and hands off
// to PreloadScene which loads the atlas + bakes the procedural textures.
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    this.scene.start(SceneKeys.Preload);
  }
}
