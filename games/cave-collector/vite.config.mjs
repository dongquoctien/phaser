import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../../vite.config.shared.mjs';

// Per-game config. Fixed dev/preview ports 5188/4188 (next free pair after
// whack-a-mole 5187/4187). Extends the shared production-tuned config.
export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    // Base path: build-all.mjs sets GAME_BASE (e.g. "/<repo>/<game>/") via env —
    // passed as env, NOT a CLI arg, so Git Bash on Windows can't mangle a leading
    // "/" into a filesystem path. Falls back to "./" for standalone/itch.io zips.
    base: process.env.GAME_BASE || './',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
      // Build id stamped into leaderboard submissions (optional; set via env).
      __BUILD_ID__: JSON.stringify(process.env.BUILD_ID || 'dev'),
    },
    server: { port: 5188, strictPort: true },
    preview: { port: 4188, strictPort: true },
    build: {
      outDir: '../../dist/cave-collector',
      emptyOutDir: true,
    },
  }),
);
