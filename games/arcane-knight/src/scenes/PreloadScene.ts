import Phaser from 'phaser';
import { SceneKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { bakeArt } from '../art';

// Bakes every hand-drawn pixel sprite into the texture cache (no external assets).
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();
  }

  create(): void {
    bakeArt(this, 4); // 32px source ×4 → crisp at scale
    this.scene.start(SceneKeys.Menu);
  }

  private drawProgressBar(): void {
    const barW = GAME_WIDTH * 0.6, barH = 10;
    const x = (GAME_WIDTH - barW) / 2, y = (GAME_HEIGHT - barH) / 2;
    const frame = this.add.graphics();
    frame.lineStyle(1, 0xffffff, 0.4).strokeRect(x, y, barW, barH);
    const bar = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.clear();
      bar.fillStyle(0xffffff, 1).fillRect(x + 1, y + 1, (barW - 2) * p, barH - 2);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => { bar.destroy(); frame.destroy(); });
  }
}
