import Phaser from 'phaser';
import { SceneKeys } from './types/keys';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';

// One source of truth for the game configuration.
declare const __DEV__: boolean;

// Internal resolution: 426x240 = 16:9, scaled up with nearest-neighbor so the
// pixels stay crisp and square. (Was 400x240 / 5:3; widened for 16:9 displays.)
export const GAME_WIDTH = 426;
export const GAME_HEIGHT = 240;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL with Canvas fallback
  title: 'Explorer Oreo',
  parent: 'game',
  backgroundColor: '#142a2c',

  // PIXEL MODE: nearest-neighbor + integer pixel snapping (Phaser 4 defaults
  // roundPixels to false, so set it explicitly).
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
      gravity: { x: 0, y: 900 }, // platformer gravity
      debug: typeof __DEV__ !== 'undefined' && __DEV__, // off in production
    },
  },

  // HudScene runs in parallel on top of GameScene (launched by GameScene).
  scene: [BootScene, PreloadScene, MenuScene, GameScene, HudScene],
};

export { SceneKeys };
