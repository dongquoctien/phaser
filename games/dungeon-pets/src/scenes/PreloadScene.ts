import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// Smooth vector art: each sprite is an SVG rasterized once at load (Phaser 4
// load.svg). Bake at 2x so it stays crisp on HiDPI; sprites display ~64px.
const SVG_KEYS: ReadonlyArray<string> = [
  TextureKeys.Capybara, TextureKeys.Cat, TextureKeys.Duck, TextureKeys.Frog,
  TextureKeys.Owl, TextureKeys.Skeleton, TextureKeys.Slime, TextureKeys.Boss,
  TextureKeys.Slash, TextureKeys.Arrow,
];

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();
    for (const key of SVG_KEYS) {
      this.load.svg(key, `assets/${key}.svg`, { scale: 2 });
    }
    for (const key of Object.values(AudioKeys)) {
      this.load.audio(key, `audio/${key}.ogg`);
    }
  }

  create(): void {
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
