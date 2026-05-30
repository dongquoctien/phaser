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

export const GAME_WIDTH = 288; // classic Flappy Bird playfield proportions
export const GAME_HEIGHT = 512;

// Gameplay tuning — kept here so balance lives in one place.
export const Tuning = {
  gravityY: 1200,
  flapVelocity: -360,
  pipeSpeed: -150, // px/s, world scrolls left (faster = harder)
  pipeGap: 110, // vertical opening for the bird (narrower = harder)
  pipeSpacing: 1300, // ms between spawns (denser pipes = harder)
  groundHeight: 56,
} as const;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL with Canvas fallback
  title: 'Flappy Bird',
  parent: 'game',
  backgroundColor: '#4ec0ca', // classic sky

  // Crisp pixel art: nearest-neighbor filtering, roundPixels, no antialias.
  pixelArt: true,

  render: {
    powerPreference: 'high-performance',
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
      gravity: { x: 0, y: 0 }, // per-object gravity; bird sets its own
      debug: typeof __DEV__ !== 'undefined' && __DEV__, // off in production
    },
  },

  // Scene order matters: Boot runs first.
  scene: [BootScene, PreloadScene, MenuScene, GameScene],
};

export { SceneKeys };
