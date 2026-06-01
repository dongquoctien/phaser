import Phaser from 'phaser';
import { SceneKeys } from './types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from './tuning';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

declare const __DEV__: boolean;

// Tuning + dimensions live in ./tuning (no imports) to avoid an import cycle.
// Re-export for convenience.
export { GAME_WIDTH, GAME_HEIGHT, CELL, GRID_COLS, Tuning } from './tuning';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  title: 'Frog Crossing',
  parent: 'game',
  backgroundColor: '#1e1f2b',
  // Pixel-art: crisp nearest-neighbor + roundPixels (v4 defaults it false).
  pixelArt: true,
  render: { powerPreference: 'high-performance', roundPixels: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: typeof __DEV__ !== 'undefined' && __DEV__,
    },
  },
  scene: [BootScene, PreloadScene, MenuScene, GameScene],
};

export { SceneKeys };
