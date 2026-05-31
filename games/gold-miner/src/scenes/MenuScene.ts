import Phaser from 'phaser';
import { SceneKeys, TextureKeys, RegistryKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Tuning } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, TextureKeys.GoldL).setScale(4);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.42, 'GOLD MINER', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#ffcd75',
        stroke: '#1a1c2c',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT * 0.52,
        `Grab ${Tuning.targetScore} gold in ${Tuning.roundTime}s`,
        { fontFamily: 'monospace', fontSize: '13px', color: '#f4f4f4' },
      )
      .setOrigin(0.5);

    const best = (this.registry.get(RegistryKeys.Best) as number) ?? 0;
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.6, `BEST: ${best}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#73eff7',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.72, 'TAP / SPACE TO DROP', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#a7f070',
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
