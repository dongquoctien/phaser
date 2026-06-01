import Phaser from 'phaser';
import { SceneKeys, AudioKeys, TextureKeys, mapClearedKey } from '../types/keys';
import { MAP_COUNT } from '../types/map';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1c2c');

    // a showcase row of hero faces + a zombie
    const showcase = [
      TextureKeys.HeroEvilCat, TextureKeys.HeroMymy, TextureKeys.HeroOreo,
      TextureKeys.HeroGauChi, TextureKeys.ZombieWalker,
    ];
    const y = GAME_HEIGHT * 0.24;
    const x0 = GAME_WIDTH / 2 - (showcase.length - 1) * 50 / 2;
    showcase.forEach((tex, i) => {
      const img = this.add.image(x0 + i * 50, y, tex);
      const targetH = tex === TextureKeys.ZombieWalker ? 40 : 54;
      img.setScale(targetH / (img.height || targetH));
    });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, 'TWDC\nDEFENSE', {
      fontFamily: 'monospace', fontSize: '44px', color: '#ffffff', align: 'center', stroke: '#1a1c2c', strokeThickness: 8,
    }).setOrigin(0.5);

    let cleared = 0;
    for (let i = 0; i < MAP_COUNT; i++) if (this.registry.get(mapClearedKey(i))) cleared++;
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.54, `MAPS CLEARED: ${cleared}/${MAP_COUNT}`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd23f',
    }).setOrigin(0.5);

    const start = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.68, 'TAP TO PLAY', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 5,
      backgroundColor: '#257179', padding: { x: 22, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: start, scale: 1.06, duration: 600, yoyo: true, repeat: -1 });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '15 unique heroes · place them · stop the zombies', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8a91b4',
    }).setOrigin(0.5);

    const go = () => {
      if (this.cache.audio.exists(AudioKeys.Click)) this.sound.play(AudioKeys.Click, { volume: 0.4 });
      this.scene.start(SceneKeys.MapSelect);
    };
    start.once('pointerup', go);
    this.input.keyboard?.once('keydown', go);
  }
}
