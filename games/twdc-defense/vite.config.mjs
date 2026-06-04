import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../../vite.config.shared.mjs';

// Per-game config. Fixed dev/preview ports 5186/4186 (next free pair).
export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    base: process.env.GAME_BASE || './',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
      // a stable build id stamped at build time — lets the server spot a tampered/
      // outdated client when validating leaderboard submissions.
      __BUILD_ID__: JSON.stringify(process.env.BUILD_ID || `dev-${command}`),
    },
    server: { port: 5186, strictPort: true },
    preview: { port: 4186, strictPort: true },
    build: {
      outDir: '../../dist/twdc-defense',
      emptyOutDir: true,
    },
  }),
);
