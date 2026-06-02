import Phaser from 'phaser';
import { SceneKeys, AudioKeys, TextureKeys, Fonts, mapClearedKey } from '../types/keys';
import { MAP_COUNT } from '../types/map';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1c2c');

    // a showcase row of hero faces + the zombie-girl (idle frame of her sheet)
    const showcase = [
      TextureKeys.HeroEvilCat, TextureKeys.HeroMymy, TextureKeys.HeroOreo,
      TextureKeys.HeroGauChi, TextureKeys.ZombieGirlStand,
    ];
    const y = GAME_HEIGHT * 0.24;
    const x0 = GAME_WIDTH / 2 - (showcase.length - 1) * 50 / 2;
    showcase.forEach((tex, i) => {
      const img = this.add.image(x0 + i * 50, y, tex, 0); // frame 0 = idle for sheets
      const targetH = tex === TextureKeys.ZombieGirlStand ? 48 : 54;
      img.setScale(targetH / (img.height || targetH));
    });

    // Title in the Bangers display font — big, menacing, red-hot.
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, 'TWDC\nDEFENSE', {
      fontFamily: Fonts.Display, fontSize: '72px', color: '#ff3b30', align: 'center',
      stroke: '#1a1c2c', strokeThickness: 10,
    }).setOrigin(0.5);
    title.setShadow(0, 4, '#7a0000', 0, true, true);

    let cleared = 0;
    for (let i = 0; i < MAP_COUNT; i++) if (this.registry.get(mapClearedKey(i))) cleared++;
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.54, `MAPS CLEARED: ${cleared}/${MAP_COUNT}`, {
      fontFamily: Fonts.Mono, fontSize: '16px', color: '#ffd23f',
    }).setOrigin(0.5);

    const start = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.68, 'TAP TO PLAY', {
      fontFamily: Fonts.Display, fontSize: '40px', color: '#ffffff', stroke: '#1a1c2c', strokeThickness: 6,
      backgroundColor: '#a01515', padding: { x: 26, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: start, scale: 1.06, duration: 600, yoyo: true, repeat: -1 });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '21 unique heroes · place them · stop the zombies', {
      fontFamily: Fonts.Mono, fontSize: '11px', color: '#8a91b4',
    }).setOrigin(0.5);

    const go = () => {
      if (this.cache.audio.exists(AudioKeys.Click)) this.sound.play(AudioKeys.Click, { volume: 0.4 });
      this.scene.start(SceneKeys.MapSelect);
    };
    start.once('pointerup', go);
    this.input.keyboard?.once('keydown', go);
  }
}
