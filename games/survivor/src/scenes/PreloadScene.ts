import Phaser from 'phaser';
import { bakeSprite, SWEETIE16_HEX as H, type PixelGrid } from '../../../../src/pixel';
import { SceneKeys, TextureKeys, AudioKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// Everything is baked top-down pixel art (no external atlas) — crisp and cohesive.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    this.drawProgressBar();
    // CC0 SFX from Kenney (see public/audio/CREDITS.txt). Single .ogg each.
    for (const key of Object.values(AudioKeys)) {
      this.load.audio(key, `audio/${key}.ogg`);
    }
  }

  create(): void {
    const px = 4;
    bakeSprite(this, TextureKeys.Hero, HERO, { px });
    bakeSprite(this, TextureKeys.Walker, WALKER, { px });
    bakeSprite(this, TextureKeys.Runner, RUNNER, { px });
    bakeSprite(this, TextureKeys.Boss, BOSS, { px });
    bakeSprite(this, TextureKeys.Bullet, BULLET, { px: 3 });
    bakeSprite(this, TextureKeys.Gem, GEM, { px: 3 });

    // Equipment overlays — baked on the SAME 10x11 grid + same px as HERO so
    // they align pixel-perfect when copying the hero transform each frame.
    bakeSprite(this, TextureKeys.OvHat, OV_HAT, { px });
    bakeSprite(this, TextureKeys.OvShirt, OV_SHIRT, { px });
    bakeSprite(this, TextureKeys.OvGun, OV_GUN, { px });
    bakeSprite(this, TextureKeys.OvShoes, OV_SHOES, { px });

    // Equipment drop / footer icons (small, standalone).
    bakeSprite(this, TextureKeys.IcoHat, ICO_HAT, { px: 3 });
    bakeSprite(this, TextureKeys.IcoShirt, ICO_SHIRT, { px: 3 });
    bakeSprite(this, TextureKeys.IcoGun, ICO_GUN, { px: 3 });
    bakeSprite(this, TextureKeys.IcoShoes, ICO_SHOES, { px: 3 });

    // Skill icons (level-up cards + footer).
    bakeSprite(this, TextureKeys.SkDmg, SK_DMG, { px: 3 });
    bakeSprite(this, TextureKeys.SkRate, SK_RATE, { px: 3 });
    bakeSprite(this, TextureKeys.SkMulti, SK_MULTI, { px: 3 });
    bakeSprite(this, TextureKeys.SkSpeed, SK_SPEED, { px: 3 });
    bakeSprite(this, TextureKeys.SkHp, SK_HP, { px: 3 });
    bakeSprite(this, TextureKeys.SkMagnet, SK_MAGNET, { px: 3 });
    bakeSprite(this, TextureKeys.SkHeal, SK_HEAL, { px: 3 });
    bakeSprite(this, TextureKeys.SkGlass, SK_GLASS, { px: 3 });

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

// ── Top-down pixel sprites (verified via SVG preview). ───────────────────────
const HERO: PixelGrid = {
  grid: [
    '...kkkk...',
    '..kssssk..',
    '.ksshhssk.',
    '.kshhhhsk.',
    'kssh11hssk',
    'ksh1111hsk',
    'kss1111ssk',
    '.kssssssk.',
    '..kggkk...',
    '..kkk.gg..',
    '...k...k..',
  ],
  map: { '.': null, k: H.black, s: H.blue, h: H.cyan, '1': H.yellow, g: H.slate },
};

const WALKER: PixelGrid = {
  grid: [
    '..kkkk..',
    '.kggggk.',
    'kgg11ggk',
    'kg1111gk',
    'gg1111gg',
    'kgg11ggk',
    '.kggggk.',
    '..k..k..',
  ],
  map: { '.': null, k: H.black, g: H.green, '1': H.lime },
};

const RUNNER: PixelGrid = {
  grid: [
    '..k..k..',
    '.kokok.k',
    'kooooook',
    'ko1111ok',
    'koo11ook',
    '.koooook',
    '..kook..',
    '...kk...',
  ],
  map: { '.': null, k: H.black, o: H.orange, '1': H.yellow },
};

const BOSS: PixelGrid = {
  grid: [
    '...kkkkkk...',
    '..krrrrrrk..',
    '.krrddddrrk.',
    'krrd1111drrk',
    'krd111111drk',
    'krd111111drk',
    'krrd1111drrk',
    '.krrddddrrk.',
    '..krr..rrk..',
    '..kk....kk..',
    '..k......k..',
  ],
  map: { '.': null, k: H.black, r: H.red, d: H.purple, '1': H.yellow },
};

const BULLET: PixelGrid = {
  map: { '.': null, k: H.black, y: H.yellow, w: H.white },
  grid: ['.kk.', 'kwwk', 'kyyk', 'kyyk', '.kk.'],
};

const GEM: PixelGrid = {
  map: { '.': null, k: H.black, c: H.skyblue, b: H.blue, w: H.white },
  grid: ['..k..', '.kwk.', 'kcbck', '.kck.', '..k..'],
};

// ── Equipment overlays (10x11, same as HERO; only the slot region painted). ──
const OV_HAT: PixelGrid = {
  map: { '.': null, k: H.black, h: H.red, t: H.white },
  grid: [
    '...hhhh...', '..hhtthh..', '.hhhhhhhh.', '..k....k..', '..........',
    '..........', '..........', '..........', '..........', '..........', '..........',
  ],
};
const OV_SHIRT: PixelGrid = {
  map: { '.': null, k: H.black, a: H.teal, t: H.skyblue },
  grid: [
    '..........', '..........', '..........', '..........', '.kaaaaaak.',
    'kaatttaak.', 'kaatttaak.', '.kaaaaak..', '..........', '..........', '..........',
  ],
};
const OV_GUN: PixelGrid = {
  map: { '.': null, k: H.black, g: H.slate, m: H.grey },
  grid: [
    '....km....', '....km....', '....km....', '....kg....', '....kg....',
    '..........', '..........', '..........', '..........', '..........', '..........',
  ],
};
const OV_SHOES: PixelGrid = {
  map: { '.': null, k: H.black, s: H.lime },
  grid: [
    '..........', '..........', '..........', '..........', '..........',
    '..........', '..........', '..........', '..kss.....', '..kk..ss..', '...s...s..',
  ],
};

// ── Equipment drop / footer icons (8x8). ─────────────────────────────────────
const ICO_HAT: PixelGrid = {
  map: { '.': null, k: H.black, r: H.red, w: H.white },
  grid: ['........', '..kkkk..', '.krrrrk.', 'krwwwwrk', 'krrrrrrk', 'kkkkkkkk', '........', '........'],
};
const ICO_SHIRT: PixelGrid = {
  map: { '.': null, k: H.black, t: H.teal, c: H.skyblue },
  grid: ['.kk..kk.', 'kttttttk', 'kttccttk', 'kttccttk', 'kttttttk', 'kttttttk', '.kttttk.', '..kkkk..'],
};
const ICO_GUN: PixelGrid = {
  map: { '.': null, k: H.black, g: H.slate, m: H.grey },
  grid: ['........', 'kkkkk...', 'kgggmk..', 'kkkkgk..', '...kgk..', '...kgkk.', '...kggk.', '...kkk..'],
};
const ICO_SHOES: PixelGrid = {
  map: { '.': null, k: H.black, l: H.lime, w: H.white },
  grid: ['........', '........', '.kk.....', '.klk....', '.kllkkk.', '.klllllk', '.kwwwwwk', '.kkkkkkk'],
};

// ── Skill icons (9x9). ───────────────────────────────────────────────────────
const SK_DMG: PixelGrid = {
  map: { '.': null, k: H.black, y: H.yellow, w: H.white },
  grid: ['....k....', '...kyk...', '..kyyyk..', '.kyyyyyk.', 'kyywywwyk', '...kyk...', '...kyk...', '...kyk...', '.........'],
};
const SK_RATE: PixelGrid = {
  map: { '.': null, k: H.black, c: H.skyblue },
  grid: ['.....kk..', '....kck..', '...kck...', '..kck.k..', '.kckkckk.', '..k.kck..', '...kck...', '..kck....', '.kk......'],
};
const SK_MULTI: PixelGrid = {
  map: { '.': null, k: H.black, c: H.cyan },
  grid: ['.k.k.k...', '.kc.kc.k.', '.k.k.kc.k', '....k.k..', '..kc.....', '.kc.k.kc.', 'k.k.kc.k.', '.k.kc.k..', '...k.k...'],
};
const SK_SPEED: PixelGrid = {
  map: { '.': null, k: H.black, l: H.lime },
  grid: ['........k', '......klk', '....kllk.', 'k.klllk..', 'kkllllk..', 'k.klllk..', '....kllk.', '......klk', '........k'],
};
const SK_HP: PixelGrid = {
  map: { '.': null, k: H.black, r: H.red },
  grid: ['...kkk...', '..krrrk..', '..krrrk..', 'kkrrrrrkk', 'krrrrrrrk', 'kkrrrrrkk', '..krrrk..', '..krrrk..', '...kkk...'],
};
const SK_MAGNET: PixelGrid = {
  map: { '.': null, k: H.black, r: H.red, w: H.white },
  grid: ['.kk...kk.', 'krrk.krrk', 'krwk.krwk', 'krrk.krrk', 'krrk.krrk', 'krrrkrrrk', '.krrrrrk.', '..krrrk..', '...kkk...'],
};
const SK_HEAL: PixelGrid = {
  map: { '.': null, k: H.black, g: H.green, w: H.white },
  grid: ['...kkk...', '..kgwgk..', '..kgwgk..', 'kkgwwwgkk', 'kgwwwwwgk', 'kkgwwwgkk', '..kgwgk..', '..kgwgk..', '...kkk...'],
};
const SK_GLASS: PixelGrid = {
  map: { '.': null, k: H.black, p: H.purple, w: H.white, c: H.cyan },
  grid: ['....k....', '...kpk...', '..kpwpk..', '.kpwcwpk.', 'kpwcccwpk', '.kpwcwpk.', '..kpwpk..', '...kpk...', '....k....'],
};
