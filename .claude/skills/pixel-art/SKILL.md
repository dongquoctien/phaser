---
name: pixel-art
description: Draw crisp procedural pixel-art in Phaser (games + the hub) for this monorepo — Sweetie-16 palette, dark→light value ramps with hue-shifting, one light direction, selective outlines, contact shadows, integer-only scaling, nearest-neighbor render flags — baked once via the shared src/pixel helper. Use when the user wants to "draw pixel art", "make/draw a sprite/tile/icon", "vẽ pixel", "vẽ sprite", "tạo icon pixel", "pixel thumbnail", "bake a texture", or says art "looks off / blurry / not pixel / mờ / không đúng style".
---

# Pixel Art — Phaser (this monorepo)

Draw and review pixel art to a consistent, professional standard. This project
renders sprites **procedurally in code** (Phaser Graphics → cached texture), not in
an image editor, so the craft rules below are carried into code and paired with the
shared helper at **`src/pixel/`** (`palette` + `color` + `bake`).

Distilled from public references (see `sources.md`): SLYNYRD Pixelblog,
Saint11/Pedro Medeiros, Lospec, Derek Yu, the official Phaser Pixel-Art Guide, and
Belén Albeza's "retro crisp pixel art in Phaser". **All code here is authored from
those public sources — not copied from any other repo.**

## When to use
- Drawing/generating any sprite, tile, icon, thumbnail, or FX for a game or the hub.
- Art "looks off / blurry / not crisp / out of place" — diagnose with the gates below
  (almost always: fractional scale, no nearest-neighbor, flat shading, or unbounded palette).

Always prefer the **`src/pixel/` helper** over ad-hoc `graphics.fill*` calls so output
stays cohesive and cached.

## Render gates (Phaser crispness — all must hold)
- `pixelArt: true` in the game config (sets nearest-neighbor + `roundPixels`).
- Author at a small **base resolution**; scale up by **integer factors only** via
  `Scale.FIT`. Never fractional/"mixel" scaling — it destroys crispness.
- No fractional positions for pixel sprites (`Math.round` / rely on `roundPixels`).
- **Bake once, reuse.** Generate the texture in `create`/preload, never per frame.

## Craft gates (the art) — review every new sprite against these
1. **Limited cohesive palette.** Use **Sweetie-16** (`SWEETIE16` / `SWEETIE16_HEX`).
   One small shared palette across the whole project = cohesion.
2. **Value ramps, dark→light.** Shade with an ordered ramp, not random colours
   (`ramp(base, steps)`).
3. **Hue-shift along the ramp** (~20–45°): warm toward the **light**, cool toward the
   **shadow**. Never single-hue lighten/darken — that reads flat. (`lit()` / `shade()`.)
4. **One light direction** (default top-left). Highlights on one side, shadow opposite.
5. **No pillow-shading** (don't shade evenly inward toward the center).
6. **Contact shadow** under grounded objects so they don't float.
7. **Selective outline (selout):** outline in the local ramp's darkest, not flat
   `#000` everywhere — except where flat black genuinely aids readability.
8. **Readable silhouette first.** If the shape isn't clear in solid black, fix the
   shape before shading.
9. **No anti-aliasing / no soft gradients.** Hard pixels only.

## Two techniques
- **Char-grid → `bakeSprite`** (preferred for icons / thumbnails / decor):
  ```ts
  import { bakeSprite, SWEETIE16_HEX as H } from '../../src/pixel';
  const STAR = {
    grid: ['..k..', '.kyk.', 'kyyyk', '.kyk.', '..k..'],
    map: { k: H.black, y: H.yellow, '.': null }, // '.' = transparent
  };
  const { key } = bakeSprite(this, 'gen:star', STAR, { px: 4 });
  this.add.image(x, y, key);
  ```
  Deterministic, diffable, and the same shape can live in a game's `game.json`
  `thumb` so the hub renders it.
- **`make.graphics().generateTexture()`** (parametric shapes — circles, stretched
  bars): see the canonical example in
  `games/flappy-bird/src/scenes/PreloadScene.ts` (`generateTextures()` bakes the
  bird/pipe/ground). `bakeIndexed()` wraps Phaser's built-in indexed generator.

## Helper API (`src/pixel/`)
- `SWEETIE16` (0xRRGGBB) · `SWEETIE16_HEX` ("#..") · `SWEETIE16_ARRAY` (len 16).
- `ramp(base, steps, {hueShiftDeg, valueSpread})` → `[darkest..lightest]`.
- `lit(c, steps?)` / `shade(c, steps?)` — hue-shifted highlight / shadow of a colour.
- `hueShift(c, deg, {val, sat})` · `lerpColor(a, b, t)`.
- `bakeSprite(scene, key, {grid, map}, {px})` → `{ key, width, height }` (idempotent
  on key; throws on ragged rows / unmapped char).
- `BUILTINS` — `cabinet` / `gamepad` / `bird` / `play` ready-made grids.

## Anti-patterns to refuse
- Fractional scale or non-integer sprite positions on a pixel canvas.
- Re-baking a texture every frame (bake once, cache by key).
- Flat-black pillow outlines / shading with no light direction.
- Unbounded ad-hoc palette instead of Sweetie-16 ramps.
- Loading a PNG when a small char-grid would do (heavier, less cohesive).
- `antialias: true` on a pixel game.

## Adding a game thumbnail (for the hub)
A game's `game.json` may carry `"thumb": { "grid": [...], "map": { "y": "#ffcd75", ".": null } }`
(a `PixelGrid`). The hub bakes it via `bakeSprite`. Omit it → the hub uses
`BUILTINS.cabinet`. Use Sweetie-16 hexes and keep rows equal length.

See also: `phaser-new-game` (scaffolds games that import this helper),
`phaser-smoketest` (verifies the rendered result), and `sources.md`.
