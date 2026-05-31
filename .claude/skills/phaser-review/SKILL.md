---
name: phaser-review
description: Review a Phaser + TypeScript game in this monorepo against the project's pro conventions — scene structure, key constants, object pooling, asset/atlas discipline, scene-lifecycle cleanup, physics choice, and TS strictness. Use when the user asks to "review" a game, "check conventions", "code review", "review game", or before merging new game code. Produces a findings list; does not auto-rewrite unless asked.
---

# Phaser — Convention Review

Review the target game (`games/<name>/`) against the monorepo standard. Output a concise findings list grouped by severity (blocker / should-fix / nit), each with `file:line` and a concrete fix. Only edit code if the user asks.

## Checklist

### Structure & keys
- [ ] Scenes live in `src/scenes/`, one class per file, extending `Phaser.Scene`.
- [ ] Boot → Preload → Menu → Game flow present; Boot is light, Preload owns all asset loading with a progress bar.
- [ ] **No raw string literals** for scene/texture/anim keys — everything goes through `types/keys.ts` (`SceneKeys`, `AtlasKeys`, `AudioKeys`).
- [ ] Game config is centralized in `config.ts`; `main.ts` only bootstraps.

### Assets
- [ ] Sprites loaded via `load.atlas()` (one per category), **not** many `load.image()` calls. Flag loose PNGs → point to `phaser-optimize-bundle`.
- [ ] Animations built with `anims.generateFrameNames` off the atlas, not per-frame images.
- [ ] Audio provides ogg+mp3.

### Performance hygiene
- [ ] Spawned-in-a-loop objects (bullets/enemies/particles) use the **Pool** (`systems/Pool.ts`), not `new`/`destroy` in `update()`.
- [ ] No allocation in the hot path (`update()` / per-frame callbacks): no `new`, no array `.map/.filter`, no rebuilt closures, no per-frame `setText` of unchanged values.
- [ ] `setVisible(false)` to hide, not `setAlpha(0)`.
- [ ] Off-screen bodies disabled / culled where the game has many entities.

### Physics
- [ ] Arcade unless polygon/joints genuinely needed (flag any Matter use and ask why).
- [ ] `physics.arcade.debug` gated on `__DEV__`, off in production.
- [ ] Static groups for immovable geometry.

### Lifecycle & leaks
- [ ] Event listeners / timers / tweens registered in `create()` are cleaned up in `shutdown()` (or via `this.events.once(SHUTDOWN, ...)`).
- [ ] No references held to destroyed objects.

### TypeScript / quality
- [ ] `strict` on (inherited from `tsconfig.base.json`); no stray `any` for game objects.
- [ ] Pure game logic (score, spawning rules) lives in `systems/`, decoupled from scene rendering where reasonable.
- [ ] `npm run typecheck` passes for the game.

## Phaser 4 v3-ism scanner (this project is on Phaser 4.1.0)

Flag any of these leftover v3 patterns (each is a blocker — breaks or silently
misbehaves on v4). Full context: `.claude/skills/PHASER4.md`.

- `setTintFill(` / `.tintFill` → `setTint(c).setTintMode(Phaser.TintModes.FILL)`.
- `.children.entries` on a **Group** → `getChildren()` (Group#children is a native Set).
- `Phaser.Struct.Set` / `Phaser.Struct.Map` → native `Set`/`Map`.
- `Phaser.Geom.Point` / `new Phaser.Geom.Point` / `instanceof ...Point` → `Math.Vector2`.
- `Math.TAU` (value changed to PI*2) / `Math.PI2` (removed) → `Math.PI_OVER_2` for old value.
- `this.textures.generate(` → `Graphics.generateTexture` (removed in v4).
- `setPipeline('Light2D')` → `setLighting(true)`; any custom `WebGLPipeline`.
- `new Phaser.Display.Masks.BitmapMask` → `obj.filters.internal.addMask(maskObj)`.
- `Mesh` / `Plane` / `Camera3D` / `Layer3D` (removed — no drop-in).
- A `RenderTexture`/`DynamicTexture` drawn but never `.render()`-ed (renders nothing).
- `Phaser.CANVAS` forced (Canvas renderer deprecated) → `Phaser.AUTO`.
- **SVG** GameObject `setScale()`'d well above its loaded raster size (blur — bake bigger).
- `addFlatColor`/`addUint8Array` used without a WebGL-only guard; `addBase64` read
  synchronously (it's async).
- Pixel game missing `pixelArt: true` / explicit `roundPixels: true` (v4 default false).

## How to run
1. Read `games/<name>/src/**` (scenes, objects, systems, config, keys).
2. Walk the checklist + the v4 scanner; collect findings with exact `file:line`.
3. Group by severity, give each a one-line fix. Offer to apply blockers/should-fixes if the user wants.
4. Cross-reference siblings: heavy-asset issues → `phaser-optimize-bundle`; FPS/GC issues → `phaser-perf-audit`; art → `pixel-art`.
