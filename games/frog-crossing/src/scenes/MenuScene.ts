import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, RegistryKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#8ed24a');

    // a couple of decorative bushes
    this.add.image(70, GAME_HEIGHT * 0.18, TextureKeys.Bush).setScale(0.9);
    this.add.image(GAME_WIDTH - 64, GAME_HEIGHT * 0.22, TextureKeys.Bush).setScale(0.8);

    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT * 0.34, TextureKeys.Frog)
      .setScale(1.6);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.5, 'FROG\nCROSSING', {
        fontFamily: 'monospace', fontSize: '46px', color: '#ffffff',
        align: 'center', stroke: '#1c2b1a', strokeThickness: 8,
      })
      .setOrigin(0.5);

    const best = (this.registry.get(RegistryKeys.Best) as number) ?? 0;
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.62, `BEST: ${best} m`, {
        fontFamily: 'monospace', fontSize: '18px', color: '#1c2b1a',
      })
      .setOrigin(0.5);

    const start = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.74, 'TAP TO PLAY', {
        fontFamily: 'monospace', fontSize: '24px', color: '#ffffff',
        stroke: '#1c2b1a', strokeThickness: 5,
        backgroundColor: '#e2483f', padding: { x: 22, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: start, scale: 1.06, duration: 600, yoyo: true, repeat: -1 });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 26, 'Swipe / arrows to hop · tap to go forward', {
        fontFamily: 'monospace', fontSize: '11px', color: '#1c2b1a',
      })
      .setOrigin(0.5);

    const go = () => {
      // Unlock WebAudio on the gesture, then start.
      if (this.cache.audio.exists(AudioKeys.Hop)) this.sound.play(AudioKeys.Hop, { volume: 0.3 });
      this.scene.start(SceneKeys.Game);
    };
    start.once('pointerup', go);
    this.input.keyboard?.once('keydown', go);
  }
}
