import Phaser from 'phaser';
import { SceneKeys, TileKeys, CharKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// Loads the overworld art (meadow tiles + characters) with a real progress bar.
// Art is reused from twdc-defense's meadow set (same pixel style) — loaded as
// individual images here because they're differently-sized source tiles, not a
// packed atlas. (A future pass can pack them into one atlas via the optimize skill.)
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();

    // ground + decor tiles
    for (const key of Object.values(TileKeys)) {
      this.load.image(key, `assets/tiles/${key}.png`);
    }

    // party heroes — static single-frame pixel sprites (front-facing)
    this.load.image(CharKeys.Rem, 'assets/chars/hero-rem.png');
    this.load.image(CharKeys.Hollis, 'assets/chars/hero-hollis.png');
    this.load.image(CharKeys.Moz, 'assets/chars/hero-moz.png');

    // roaming mob — a 6×6 grid of 118×141 frames (twdc-defense zombie-girl sheet)
    this.load.spritesheet(CharKeys.MobWalker, 'assets/chars/mob-walker.png', {
      frameWidth: 118,
      frameHeight: 141,
    });
  }

  create(): void {
    this.scene.start(SceneKeys.Menu);
  }

  private drawProgressBar(): void {
    const { width, height } = { width: GAME_WIDTH, height: GAME_HEIGHT };
    const barW = width * 0.6;
    const barH = 12;
    const x = (width - barW) / 2;
    const y = (height - barH) / 2;

    const frame = this.add.graphics();
    frame.lineStyle(1, 0xffffff, 0.4).strokeRect(x, y, barW, barH);

    const bar = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.clear();
      bar.fillStyle(0xffffff, 1).fillRect(x + 1, y + 1, (barW - 2) * p, barH - 2);
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      bar.destroy();
      frame.destroy();
    });
  }
}
