import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../../vite.config.shared.mjs';

// Per-game config. Fixed dev/preview ports 5185/4185 (next free pair).
export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    base: process.env.GAME_BASE || './',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
    },
    server: { port: 5185, strictPort: true },
    preview: { port: 4185, strictPort: true },
    build: {
      outDir: '../../dist/tank-defense',
      emptyOutDir: true,
    },
  }),
);
