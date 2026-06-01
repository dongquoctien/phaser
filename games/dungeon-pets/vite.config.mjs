import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../../vite.config.shared.mjs';

// Per-game config. Fixed dev/preview ports 5184/4184 (next free pair).
export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    base: process.env.GAME_BASE || './',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
    },
    server: { port: 5184, strictPort: true },
    preview: { port: 4184, strictPort: true },
    build: {
      outDir: '../../dist/dungeon-pets',
      emptyOutDir: true,
    },
  }),
);
