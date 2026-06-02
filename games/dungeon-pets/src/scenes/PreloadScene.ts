import Phaser from 'phaser';
import { SceneKeys, AudioKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { bakeArt } from '../art';

// Pixel-art: every sprite/tile is baked from a Sweetie-16 grid via src/pixel
// (bakeArt). No external image assets — only the .ogg audio is loaded.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();
    for (const key of Object.values(AudioKeys)) {
      // m4a first so iOS Safari (no Ogg support) gets a decodable format.
      this.load.audio(key, [`audio/${key}.m4a`, `audio/${key}.ogg`]);
    }
  }

  create(): void {
    bakeArt(this);
    this.scene.start(SceneKeys.Menu);
  }

  private drawProgressBar(): void {
    const barW = GAME_WIDTH * 0.6;
    const barH = 12;
    const x = (GAME_WIDTH - barW) / 2;
    const y = GAME_HEIGHT / 2;
    const frame = this.add.graphics();
    frame.lineStyle(1, 0xffffff, 0.5).strokeRect(x, y, barW, barH);
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
