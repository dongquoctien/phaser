import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, '__GAME_TITLE__', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const start = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, 'PRESS / TAP TO START', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#9aa0ff',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const go = () => this.scene.start(SceneKeys.Game);
    start.once('pointerup', go);
    this.input.keyboard?.once('keydown', go);
  }
}
