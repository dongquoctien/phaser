import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../../vite.config.shared.mjs';

// Per-game config. Extends the shared production-tuned config and sets what is
// game-specific: the base path, the build output directory, the __DEV__ define
// (true in dev/serve, false in production build — so physics.debug and the
// window.__PHASER_GAME__ test handle are tree-shaken out of prod), and a FIXED
// per-game dev/preview port so multiple games in the monorepo never collide.
//
// Pick a unique __DEV_PORT__ / __PREVIEW_PORT__ per game when scaffolding
// (e.g. 5180/4180, 5181/4181, ...).
export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    // Base path: build-all.mjs sets GAME_BASE (e.g. "/<repo>/<game>/") via env —
    // passed as env, NOT a CLI arg, so Git Bash on Windows can't mangle a leading
    // "/" into a filesystem path. Falls back to "./" for standalone/itch.io zips.
    base: process.env.GAME_BASE || './',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
    },
    server: { port: 5189, strictPort: true },
    preview: { port: 4189, strictPort: true },
    build: {
      outDir: '../../dist/arcane-knight',
      emptyOutDir: true,
    },
  }),
);
