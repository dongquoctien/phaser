import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';
import { bakeAllTextures, registerAnims } from '../systems/textures';

// Boot is the lightest possible scene. Here it bakes all placeholder pixel-art
// textures procedurally (no external atlas yet — swap for this.load.atlas later
// without touching gameplay code) and registers the animations, then hands off.
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    bakeAllTextures(this);
    registerAnims(this);
    this.scene.start(SceneKeys.Preload);
  }
}
