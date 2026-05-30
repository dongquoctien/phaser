import Phaser from 'phaser';
import { SWEETIE16 } from '../../src/pixel';
import { HubScene } from './scenes/HubScene';

declare const __DEV__: boolean;

// Base resolution: scaled by Scale.FIT to keep pixels square. A larger base
// means FIT magnifies less on desktop, so cards/text read at a sensible size
// instead of being blown up ~2x.
export const HUB_WIDTH = 1280;
export const HUB_HEIGHT = 720;

export const hubConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  title: 'Phaser Arcade',
  parent: 'game',
  backgroundColor: '#' + SWEETIE16.black.toString(16).padStart(6, '0'),
  pixelArt: true,
  render: { powerPreference: 'high-performance' },
  scale: {
    mode: Phaser.Scale.FIT,
    // NO_CENTER: the #game flex container centers the canvas (same as the games).
    autoCenter: Phaser.Scale.NO_CENTER,
    width: HUB_WIDTH,
    height: HUB_HEIGHT,
  },
  scene: [HubScene],
};

export { __DEV__ };
