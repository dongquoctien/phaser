import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';

// Generates all pixel-art textures procedurally (no PNGs to load) and shows a
// brief progress bar so the loading flow matches the monorepo standard. In a
// game with real art this scene would `load.atlas(...)` instead.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();
    // CC0 SFX from Kenney (see public/audio/CREDITS.txt).
    for (const key of Object.values(AudioKeys)) {
      this.load.audio(key, `audio/${key}.ogg`);
    }
  }

  create(): void {
    this.generateTextures();
    this.scene.start(SceneKeys.Menu);
  }

  private generateTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Bird: 17x12 yellow body with an eye and beak.
    g.clear();
    g.fillStyle(0xf7d51d).fillRoundedRect(0, 0, 17, 12, 3);
    g.fillStyle(0xffffff).fillCircle(12, 4, 2.5);
    g.fillStyle(0x000000).fillCircle(13, 4, 1.2);
    g.fillStyle(0xff7f11).fillTriangle(15, 6, 21, 5, 15, 9);
    g.generateTexture(TextureKeys.Bird, 22, 12);

    // Pipe: a 1px-wide green column; we set its display height per-instance.
    g.clear();
    g.fillStyle(0x5bbd2a).fillRect(0, 0, 52, 64);
    g.fillStyle(0x4a9e22).fillRect(0, 0, 6, 64); // shaded edge
    g.fillStyle(0x74d33a).fillRect(46, 0, 6, 64); // highlight edge
    g.generateTexture(TextureKeys.Pipe, 52, 64);

    // Ground strip.
    g.clear();
    g.fillStyle(0xded895).fillRect(0, 0, GAME_WIDTH, Tuning.groundHeight);
    g.fillStyle(0x9c8f4f).fillRect(0, 0, GAME_WIDTH, 4);
    g.generateTexture(TextureKeys.Ground, GAME_WIDTH, Tuning.groundHeight);

    g.destroy();
  }

  private drawProgressBar(): void {
    const barW = GAME_WIDTH * 0.6;
    const barH = 10;
    const x = (GAME_WIDTH - barW) / 2;
    const y = GAME_HEIGHT / 2;

    const frame = this.add.graphics();
    frame.lineStyle(1, 0xffffff, 0.6).strokeRect(x, y, barW, barH);

    const bar = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.clear();
      bar.fillStyle(0xffffff, 1).fillRect(x + 1, y + 1, (barW - 2) * p, barH - 2);
    });

    // Always clean listeners up on complete to avoid leaks across restarts.
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      bar.destroy();
      frame.destroy();
    });
  }
}
