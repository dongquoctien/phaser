import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../../vite.config.shared.mjs';

// Per-game config. Fixed dev/preview ports 5183/4183 (next free pair after
// survivor's 5182/4182).
export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    base: process.env.GAME_BASE || './',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
    },
    server: { port: 5183, strictPort: true },
    preview: { port: 4183, strictPort: true },
    build: {
      outDir: '../../dist/frog-crossing',
      emptyOutDir: true,
    },
  }),
);
