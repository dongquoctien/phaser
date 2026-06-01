import Phaser from 'phaser';
import { gameConfig } from './config';

declare const __DEV__: boolean;

const game = new Phaser.Game(gameConfig);

// Dev-only handle for the Playwright smoke-test (tree-shaken out of prod).
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  (window as unknown as { __PHASER_GAME__?: Phaser.Game }).__PHASER_GAME__ = game;
}
