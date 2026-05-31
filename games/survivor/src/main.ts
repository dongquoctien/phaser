import Phaser from 'phaser';
import { gameConfig } from './config';

declare const __DEV__: boolean;

const game = new Phaser.Game(gameConfig);

// Expose for the Playwright smoke-test (dev only).
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  (window as unknown as { __PHASER_GAME__?: Phaser.Game }).__PHASER_GAME__ = game;
}
