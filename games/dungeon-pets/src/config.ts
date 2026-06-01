import Phaser from 'phaser';
import { SceneKeys } from './types/keys';
import { GAME_WIDTH, GAME_HEIGHT } from './tuning';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { LevelUpScene } from './scenes/LevelUpScene';

declare const __DEV__: boolean;

export { GAME_WIDTH, GAME_HEIGHT, Tuning } from './tuning';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  title: 'Dungeon Pets',
  parent: 'game',
  backgroundColor: '#20162e',
  // SVG/vector look: antialias ON (default), pixelArt OFF — smooth cartoon art.
  render: { powerPreference: 'high-performance' },
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
