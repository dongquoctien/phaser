import Phaser from 'phaser';
import { bakeSprite, SWEETIE16_HEX as H, type PixelGrid } from '../../../src/pixel';
import { TextureKeys } from './types/keys';

// Pixel-art (Sweetie-16) baked once via the shared src/pixel helper. Grids were
// authored + SVG-previewed + Playwright-verified before baking (pixel-art skill).
//
// Orientation: the frog faces UP (top-down; rotated per hop direction); trucks &
// logs face RIGHT (flipX for left-moving lanes).

export function bakeArt(scene: Phaser.Scene): void {
  bakeSprite(scene, TextureKeys.Frog, FROG, { px: 5 });
  bakeSprite(scene, TextureKeys.FrogHop, FROG_HOP, { px: 5 });
  bakeSprite(scene, TextureKeys.CarOrange, truck(H.orange), { px: 5 });
  bakeSprite(scene, TextureKeys.CarBlue, truck(H.blue), { px: 5 });
  bakeSprite(scene, TextureKeys.CarRed, truck(H.red), { px: 5 });
  bakeSprite(scene, TextureKeys.Log, LOG, { px: 5 });
  bakeSprite(scene, TextureKeys.Bush, BUSH, { px: 5 });
}

const FROG: PixelGrid = {
  map: { '.': null, k: H.black, g: H.green, l: H.lime, w: H.white, p: H.black, c: H.yellow },
  grid: [
    '..kk..kk..', '.kwwkkwwk.', '.kwpkkpwk.', '.kggkkggk.', 'kggggggggk',
    'kgllllllgk', 'kglccccclg', 'kgllllllgk', '.kgggggk..', 'kk.kk.kk..', 'k.......k.',
  ],
};
const FROG_HOP: PixelGrid = {
  map: { '.': null, k: H.black, g: H.green, l: H.lime, w: H.white, p: H.black, c: H.yellow },
  grid: [
    '.kk....kk.', 'kggk..kggk', '.kwwkkwwk.', '.kggggggk.', 'kgllllllgk',
    'kglccccclg', 'kgllllllgk', '.kggggggk.', 'kgk....kgk', 'kk......kk', '..........',
  ],
};
// side-view truck (faces right); body colour parameterised
function truck(body: string): PixelGrid {
  return {
    map: { '.': null, k: H.black, b: body, t: H.teal, w: H.skyblue, r: H.dark, h: H.slate },
    grid: [
      '....hhhh........', '...hbbbbhkkkk...', '..hbbbbbhktwwk..', '..hbbbbbhktwwk..',
      '..hbbbbbhkkkkk..', '..hbbbbbbbbbbk..', '..kkkkkkkkkkkk..', '..krrk....krrk..',
      '..krrk....krrk..', '...kk......kk...',
    ],
  };
}
const LOG: PixelGrid = {
  map: { '.': null, k: H.black, n: '#9a6b3f', m: '#7a5230', g: '#b88a55' },
  grid: [
    '.kkkkkkkkkkkkkkkkkkkk.', '.kggggggggggggggggggk.', '.kmnnnnnnnnnnnnnnnnmk.',
    '.kmgnnnnnnnnnnnnnngmk.', '.kmnnnnnnnnnnnnnnnnmk.', '.kmmnnnnnnnnnnnnnnmmk.',
    '.kmmmmmmmmmmmmmmmmmmk.', '.kkkkkkkkkkkkkkkkkkkk.',
  ],
};
const BUSH: PixelGrid = {
  map: { '.': null, k: H.black, g: H.green, l: H.lime, d: H.teal },
  grid: [
    '...kk..kk...', '..kllkkllk..', '.kllllllllk.', 'klllgggllllk',
    'kllggggglllk', 'klgggggggglk', 'kdgggggggdlk', '.kdgggggdk..', '..kkddkkk...', '...kk.kk....',
  ],
};
