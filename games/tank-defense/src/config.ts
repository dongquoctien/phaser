import Phaser from 'phaser';
import { SceneKeys } from './types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from './tuning';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

declare const __DEV__: boolean;

export { GAME_WIDTH, GAME_HEIGHT, CELL, GRID_COLS, GRID_ROWS, FIELD_H, HUD_TOP, Tuning } from './tuning';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  title: 'Tank Defense',
  parent: 'game',
  backgroundColor: '#1a1c2c',
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
