import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../../vite.config.shared.mjs';

// Per-game config. Extends the shared production-tuned config and sets what is
// game-specific: the base path, the build output directory, the __DEV__ define
// (true in dev/serve, false in production build), and a fixed per-game dev/preview
// port so multiple games in the monorepo never collide.
export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    base: process.env.GAME_BASE || './',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
    },
    server: { port: 5181, strictPort: true },
    preview: { port: 4181, strictPort: true },
    build: {
      outDir: '../../dist/gold-miner',
      emptyOutDir: true,
    },
  }),
);
