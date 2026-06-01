import Phaser from 'phaser';
import { SceneKeys, AudioKeys, RegistryKeys, TextureKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1c2c');

    // a few decorative tanks/towers
    this.add.image(GAME_WIDTH / 2 - 70, GAME_HEIGHT * 0.26, TextureKeys.BaseCannon).setScale(2);
    this.add.image(GAME_WIDTH / 2 - 70, GAME_HEIGHT * 0.26, TextureKeys.TurretCannon).setScale(2);
    this.add.image(GAME_WIDTH / 2 + 70, GAME_HEIGHT * 0.26, TextureKeys.EnemyHeavy).setScale(2).setAngle(180);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.42, 'TANK\nDEFENSE', {
      fontFamily: 'monospace', fontSize: '44px', color: '#ffffff', align: 'center', stroke: '#1a1c2c', strokeThickness: 8,
    }).setOrigin(0.5);

    const best = (this.registry.get(RegistryKeys.BestWave) as number) ?? 0;
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.56, `BEST: Wave ${best}`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd23f',
    }).setOrigin(0.5);

    const start = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.7, 'TAP TO PLAY', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 5,
      backgroundColor: '#257179', padding: { x: 22, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: start, scale: 1.06, duration: 600, yoyo: true, repeat: -1 });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'Build towers · upgrade them · stop the tanks', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8a91b4',
    }).setOrigin(0.5);

    const go = () => {
      if (this.cache.audio.exists(AudioKeys.Click)) this.sound.play(AudioKeys.Click, { volume: 0.4 });
      this.scene.start(SceneKeys.Game);
    };
    start.once('pointerup', go);
    this.input.keyboard?.once('keydown', go);
  }
}
