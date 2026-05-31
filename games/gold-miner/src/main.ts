import Phaser from 'phaser';
import { gameConfig } from './config';

declare const __DEV__: boolean;

// Bootstrap. Keep this file tiny — all configuration lives in config.ts.
const game = new Phaser.Game(gameConfig);

// Expose the instance for the Playwright smoke-test (phaser-smoketest skill).
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  (window as unknown as { __PHASER_GAME__?: Phaser.Game }).__PHASER_GAME__ = game;
}
