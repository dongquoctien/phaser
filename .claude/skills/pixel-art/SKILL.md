---
name: pixel-art
description: Draw art for Phaser games + the hub in this monorepo. DEFAULT is SVG vector art (research a verified free asset first, then draw); PIXEL-ART mode (Sweetie-16 palette, value ramps + hue-shift, one light direction, selout outlines, integer scaling, nearest-neighbor, baked via src/pixel) is used only when the user asks for "pixel" or for hub thumbnails. Use when the user wants to "draw/make a sprite/tile/icon", "vẽ", "tạo icon", "thumbnail", "bake a texture", or says art "looks off / blurry / mờ / không đúng style". Always research a fitting free asset (Kenney/OpenGameArt/game-icons, CC0) and Playwright-verify it before hand-drawing.
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
  bird/pipe/ground).

## Phaser 4 — pixel generators & crisp config

**This project is on Phaser 4.1.0.** Full details: **`.claude/skills/PHASER4.md`**
(§3 pixel-crisp, §2 procedural textures). Essentials for pixel mode:

- **`Graphics.generateTexture(key,w,h)` is kept** (synchronous, both renderers) — this
  is what `bakeSprite` uses. The primary procedural-texture path.
- **`Textures.generate()` + Create Palettes (ARNE16/C64/…) were REMOVED in v4.** Our old
  `bakeIndexed()` wrapper went with it — use `bakeSprite()` (more capable: readable
  `char → hex` map + Sweetie-16 ramps/hue-shift, not a fixed 16-colour index).
- **Crisp gate**: `roundPixels` defaults to **`false`** in v4. Use **`pixelArt: true`**
  (→ `antialias:false` + `roundPixels:true` + nearest-neighbor) for pixel games; every
  pixel config also sets `render.roundPixels: true` explicitly. roundPixels only rounds
  **axis-aligned, unscaled** objects.
- **Rotated/scaled pixel sprites**: use **`smoothPixelArt: true`** (WebGL-only;
  mutually exclusive with `pixelArt`) or set `GameObject#vertexRoundMode` (`'full'`).
- `addFlatColor`/`addUint8Array` exist but are **WebGL-only** — guard by renderer type;
  `addBase64` is **async**. Prefer `generateTexture` (sync, both modes) for bake-at-boot.

There is **no built-in sprite/asset library** in any Phaser version — Phaser only loads
art you provide.

### Tint (v4) — quick cheatsheet
`setTintFill(c)` was REMOVED → `setTint(c).setTintMode(Phaser.TintModes.FILL)`. Modes:
`MULTIPLY | FILL | ADD | SCREEN | OVERLAY | HARD_LIGHT`.

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
(a `PixelGrid`). The static-HTML hub renders it as **inline SVG** at build time (one
`<rect>` per cell — `scripts/hub-template.mjs` `gridToSvg`), NOT a Phaser bake. Omit it →
the hub draws a default cabinet glyph; a committed `games/<name>/cover.svg`/`cover.png`
overrides it. Use Sweetie-16 hexes and keep rows equal length.

See also: `phaser-new-game` (scaffolds games that import this helper),
`phaser-smoketest` (verifies the rendered result), and `sources.md`.
