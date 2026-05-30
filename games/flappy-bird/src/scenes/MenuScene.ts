import Phaser from 'phaser';
import { SceneKeys, TextureKeys, RegistryKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT * 0.32, TextureKeys.Bird)
      .setScale(3);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.45, 'FLAPPY BIRD', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const best = (this.registry.get(RegistryKeys.Best) as number) ?? 0;
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.55, `BEST: ${best}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffe08a',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.7, 'TAP / SPACE TO START', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#0d3b3e',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    const go = () => this.scene.start(SceneKeys.Game);
    this.input.once('pointerdown', go);
    this.input.keyboard?.once('keydown-SPACE', go);
  }
}
