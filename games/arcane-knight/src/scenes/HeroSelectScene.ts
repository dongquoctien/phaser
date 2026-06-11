import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';
// Full hero-select UI is built in task #75. Stub: jump straight to the game.
export class HeroSelectScene extends Phaser.Scene {
  constructor() { super(SceneKeys.HeroSelect); }
  create(): void { this.scene.start(SceneKeys.Game); }
}
