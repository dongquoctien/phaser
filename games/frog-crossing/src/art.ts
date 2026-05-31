import Phaser from 'phaser';
import { TextureKeys } from './types/keys';

// Smooth vector ("SVG-look") art baked once at load via Graphics.generateTexture
// (the Phaser-4-kept path; Textures.generate is gone). Antialiased fills, no
// atlas — the set is small and geometric. Each texture is drawn at a 2x supersize
// then the sprite is shown at 0.5 scale so edges stay crisp on HiDPI.
//
// Coordinate convention: trucks/logs face RIGHT (flipX for left-moving lanes);
// the frog faces UP (rotate per hop direction).

const SS = 2; // supersample factor

const COLORS = {
  frogBody: 0x7ec850,
  frogDark: 0x5aa838,
  frogBelly: 0xcfeeae,
  eyeWhite: 0xffffff,
  pupil: 0x1c2b1a,
  cabTeal: 0x2fb6c4,
  wheel: 0x2b2f3a,
  window: 0xbfeff5,
  orange: 0xf08a2c,
  blue: 0x3a78d6,
  red: 0xe2483f,
  logBrown: 0x9a6b3f,
  logLight: 0xb88a55,
  logDark: 0x7a5230,
  bush: 0x5fae34,
  bushDark: 0x4d9029,
} as const;

/** Bake every texture. Call once in PreloadScene.create(). */
export function bakeArt(scene: Phaser.Scene): void {
  bakeFrog(scene, TextureKeys.Frog, false);
  bakeFrog(scene, TextureKeys.FrogHop, true);
  bakeTruck(scene, TextureKeys.CarOrange, COLORS.orange);
  bakeTruck(scene, TextureKeys.CarBlue, COLORS.blue);
  bakeTruck(scene, TextureKeys.CarRed, COLORS.red);
  bakeLog(scene, TextureKeys.Log);
  bakeBush(scene, TextureKeys.Bush);
}

function withGraphics(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w * SS, h * SS);
  g.destroy();
}

function bakeFrog(scene: Phaser.Scene, key: string, hop: boolean): void {
  withGraphics(scene, key, 64, 64, (g) => {
    g.scale = SS;
    if (hop) {
      g.fillStyle(COLORS.frogDark);
      g.fillEllipse(14, 20, 16, 10);
      g.fillEllipse(50, 20, 16, 10);
      g.fillEllipse(12, 46, 16, 12);
      g.fillEllipse(52, 46, 16, 12);
    } else {
      g.fillStyle(COLORS.frogDark);
      g.fillEllipse(16, 44, 14, 18);
      g.fillEllipse(48, 44, 14, 18);
    }
    // body + belly
    g.fillStyle(COLORS.frogBody);
    g.fillEllipse(32, 34, 36, 40);
    g.fillStyle(COLORS.frogBelly);
    g.fillEllipse(32, 42, 22, 24);
    // eye bumps
    g.fillStyle(COLORS.frogBody);
    g.fillCircle(23, 16, 8);
    g.fillCircle(41, 16, 8);
    // eyes
    g.fillStyle(COLORS.eyeWhite);
    g.fillCircle(23, 15, 5);
    g.fillCircle(41, 15, 5);
    g.fillStyle(COLORS.pupil);
    g.fillCircle(24, 15, 2.4);
    g.fillCircle(42, 15, 2.4);
  });
}

function bakeTruck(scene: Phaser.Scene, key: string, color: number): void {
  withGraphics(scene, key, 70, 46, (g) => {
    g.scale = SS;
    // cargo
    g.fillStyle(color);
    g.fillRoundedRect(4, 10, 44, 26, 5);
    // cab
    g.fillStyle(COLORS.cabTeal);
    g.fillRoundedRect(46, 8, 20, 30, 6);
    // window
    g.fillStyle(COLORS.window);
    g.fillRoundedRect(52, 13, 11, 11, 2);
    // top highlight strip
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(10, 4, 34, 8, 3);
    // wheels
    g.fillStyle(COLORS.wheel);
    g.fillCircle(18, 39, 6);
    g.fillCircle(52, 39, 6);
  });
}

function bakeLog(scene: Phaser.Scene, key: string): void {
  withGraphics(scene, key, 120, 46, (g) => {
    g.scale = SS;
    g.fillStyle(COLORS.logBrown);
    g.fillRoundedRect(2, 8, 116, 30, 15);
    g.fillStyle(COLORS.logLight, 0.7);
    g.fillRoundedRect(2, 8, 116, 8, 8);
    // end-grain rings
    g.fillStyle(COLORS.logDark);
    g.fillEllipse(14, 23, 16, 22);
    g.fillStyle(COLORS.logLight);
    g.fillEllipse(14, 23, 8, 12);
    g.fillStyle(COLORS.logDark);
    g.fillEllipse(106, 23, 16, 22);
  });
}

function bakeBush(scene: Phaser.Scene, key: string): void {
  withGraphics(scene, key, 70, 64, (g) => {
    g.scale = SS;
    g.fillStyle(COLORS.bushDark);
    g.fillCircle(22, 40, 18);
    g.fillCircle(46, 42, 16);
    g.fillStyle(COLORS.bush);
    g.fillCircle(30, 28, 16);
    g.fillCircle(44, 30, 14);
  });
}
