import Phaser from 'phaser';
import { bakeSprite, SWEETIE16_HEX as H, type PixelGrid } from '../../../src/pixel';
import { TextureKeys } from './types/keys';

// Pixel-art (Sweetie-16) baked once via the shared src/pixel helper. Grids were
// authored + SVG-previewed + Playwright-verified before baking (pixel-art skill:
// readable silhouette first). px=4 → sprites ~40px, crisp under pixelArt config.

const px = 4;
const tilePx = 3;

export function bakeArt(scene: Phaser.Scene): void {
  bakeSprite(scene, TextureKeys.Capybara, CAPYBARA, { px });
  bakeSprite(scene, TextureKeys.Cat, CAT, { px });
  bakeSprite(scene, TextureKeys.Duck, DUCK, { px });
  bakeSprite(scene, TextureKeys.Frog, FROG, { px });
  bakeSprite(scene, TextureKeys.Owl, OWL, { px });
  bakeSprite(scene, TextureKeys.Skeleton, SKELETON, { px });
  bakeSprite(scene, TextureKeys.Slime, SLIME, { px });
  bakeSprite(scene, TextureKeys.Boss, BOSS, { px });
  bakeSprite(scene, TextureKeys.Arrow, ARROW, { px: 3 });
  bakeSprite(scene, TextureKeys.Slash, SLASH, { px: 3 });
  bakeSprite(scene, TextureKeys.Brick, BRICK, { px: tilePx });
  bakeSprite(scene, TextureKeys.Torch, TORCH, { px: tilePx });
}

// ── heroes ───────────────────────────────────────────────────────────────────
const CAPYBARA: PixelGrid = {
  map: { '.': null, k: H.black, b: H.orange, d: H.red, w: H.white, p: H.black },
  grid: [
    '..k....k..', '.kbk..kbk.', '.kbbkkbbk.', 'kbbbbbbbbk', 'kbwbbbbwbk',
    'kbpbbbbpbk', 'kbbbddbbbk', 'kbbbddbbbk', '.kbbbbbbk.', '..kbbbbk..', '..k.kk.k..',
  ],
};
const CAT: PixelGrid = {
  map: { '.': null, k: H.black, o: H.orange, d: H.red, w: H.white, p: H.black },
  grid: [
    'k.k..k.k..', 'kok..kok..', 'koookkook.', 'kowokkowok', 'koopoopook',
    'kooodddook', 'kooooooook', '.koooooook', '.kooooookk', '..kkkkk.ko', '........kk',
  ],
};
const DUCK: PixelGrid = {
  map: { '.': null, k: H.black, y: H.yellow, o: H.orange, w: H.white, p: H.black },
  grid: [
    '...kkk....', '..kyyyk...', '.kywyyk...', 'okypyyk...', 'okyyyykkk.',
    '.kyyyyyyk.', '.kyyyyyyk.', 'kyyyyyyyyk', 'kyyyyyyyyk', '.kyyyyyyk.', '..kkkkkk..',
  ],
};
const FROG: PixelGrid = {
  map: { '.': null, k: H.black, g: H.green, l: H.lime, w: H.white, c: H.yellow, p: H.black },
  grid: [
    '.kk...kk..', 'kwwk.kwwk.', 'kwpk.kwpk.', 'kggkkkggk.', 'kgggggggk.',
    'kgllllllgk', 'kglcccclgk', 'kglcccclgk', 'kgllllllgk', '.kggggggk.', 'kk.k..k.kk',
  ],
};
const OWL: PixelGrid = {
  map: { '.': null, k: H.black, u: H.purple, w: H.white, y: H.yellow, p: H.black },
  grid: [
    'k.......k.', 'ku.....uk.', 'kuukkkuuk.', 'kuwukkuwuk', 'kupukkupuk',
    'kuukyykuuk', 'kuuuyyuuuk', '.kuuuuuuk.', '.kuuuuuuk.', '..kuuuuk..', '..k.kk.k..',
  ],
};
// ── enemies ──────────────────────────────────────────────────────────────────
const SKELETON: PixelGrid = {
  map: { '.': null, k: H.black, w: H.white, g: H.grey, r: H.red, p: H.black },
  grid: [
    '..kkkkkk..', '.kwwwwwwk.', 'kwwwwwwwwk', 'kwrwwwwrwk', 'kwkwwwwkwk',
    'kwwwwwwwwk', 'kwwgwwgwwk', '.kwgggggk.', '..kwwwwk..', '..kgkkgk..', '..k.kk.k..',
  ],
};
const SLIME: PixelGrid = {
  map: { '.': null, k: H.black, t: H.teal, c: H.cyan, w: H.white, p: H.black },
  grid: [
    '...kkkk...', '..ktcctk..', '.ktcttctk.', 'ktttttttk.', 'ktwttttwtk',
    'ktpttttptk', 'kttttttttk', 'kttttttttk', 'ktttttttk.', '.kkkkkkkk.', '..k.kk.k..',
  ],
};
const BOSS: PixelGrid = {
  map: { '.': null, k: H.black, r: H.red, d: H.purple, y: H.yellow, w: H.white, p: H.black },
  grid: [
    'y.yy.yy.y.', 'kykkykkyk.', 'krk.kk.krk', 'krrrrrrrrk', 'krwrrrrwrk',
    'krprrrrprk', 'krrrddrrrk', 'krrrddrrrk', '.krrrrrrk.', '..krrrrk..', '..k.kk.k..',
  ],
};
// ── fx / props ───────────────────────────────────────────────────────────────
const ARROW: PixelGrid = {
  map: { '.': null, k: H.black, w: H.white, g: H.grey, y: H.yellow },
  grid: ['......k...', 'kkkkkkkk..', 'gwwwwwwyk.', 'kkkkkkkk..', '......k...'],
};
const SLASH: PixelGrid = {
  map: { '.': null, w: H.white, c: H.skyblue },
  grid: ['....cw', '..cww.', '.cww..', 'cww...', 'ww....', 'w.....'],
};
// ── dungeon tiles ────────────────────────────────────────────────────────────
const BRICK: PixelGrid = {
  map: { '.': null, d: H.dark, s: H.slate, k: H.black },
  grid: [
    'ssssssssssssssss', 'sddddddddddddddk', 'sddddddddddddddk', 'sddddddddddddddk',
    'sddddddddddddddk', 'kkkkkkkksddddddk', 'ddddddddsddddddk', 'ddddddddsddddddk',
    'ddddddddsddddddk', 'ddddddddkkkkkkkk', 'ddddddddsddddddd', 'sdddddddsddddddd',
    'sdddddddsddddddd', 'sdddddddsddddddd', 'sdddddddsddddddd', 'kkkkkkkkkkkkkkkk',
  ],
};
const TORCH: PixelGrid = {
  map: { '.': null, k: H.black, b: H.slate, y: H.yellow, o: H.orange, r: H.red, w: H.white },
  grid: [
    '...ww...', '..wyyw..', '.woyoyw.', '.wyoroy.', '..woow..', '...kk...',
    '...bk...', '...bk...', '...bk...', '...bk...', '...bk...', '..kbbk..',
  ],
};
