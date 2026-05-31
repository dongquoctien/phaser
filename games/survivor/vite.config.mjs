import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../../vite.config.shared.mjs';

export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    base: process.env.GAME_BASE || './',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
    },
    server: { port: 5182, strictPort: true },
    preview: { port: 4182, strictPort: true },
    build: {
      outDir: '../../dist/survivor',
      emptyOutDir: true,
    },
  }),
);
