import Phaser from 'phaser';
import { SceneKeys, TileKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { bakeMeadowArt } from '../art';

// Loads the meadow scenery tiles, then bakes the hand-drawn character pixel art
// (heroes + monsters, src/art.ts) into the texture cache. Tiles are scenery and
// stay as loaded images; every character is a baked 32×32 Sweetie-16 sprite, drawn
// for this game (not reused from twdc-defense).
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();
    // ground + decor tiles (scenery)
    for (const key of Object.values(TileKeys)) {
      this.load.image(key, `assets/tiles/${key}.png`);
    }
  }

  create(): void {
    // bake every hand-drawn character sprite (4× so 32px source → crisp at scale)
    bakeMeadowArt(this, 4);
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
