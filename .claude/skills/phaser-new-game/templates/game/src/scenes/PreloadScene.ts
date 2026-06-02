import Phaser from 'phaser';
import { SceneKeys, AtlasKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// Loads every atlas/audio for the game and shows a progress bar driven by the
// real load progress event. Use ONE atlas per category — never loose PNGs.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();

    // Texture atlases: <key>.png + <key>.json packed by your atlas tool.
    this.load.atlas(
      AtlasKeys.Sprites,
      'assets/sprites.png',
      'assets/sprites.json',
    );
    // this.load.atlas(AtlasKeys.UI, 'assets/ui.png', 'assets/ui.json');
    // this.load.atlas(AtlasKeys.FX, 'assets/fx.png', 'assets/fx.json');

    // Audio — ALWAYS dual-format, m4a FIRST. iOS Safari can't decode Ogg, so an
    // Ogg-only game is silent on every iPhone/iPad. See the phaser-audio skill.
    // this.load.audio(AudioKeys.Sfx, ['assets/sfx.m4a', 'assets/sfx.ogg']);
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

    // Always clean listeners up on shutdown to avoid leaks across scene restarts.
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      bar.destroy();
      frame.destroy();
    });
  }
}
