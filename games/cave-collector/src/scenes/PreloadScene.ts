import Phaser from 'phaser';
import { SceneKeys, Tex, Audio } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { registerAnims } from '../systems/textures';

// Atlases sliced by scripts/cut-g1.mjs into public/assets/<key>.png + .json.
const ATLASES: string[] = [
  Tex.Hero, Tex.Robot, Tex.Shuriken, Tex.Star, Tex.Coin, Tex.Spark, Tex.Heart,
  Tex.Block, Tex.BlockUsed, Tex.Door, Tex.Crystal, Tex.Mushroom,
  Tex.TileTop, Tex.TileFill, Tex.TilePlatform,
];

// Audio key -> on-disk filename stem (some keys are suffixed to avoid clashing
// with same-named texture keys, e.g. star/coin).
const AUDIO: Array<[string, string]> = [
  [Audio.BgmMenu, 'bgm-menu'], [Audio.BgmGame, 'bgm-game'],
  [Audio.Footstep, 'footstep'], [Audio.Jump, 'jump'], [Audio.Land, 'land'],
  [Audio.Punch, 'punch'], [Audio.BlockPay, 'block-pay'],
  [Audio.Star, 'star'], [Audio.Coin, 'coin'], [Audio.Hurt, 'hurt'],
  [Audio.BotHit, 'bot-hit'], [Audio.LevelClear, 'level-clear'],
  [Audio.GameOver, 'game-over'], [Audio.Select, 'select'],
];

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();
    for (const key of ATLASES) {
      this.load.atlas(key, `assets/${key}.png`, `assets/${key}.json`);
    }
    this.load.image(Tex.Parallax, 'assets/parallax.png');
    for (const [key, file] of AUDIO) {
      // m4a FIRST (iOS can't decode Ogg → silent iPhone).
      this.load.audio(key, [`audio/${file}.m4a`, `audio/${file}.ogg`]);
    }
  }

  create(): void {
    registerAnims(this);
    this.scene.start(SceneKeys.Menu);
  }

  private drawProgressBar(): void {
    const { width, height } = { width: GAME_WIDTH, height: GAME_HEIGHT };
    const barW = width * 0.6;
    const barH = 10;
    const x = (width - barW) / 2;
    const y = (height - barH) / 2;

    this.add.text(width / 2, y - 18, 'CAVE COLLECTOR', {
      fontFamily: 'monospace', fontSize: '14px', color: '#7df0a8',
    }).setOrigin(0.5);

    const frame = this.add.graphics();
    frame.lineStyle(1, 0xffffff, 0.4).strokeRect(x, y, barW, barH);
    const bar = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.clear();
      bar.fillStyle(0x7df0a8, 1).fillRect(x + 1, y + 1, (barW - 2) * p, barH - 2);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => { bar.destroy(); frame.destroy(); });
  }
}
