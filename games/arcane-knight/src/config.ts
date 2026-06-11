import Phaser from 'phaser';
import { SceneKeys } from './types/keys';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { HeroSelectScene } from './scenes/HeroSelectScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

// One source of truth for the game configuration.
// `__DEV__` is replaced at build time by Vite (define) so debug-only flags are
// tree-shaken out of the production bundle.
declare const __DEV__: boolean;

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
export const GRAVITY_Y = 900; // platformer fall — tuned with jump in Player.ts

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL with Canvas fallback
  title: 'Arcane Knight',
  parent: 'game',
  backgroundColor: '#10131f',

  // PIXEL MODE: pixel-art platformer — nearest-neighbor + explicit roundPixels (v4).
  pixelArt: true,

  render: {
    powerPreference: 'high-performance',
    roundPixels: true,
  },

  scale: {
    mode: Phaser.Scale.FIT, // letterbox, never stretch — keeps pixels square
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GRAVITY_Y }, // side-scroller gravity
      debug: typeof __DEV__ !== 'undefined' && __DEV__, // off in production
    },
  },

  // Boot runs first. UIScene is launched on top of GameScene (HUD overlay).
  scene: [BootScene, PreloadScene, MenuScene, HeroSelectScene, GameScene, UIScene],
};

// Re-export keys so callers import config + keys from one place if they like.
export { SceneKeys };
