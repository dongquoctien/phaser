import Phaser from 'phaser';
import { SceneKeys } from './types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from './tuning';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { LevelUpScene } from './scenes/LevelUpScene';

declare const __DEV__: boolean;

// Tuning + dimensions live in ./tuning (no imports) to avoid an import cycle:
// config imports scenes → scenes import objects → objects need Tuning. Re-export
// for convenience.
export { GAME_WIDTH, GAME_HEIGHT, Tuning } from './tuning';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  title: 'Survivor',
  parent: 'game',
  backgroundColor: '#2b2f3a',
  // All sprites are baked top-down PIXEL art (src/pixel) → pixelArt for crisp
  // nearest-neighbor; roundPixels explicit (Phaser 4 defaults it false).
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
  scene: [BootScene, PreloadScene, MenuScene, GameScene, LevelUpScene],
};

export { SceneKeys };
