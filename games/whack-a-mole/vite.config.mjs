import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../../vite.config.shared.mjs';

// Per-game config. Extends the shared production-tuned config and sets what is
// game-specific: the base path, the build output directory, the __DEV__ define,
// and a FIXED per-game dev/preview port so games in the monorepo never collide.
// whack-a-mole owns 5187 / 4187 (5186/4186 is taken by twdc-defense in main).
export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    base: process.env.GAME_BASE || './',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
    },
    server: { port: 5187, strictPort: true },
    preview: { port: 4187, strictPort: true },
    build: {
      outDir: '../../dist/whack-a-mole',
      emptyOutDir: true,
    },
  }),
);
