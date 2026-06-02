import Phaser from 'phaser';
import { SceneKeys, AtlasKeys, AudioKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { bakeArt } from '../systems/art';

// Loads the character atlas and bakes the procedural art, with a progress bar
// driven by the real load event.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();
    this.load.atlas(AtlasKeys.Sprites, 'assets/sprites.png', 'assets/sprites.json');
    // CC0 SFX (see public/audio/CREDITS.txt). m4a first so iOS Safari (no Ogg
    // support) gets a decodable format.
    for (const key of Object.values(AudioKeys)) {
      this.load.audio(key, [`audio/${key}.m4a`, `audio/${key}.ogg`]);
    }
  }

  create(): void {
    bakeArt(this); // holes, mounds, particles, mallet
    this.scene.start(SceneKeys.Menu);
  }

  private drawProgressBar(): void {
    const width = GAME_WIDTH;
    const height = GAME_HEIGHT;
    const barW = width * 0.6;
    const barH = 14;
    const x = (width - barW) / 2;
    const y = height / 2;

    const frame = this.add.graphics();
    frame.lineStyle(2, 0xffffff, 0.6).strokeRect(x, y, barW, barH);
    const label = this.add
      .text(width / 2, y - 24, 'loading…', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const bar = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.clear();
      bar.fillStyle(0xffffff, 1).fillRect(x + 2, y + 2, (barW - 4) * p, barH - 4);
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      bar.destroy();
      frame.destroy();
      label.destroy();
    });
  }
}
