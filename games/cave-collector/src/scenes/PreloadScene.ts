import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';

// All textures are baked procedurally in BootScene, and there is no audio yet,
// so there is nothing to stream here — this scene just hands off to the menu.
// (When real assets land: load the atlas + audio here with a progress bar.)
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  create(): void {
    this.scene.start(SceneKeys.Menu);
  }
}
