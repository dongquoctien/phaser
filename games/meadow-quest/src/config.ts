import Phaser from 'phaser';
import { SceneKeys } from './types/keys';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { BattleScene } from './scenes/BattleScene';

// One source of truth for the game configuration.
// `__DEV__` is replaced at build time by Vite (define) so debug-only flags are
// tree-shaken out of the production bundle.
declare const __DEV__: boolean;

export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL with Canvas fallback
  title: 'Meadow Quest',
  parent: 'game',
  backgroundColor: '#5fa84a', // meadow green so letterbox bars match the field

  // PIXEL MODE: this is a pixel-art game — nearest-neighbor scaling. Phaser 4
  // defaults roundPixels to false, so set it explicitly alongside pixelArt.
  pixelArt: true,

  render: {
    powerPreference: 'high-performance',
    roundPixels: true,
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

  // Scene order matters: Boot runs first. Battle is launched on demand (overlaying
  // a paused GameScene), so its position past Game is fine.
  scene: [BootScene, PreloadScene, MenuScene, GameScene, BattleScene],
};

// Re-export keys so callers import config + keys from one place if they like.
export { SceneKeys };
