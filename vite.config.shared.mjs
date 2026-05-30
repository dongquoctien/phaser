// Shared, production-tuned Vite config. Each game's vite.config.mjs merges this
// and only overrides base/outDir + the __DEV__ define (per mode). Keep all
// build/optimization policy here so a single edit improves every game.
// See the phaser-optimize-bundle skill.

/** @type {import('vite').UserConfig} */
export const sharedConfig = {
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // strip console.* from production
        drop_debugger: true,
      },
      format: { comments: false },
    },
    chunkSizeWarningLimit: 1600, // Phaser core is ~1.1MB minified; this is expected
    assetsInlineLimit: 4096, // inline tiny assets, keep big atlases as files
    rollupOptions: {
      output: {
        // Split Phaser into its own long-cache chunk so game-code changes don't
        // bust the (large, stable) engine chunk.
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
        },
      },
    },
  },

  server: {
    host: true, // expose on LAN for quick mobile testing
  },
};
