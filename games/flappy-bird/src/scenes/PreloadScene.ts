import Phaser from 'phaser';
import { bakeSprite, SWEETIE16_HEX as H, type PixelGrid } from '../../../../src/pixel';
import { SceneKeys, TextureKeys, AudioKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';

// Bird + pipe are pixel-art baked from Sweetie-16 grids (src/pixel); the ground
// is a plain strip. Grids were SVG-previewed + Playwright-verified before baking.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();
    // CC0 SFX from Kenney (see public/audio/CREDITS.txt).
    for (const key of Object.values(AudioKeys)) {
      // m4a first so iOS Safari (no Ogg support) gets a decodable format.
      this.load.audio(key, [`audio/${key}.m4a`, `audio/${key}.ogg`]);
    }
  }

  create(): void {
    this.generateTextures();
    this.scene.start(SceneKeys.Menu);
  }

  private generateTextures(): void {
    // Bird + pipe = pixel-art grids (px=3). The pipe stretches vertically per
    // instance; its vertical edges stay crisp because they're straight columns.
    bakeSprite(this, TextureKeys.Bird, BIRD, { px: 3 });
    bakeSprite(this, TextureKeys.Pipe, PIPE, { px: 3 });
    bakeSprite(this, TextureKeys.PipeCap, PIPE_CAP, { px: 3 });

    // Ground stays a plain strip (full-width, no detail needed).
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xc2a86b).fillRect(0, 0, GAME_WIDTH, Tuning.groundHeight);
    g.fillStyle(0x9a6b3f).fillRect(0, 0, GAME_WIDTH, 4);
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

// ── pixel grids (Sweetie-16, verified before baking) ─────────────────────────
const BIRD: PixelGrid = {
  map: { '.': null, k: H.black, y: H.yellow, o: H.orange, w: H.white, e: H.black, l: H.lime },
  grid: [
    '...kkkk.....', '..kyyyykk...', '.kyyyyywwk..', '.kyyyyyweko.',
    'kyyyyyywwkoo', 'kylllyyyykoo', 'kyllllyyyk..', 'kyllllyyyk..',
    '.kyyyyyyk...', '..kyyyyk....', '...kkkk.....', '............',
  ],
};
const PIPE: PixelGrid = {
  // Pure vertical column (NO horizontal bands) so stretching the height never
  // distorts a row — only the dark side-edges + green fill scale, staying crisp.
  // The cap is a separate non-stretched texture (PIPE_CAP) the scene places at
  // the pipe's mouth.
  map: { '.': null, k: H.black, g: H.green, l: H.lime, s: H.dark },
  grid: [
    'klggggggggsk',
    'klggggggggsk',
  ],
};
// Pipe mouth cap — placed at the gap end, never stretched.
const PIPE_CAP: PixelGrid = {
  map: { '.': null, k: H.black, g: H.green, l: H.lime, s: H.dark },
  grid: [
    'kkkkkkkkkkkkkk',
    'klgggggggggssk',
    'klgggggggggssk',
    'klgggggggggssk',
    'kkkkkkkkkkkkkk',
  ],
};
