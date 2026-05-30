import Phaser from 'phaser';
import './font.css'; // embedded Press Start 2P @font-face
import { hubConfig } from './config';

declare const __DEV__: boolean;

// Press Start 2P is measured by Phaser Text at creation time. If we start the
// game before the font is parsed, text renders in a fallback face and won't
// reflow. Gate boot on the font being ready.
async function boot(): Promise<void> {
  try {
    await document.fonts.load('16px "Press Start 2P"');
    await document.fonts.ready;
  } catch {
    /* fonts API unavailable — proceed; the scene still renders. */
  }

  const game = new Phaser.Game(hubConfig);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    (window as unknown as { __HUB_GAME__?: Phaser.Game }).__HUB_GAME__ = game;
  }
}

void boot();
