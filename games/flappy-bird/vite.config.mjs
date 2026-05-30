import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../../vite.config.shared.mjs';

// Per-game config. Extends the shared production-tuned config and sets what is
// game-specific: the base path, the build output directory, and the __DEV__
// define (true in dev/serve, false in production build) so dev-only code such as
// physics.debug and the window.__PHASER_GAME__ test handle are tree-shaken out.
export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    // Base path: build-all.mjs sets GAME_BASE (e.g. "/phaser/flappy-bird/") via
    // env — passed as env, NOT a CLI arg, so Git Bash on Windows can't mangle a
    // leading "/" into a filesystem path. Falls back to "./" for standalone
    // builds / itch.io zips.
    base: process.env.GAME_BASE || './',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
    },
    // Fixed per-game port so multiple games in the monorepo never collide.
    server: { port: 5180, strictPort: true },
    preview: { port: 4180, strictPort: true },
    build: {
      outDir: '../../dist/flappy-bird',
      emptyOutDir: true,
    },
  }),
);
