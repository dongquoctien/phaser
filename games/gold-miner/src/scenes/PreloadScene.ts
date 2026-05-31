import Phaser from 'phaser';
import { bakeSprite, SWEETIE16_HEX as H, type PixelGrid } from '../../../../src/pixel';
import { SceneKeys, TextureKeys, AudioKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// Generates every texture procedurally with the shared pixel helper (Sweetie-16,
// crisp). No external assets — see the pixel-art skill for the craft rules.
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
    bakeSprite(this, TextureKeys.Miner, MINER, { px: 3 });
    bakeSprite(this, TextureKeys.Hook, HOOK, { px: 3 });
    bakeSprite(this, TextureKeys.GoldS, GOLD_S, { px: 3 });
    bakeSprite(this, TextureKeys.GoldL, GOLD_L, { px: 3 });
    bakeSprite(this, TextureKeys.Rock, ROCK, { px: 3 });
    this.scene.start(SceneKeys.Menu);
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
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      bar.destroy();
      frame.destroy();
    });
  }
}

// ── Pixel grids (Sweetie-16). All rows in a grid are equal length. ───────────

// The miner: a little figure at the top who holds the rope.
const MINER: PixelGrid = {
  map: { '.': null, k: H.black, s: H.skyblue, w: H.white, y: H.yellow, o: H.orange },
  grid: [
    '..kkkk..',
    '.kyyyyk.',
    '.kowwok.', // face
    '.kyyyyk.',
    'kksssskk',
    'kssssssk', // body (blue overalls)
    'kssssssk',
    'k.ksskk.',
  ],
};

// The claw hook (points down).
const HOOK: PixelGrid = {
  map: { '.': null, k: H.black, g: H.grey, w: H.white },
  grid: [
    '..kk..',
    '.kggk.',
    '.kggk.',
    'k.gg.k',
    'kk..kk',
    'k....k',
  ],
};

// Small gold nugget.
const GOLD_S: PixelGrid = {
  map: { '.': null, k: H.black, y: H.yellow, h: H.white, o: H.orange },
  grid: [
    '.kkk.',
    'khhyk',
    'kyyok',
    '.kkk.',
  ],
};

// Large gold nugget (worth more, slower to pull).
const GOLD_L: PixelGrid = {
  map: { '.': null, k: H.black, y: H.yellow, h: H.white, o: H.orange },
  grid: [
    '..kkkk..',
    '.khhyyk.',
    'khhyyyok',
    'kyyyyook',
    'kyyooook',
    '.kkkkkk.',
  ],
};

// Rock (heavy, low value).
const ROCK: PixelGrid = {
  map: { '.': null, k: H.black, g: H.slate, d: H.dark, w: H.grey },
  grid: [
    '..kkkk..',
    '.kwwggk.',
    'kwwgggdk',
    'kggggddk',
    'kgdddddk',
    '.kkkkkk.',
  ],
};
