---
name: phaser-optimize-bundle
description: Audit and shrink the production build of a Phaser + Vite + TypeScript game in this monorepo — texture atlas packing, asset compression, Vite/Rollup tree-shaking & chunking, terser settings, and measuring the dist output. Use when the user wants a "lighter build", "smaller bundle", "tối ưu build", "giảm dung lượng", "build nhẹ nhất", or reports a slow/large load.
---

# Phaser — Optimize Bundle (nhẹ nhất)

Goal: smallest possible download + fastest first paint, without changing gameplay. Work in this order — biggest wins first. Always **measure before and after**.

## 1. Measure first

```bash
# Build the game and inspect the output sizes.
npm run build:<game>
# Then list dist by size (PowerShell):
#   Get-ChildItem -Recurse dist/<game> | Sort-Object Length -Desc | Select Name,Length -First 20
```
Note the three numbers that matter: **phaser chunk** (engine, stable), **game chunk** (your code), and **total assets** (atlases/audio). Optimize whichever dominates.

## 2. Assets usually dominate — fix them first

Pixel-art games are almost always **asset-bound, not code-bound**. Loose PNGs and uncompressed audio dwarf the JS.

- **Pack one texture atlas per category** (sprites / ui / fx). Replace every `load.image()` with frames in `load.atlas()`. Atlas rules:
  - Keep ≤ 2048×2048 (mobile GPU limit); power-of-two dimensions.
  - Trim transparent padding; the packer does this.
  - Recommended packers: `free-tex-packer` / TexturePacker (Phaser/JSON-Hash format), or the Phaser **Pixel Tools / Atlaspack** pipeline.
- **Crush PNGs**: run atlases through `oxipng -o4 --strip safe` or `pngquant` (pixel art tolerates palette reduction extremely well — often 60–80% smaller with no visible loss).
- **Audio**: ship `.ogg` (+ `.mp3` fallback), mono for SFX, ~96–112 kbps for music. Trim silence.
- **Lazy-load by level**: don't load every level's atlas in PreloadScene if the game has many. Load per-level and `textures.remove()` / unload on level exit.

## 3. Vite / Rollup (code side)

The shared `vite.config.shared.mjs` already encodes the policy below; verify it's actually applied to the game and tune:

- `minify: 'terser'` with `drop_console: true`, `drop_debugger: true`, `format.comments: false`.
- `manualChunks` → split `node_modules/phaser` into its own `phaser` chunk so it caches across deploys (game edits don't re-download the engine).
- `assetsInlineLimit: 4096` — inline only tiny assets; keep atlases as cacheable files.
- `define: { __DEV__: 'false' }` so debug branches (physics.debug, FPS overlay) tree-shake away.
- `base: './'` for portable hosting (itch.io zips, sub-paths).

## 4. Phaser-specific code weight

- **Import Phaser once**, from `'phaser'`, and avoid pulling it into shared utility modules that don't need it — that defeats tree-shaking and can duplicate the engine across chunks.
- Phaser 3 ships as one module; you can't tree-shake unused systems out of the standard build. If the engine chunk is the bottleneck and the game is simple, consider a **custom Phaser build** (exclude Matter/Spine/etc.) or evaluate **Phaser 4** (Beam renderer, lighter) — flag this as a larger decision, don't do it silently.
- Remove unused plugins from the game config (e.g. don't enable Matter if only Arcade is used).

## 5. Verify

- Re-run the build and diff the sizes. Report before→after for phaser chunk, game chunk, and assets separately.
- **Autotest (Playwright)**: run the **`phaser-smoketest`** skill against the production build (`npm run preview:<game>`) — optimizing must not break boot, asset loading (atlas keys!), or FPS. A green smoke-test is required before claiming the optimization is safe.
- Sanity-check gzip/brotli size (that's what users actually download) — most hosts compress JS automatically; ensure the host serves `.br`/`.gz`.

## Refuse / flag
- Don't inline large atlases via `assetsInlineLimit: Infinity` for a normal game — it bloats the JS and kills caching. Only for tiny procedural games.
- Don't strip `console` in dev mode.
- Don't claim a win without the before/after numbers.
