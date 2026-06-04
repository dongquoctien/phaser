---
name: phaser-perf-audit
description: Audit and fix runtime performance / FPS of a Phaser game in this monorepo — object pooling, GC/allocation in the game loop, texture atlas & draw-call batching, Arcade vs Matter physics, off-screen culling, and production render flags. Use when the user reports lag, stutter, low FPS, "giật", "lag", "tối ưu hiệu năng", "chạy mượt", or asks to make a game run faster at runtime (not download size — that's phaser-optimize-bundle).
---

# Phaser — Runtime Performance Audit (smoothest)

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
- Static backgrounds → render once to a **RenderTexture** instead of many sprites every frame. **Phaser 4:** RenderTexture/DynamicTexture draws are *buffered* — you MUST call `.render()` to flush (else it draws nothing, no error). Use `DynamicTexture.preserve()` / `RenderTexture.renderMode` for reuse. (See `.claude/skills/PHASER4.md`.)
- **Phaser 4 batching:** `setLighting(true)`, filters, and shaders break draw-call batching (they change the shader) — use sparingly, not blanket-on. `pathDetailThreshold` (config + per-Graphics) merges near-duplicate Graphics vertices; `SpriteGPULayer`/`TilemapGPULayer` handle very large quad counts.
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

### 6a. Touch input lag (felt as "lag" even at 60 FPS)

A virtual joystick / touch control can feel laggy while the FPS readout says
60 — this is **input latency**, not framerate, and users report it as "joystick
lag / delayed direction / stutter". Checklist (all four were real bugs in `survivor`):

- **Read direction every frame, not on `pointermove`.** `pointermove` fires
  *less often than the frame loop* and stops entirely when the finger is held
  still — so anything that updates direction only inside `onMove` lags or
  "sticks". Store the owning pointer and recompute `dx/dy` in the per-frame
  `sample()`/`update()` from `pointer.x/y` directly. Don't read direction
  indirectly off a thumb sprite that itself only moves on `onMove`.
- **`scene.input.setPollAlways()`** (sets `pollRate = 0`) so pointers are polled
  every frame past the drag threshold, instead of "poll only on move" (the
  default), which delays a held drag. Trade-off: polling runs a hit-test each
  frame — fine for a game with few interactive objects, avoid if you have
  hundreds of interactive Game Objects.
- **`touch-action: none`** (+ `user-select: none`) on the canvas / game `<div>`
  in `index.html`. Without it the browser may treat the drag as a scroll/zoom
  and swallow or stutter the touch events — the #1 cause of *jitter on fast
  drags* on phones. (`-webkit-tap-highlight-color: transparent` removes the grey
  tap flash too.)
- **Lock the drag to one pointer id.** Ignore `pointerdown` while already active,
  and only honour `pointerup`/`pointermove` for the owning id — otherwise a
  second finger yanks the direction. Also handle `pointerupoutside`.
- Micro: prefer `Math.sqrt(dx*dx+dy*dy)` over `Math.hypot` on the move/sample hot
  path (hypot's overflow guard is measurably slower).

Verify with Playwright by driving the joystick handlers and asserting `sample()`
returns a fresh direction *without* a new move event (held-finger case), the
magnitude clamps to 1 past the radius, and a 2nd pointer can't hijack the drag.

## Autotest (Playwright)
After applying fixes, run the **`phaser-smoketest`** skill — it measures `game.loop.actualFps` in a real browser and fails below threshold, so the "after FPS" number is observed, not guessed. Use its measured FPS as the audit's after-value.

## Output of an audit
Report concretely: current FPS, the 2–3 worst offenders found (with `file:line`), the fix applied, and the after FPS (from the smoke-test). Don't claim "optimized" without a measured before/after.
