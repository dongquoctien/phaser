import { defineConfig, mergeConfig } from 'vite';
import { sharedConfig } from '../vite.config.shared.mjs';

// The hub is its own Vite root (parallel to games/*). build-all builds it LAST
// with emptyOutDir:false so it doesn't wipe the already-built dist/<game>/ dirs.
// Base comes via HUB_BASE env (not a bare "/" CLI arg — Git Bash on Windows
// mangles a leading "/" into a filesystem path).
export default defineConfig(({ command }) =>
  mergeConfig(sharedConfig, {
    base: process.env.HUB_BASE || '/',
    define: {
      __DEV__: JSON.stringify(command === 'serve'),
    },
    server: { port: 5170, strictPort: true },
    preview: { port: 4170, strictPort: true },
    build: {
      outDir: '../dist',
      emptyOutDir: false, // keep dist/<game>/ built before the hub
    },
  }),
);
