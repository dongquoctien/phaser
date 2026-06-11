import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';
// HUD overlay (hearts, level name) — built in task #78. Stub for now.
export class UIScene extends Phaser.Scene {
  constructor() { super({ key: SceneKeys.UI, active: false }); }
  create(): void {}
}
