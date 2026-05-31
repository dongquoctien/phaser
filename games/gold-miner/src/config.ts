import Phaser from 'phaser';
import { SceneKeys } from './types/keys';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

declare const __DEV__: boolean;

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 640;

// Gameplay tuning — balance lives in one place.
export const Tuning = {
  hookOriginY: 104, // y of the hook pivot — leaves a HUD row + the miner above it
  swingSpeed: 1.6, // radians/sec of the swing
  swingMax: 1.25, // max swing angle from vertical (radians)
  extendSpeed: 320, // px/s the hook shoots down
  retractSpeed: 260, // px/s base retract (heavier loot = slower)
  roundTime: 60, // seconds per round
  targetScore: 650, // score to clear the round
} as const;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  title: 'Gold Miner',
  parent: 'game',
  backgroundColor: '#29366f', // deep cavern blue (Sweetie-16 darkblue)
  pixelArt: true,
  // Phaser 4 defaults roundPixels to false — set it explicitly so pixel art
  // stays crisp (axis-aligned, unscaled draws snap to whole pixels).
  render: { powerPreference: 'high-performance', roundPixels: true },
  scale: {
    mode: Phaser.Scale.FIT,
    // NO_CENTER: the #game flex container centers the canvas.
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // the hook is kinematic; no world gravity
      debug: typeof __DEV__ !== 'undefined' && __DEV__,
    },
  },
  scene: [BootScene, PreloadScene, MenuScene, GameScene],
};

export { SceneKeys };
