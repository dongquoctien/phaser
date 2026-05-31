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

export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL with Canvas fallback
  title: '__GAME_TITLE__',
  parent: 'game',
  backgroundColor: '#0d0d12',

  // DEFAULT: SVG vector art — antialias stays ON (default), pixelArt stays OFF.
  // PIXEL MODE (only if the game is meant to be pixel-art): uncomment the two
  // lines below — pixelArt enables nearest-neighbor, and Phaser 4 needs
  // roundPixels set explicitly (it defaults to false in v4).
  // pixelArt: true,

  render: {
    powerPreference: 'high-performance',
    // roundPixels: true, // <- uncomment together with pixelArt above
  },

  scale: {
    mode: Phaser.Scale.FIT, // letterbox, never stretch — keeps pixels square
    // NO_CENTER: the #game flex container (index.html) centers the canvas.
    // Don't also use Phaser CENTER_BOTH or the two centering mechanisms stack
    // and push the canvas off to one side.
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: typeof __DEV__ !== 'undefined' && __DEV__, // off in production
    },
  },

  // Scene order matters: Boot runs first.
  scene: [BootScene, PreloadScene, MenuScene, GameScene],
};

// Re-export keys so callers import config + keys from one place if they like.
export { SceneKeys };
