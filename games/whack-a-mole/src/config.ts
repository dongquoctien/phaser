import Phaser from 'phaser';
import { SceneKeys } from './types/keys';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

// One source of truth for the game configuration.
// `__DEV__` is replaced at build time by Vite (define) so debug-only flags are
// tree-shaken out of the production bundle.
declare const __DEV__: boolean;

// Portrait — a 3x3 hole grid reads best tall, like a real whack-a-mole cabinet.
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL with Canvas fallback
  title: 'TWDC Whack-a-Char',
  parent: 'game',
  backgroundColor: '#7ec850',

  // PIXEL MODE — the characters are hand-drawn pixel art, so crisp
  // nearest-neighbor + roundPixels (Phaser 4 defaults roundPixels to false).
  pixelArt: true,

  render: {
    powerPreference: 'high-performance',
    roundPixels: true,
  },

  scale: {
    mode: Phaser.Scale.FIT, // letterbox, never stretch — keeps pixels square
    autoCenter: Phaser.Scale.NO_CENTER, // the #game flex container centers it
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },

  // No physics needed — whack-a-mole is pure tween/timer logic. Skipping the
  // Arcade world keeps the step lighter.

  // Scene order matters: Boot runs first.
  scene: [BootScene, PreloadScene, MenuScene, GameScene],
};

export { SceneKeys };
