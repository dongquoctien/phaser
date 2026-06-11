import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, 'ARCANE KNIGHT', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffcd75',
      })
      .setOrigin(0.5);

    const start = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, 'PRESS / TAP TO START', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#73eff7',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const go = () => this.scene.start(SceneKeys.HeroSelect);
    start.once('pointerup', go);
    this.input.keyboard?.once('keydown', go);
  }
}
