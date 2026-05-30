---
name: phaser-perf-audit
description: Audit and fix runtime performance / FPS of a Phaser game in this monorepo — object pooling, GC/allocation in the game loop, texture atlas & draw-call batching, Arcade vs Matter physics, off-screen culling, and production render flags. Use when the user reports lag, stutter, low FPS, "giật", "lag", "tối ưu hiệu năng", "chạy mượt", or asks to make a game run faster at runtime (not download size — that's phaser-optimize-bundle).
---

# Phaser — Runtime Performance Audit (chạy mượt nhất)

Goal: stable 60 FPS on the lowest-spec target device, no GC stutter. Distinct from bundle size — here we care about per-frame cost.

## 1. Establish the baseline

- Add a temporary FPS readout: `this.add.text(...).setText(`${Math.round(this.game.loop.actualFps)}`)` updated each frame, **guarded by `__DEV__`** so it never ships.
- Profile in Chrome DevTools → Performance: record 5–10s of gameplay. Look for:
  - **Long frames / sawtooth GC** (yellow GC bars) → allocation in `update()`.
  - **High scripting time** → too much work per frame, no culling.
  - **High GPU/raster** → too many draw calls / texture swaps.

## 2. Kill allocation in the hot path (biggest GC win)

Scan `update()` and any per-frame callback for these and fix them:

- `new Bullet()` / `.destroy()` / `new Phaser.Math.Vector2()` per frame → **object pooling** (use `systems/Pool.ts` + `objects/PooledSprite.ts` from the scaffold). Pool bullets, particles, enemies, damage numbers, explosions.
- Array `.map`/`.filter`/`.forEach` creating new arrays each frame → use plain `for` loops over the live group.
- String concatenation / `setText` every frame when the value didn't change → cache and only update on change.
- Closures created inside `update` → hoist them.

## 3. Rendering / draw calls

- **One atlas per category** so sprites batch into a single draw call. Mixing many separate textures forces texture swaps → more draw calls.
- **Minimize blend-mode changes** between adjacent objects (they break the batch).
- Static backgrounds → render once to a **RenderTexture** instead of many sprites every frame.
- `setVisible(false)` to hide, **not** `setAlpha(0)` (alpha-0 still renders).
- Keep `pixelArt: true` / `roundPixels: true` (already in the scaffold config) — sub-pixel positions cause shimmer and extra work.

## 4. Physics

- Default to **Arcade**, not Matter — Matter is far heavier. Only use Matter for true polygon/joint physics.
- `physics.arcade.debug: false` in production (the scaffold ties this to `__DEV__`).
- **Disable bodies on off-screen objects** — cull against an expanded camera rect each frame and set `body.enable = false` outside it.
- Use **static bodies/groups** for immovable geometry (platforms, walls).
- Reduce `fps` of the Arcade world only if the game tolerates it (rarely needed).

## 5. Scene hygiene (leaks that degrade over time)

- Remove event listeners, timers, and tweens in `shutdown()` — leaked listeners pile up across scene restarts and silently tank FPS.
- `textures.remove()` / unload atlases you won't reuse between levels to free GPU memory.
- Don't keep references to destroyed objects (prevents GC).

## 6. Mobile

- Cap particle counts hard on mobile.
- `powerPreference: 'high-performance'` (in scaffold config).
- Test on a real low-end phone, not just desktop throttling.

## Autotest (Playwright)
After applying fixes, run the **`phaser-smoketest`** skill — it measures `game.loop.actualFps` in a real browser and fails below threshold, so the "after FPS" number is observed, not guessed. Use its measured FPS as the audit's after-value.

## Output of an audit
Report concretely: current FPS, the 2–3 worst offenders found (with `file:line`), the fix applied, and the after FPS (from the smoke-test). Don't claim "optimized" without a measured before/after.
