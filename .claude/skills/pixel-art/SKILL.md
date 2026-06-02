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

## 0. ALWAYS research the web first — before drawing ANYTHING

This is mandatory for **every** drawing task — game sprites AND hub cover art —
and it is **doubly** mandatory when the user did NOT supply a reference image.
Never draw "from imagination" first. Research serves two distinct purposes; do
both, not just the asset hunt:

1. **Reusable asset hunt** — is there a verified **CC0/free** asset that already
   fits? (Kenney.nl, OpenGameArt, itch.io "free", game-icons.net for props,
   lucide/tabler for UI.) Verify the **license** (CC0 / clearly-permissive /
   your-own only — never unknown-license art). If one fits, use it.
2. **Style/convention study** — even when you'll hand-draw, search how this
   subject is normally drawn so your shapes match player expectations. E.g.
   "crossy-road frog top-down", "survivor.io app icon", "gold miner claw icon",
   "flappy bird sprite". Look at how the silhouette, proportions, and signature
   props read at small size. THIS is what was missing when a survivor cover came
   out as an abstract cluster of circles and a gold-miner claw read as a roof —
   a 20-second style search fixes that before you draw.

Then draw (only if nothing reusable fits), and **Playwright-verify** the result
(see below). If the user gave a reference image, study it as the primary source
but still glance at the web for how the genre's icon/sprite is conventionally
drawn.

## Resolution — the grid size sets the detail ceiling (pick ONE tier)

The **number of cells in the sprite grid** decides how much detail is possible; it
is NOT the bake `px` (which only enlarges the source texture) nor the on-screen
`setScale`. Each step up **quadruples** the pixel count AND the drawing time:

| Grid | Pixels | Reads as | Time |
|------|--------|----------|------|
| 8×8   | 64    | silhouette only | fastest |
| 16×16 | 256   | category (bird/cat/skeleton); bold, cohesive | fast |
| 32×32 | 1,024 | facial expression, shading, texture | ~4× 16×16 |
| 64×64 | 4,096 | equipment, fine texture, AA edges | very high (8-frame walk ≈ a day) |

- **This repo's sprites today are ~8–16 px** (hero/frog/enemy grids ~10–16). That's
  the "16×16 — reads as the category" tier: clear silhouettes, retro-NES charm, fast.
- **More pixels ≠ better.** Low-res forces bold, consistent shapes; it's faster and
  stays cohesive. **Keep the whole game on one tier** — mixing 16 and 64 looks off.
- For a NEW pixel game, `phaser-new-game` **asks the user** which tier (8/16/32/64,
  with the detail/time tradeoff) before drawing. Recommend 16×16 (repo default),
  32×32 for expressive characters, 64×64 only for a showcase hero.

## Render gates (Phaser crispness — all must hold)
- `pixelArt: true` in the game config (sets nearest-neighbor + `roundPixels`).
- Author at a small **base resolution** (the tier above); scale up by **integer
  factors only** via `Scale.FIT` / `setScale`. Never fractional/"mixel" scaling — it
  destroys crispness (1.5× / 2.7× makes uneven pixels). Nearest-neighbor is the rule.
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

## Converting an existing image → pixel art (`scripts/pixelate.mjs`)

When the user supplies a PNG (their own art, or an AI "faux-pixel" image — soft
edges, off-grid blocks, hundreds of colours) and wants it to look like real pixel
art / render crisp under `pixelArt: true`, **do not hand-redraw it**. Use the repo
tool **`scripts/pixelate.mjs`** (Node + `pngjs`, no native deps):

```bash
node scripts/pixelate.mjs <input.png>                    # default: 56px tall, 24 colours
node scripts/pixelate.mjs <input.png> --h 72 --colors 32 # more facial detail
node scripts/pixelate.mjs <input.png> --h 56 --colors 16 # chunkier / retro
# batch a folder:
for f in games/<game>/public/heroes/*.png; do node scripts/pixelate.mjs "$f"; done
```

Pipeline (the classic image→pixel recipe): auto-trim transparent border → **box-
average downscale** to a small grid (merges AA into solid blocks better than nearest
for AA'd sources) → **median-cut palette** quantization → **hard alpha cutoff** (no
semi-transparent fringe) → write at grid resolution. **Output stays SMALL on
purpose** — let Phaser nearest-neighbor-upscale it; never bake the upscale in.
Defaults to `public/heroes-pixel/` (keeps originals); `--out` overrides.

**The crispness trap after pixelating:** a sprite scaled by a *fraction*
(`targetH / srcH` = e.g. 0.26×) re-blurs the pixels you just sharpened. After
pixelating, scale by an **integer** (or pick `targetH` = a multiple of the sprite
height). See `games/twdc-defense/src/objects/Hero.ts` (`baseScale` = nearest
integer, min 1) for the pattern.

**Note: only image PNGs need this.** Sprites already authored as char-grids and
baked via `bakeSprite` (`src/pixel`) are *already* crisp pixel art — pixelating
them is wrong. (In twdc-defense the 21 heroes were user PNGs → pixelated; the
zombies/tiles/FX are `baseArt.json` grids → left as-is.)

## Procedural animation from ONE static sprite (no spritesheet)

A pixelated image is **one pose** — it cannot become a real walk/attack cycle by
conversion (those frames don't exist in the source). Three levels, cheap→expensive:

- **Level 1 — fake it with transforms/tweens (DEFAULT for casual/TD games).** From
  a single image: `setFlipX` to face, a perpetual idle "breath" (tween `scaleY`),
  an attack squash+lunge (`scaleX/scaleY` + a few px toward the target), a hit
  flash (`setTint` + shake), a death topple (spin-flatten + fade), a walk **gait**
  (bob + lurch + tilt phased by distance travelled — sum two sines so it *bounces*,
  not a robotic single sine). Canonical implementations in this repo:
  `Hero.ts` (`startIdle`/`playAttack`/`playHit`) and `Zombie.ts`
  (`applyGait`/`playDeath`/`playEndAttack`). **This is enough for tower-defense.**
  Gotcha: drive a walk gait by **distance walked**, not wall-clock, so it stays in
  sync across slow/fast units; render gait as an offset around the true path
  position (don't accumulate, or the unit drifts off the road).
- **Level 2 — cut-out rig:** slice the sprite into parts (head/arms/legs), tween
  each → real swing/walk. Doable, medium fidelity.
- **Level 3 — hand-drawn spritesheet** (`load.spritesheet` + `anims.create`): the
  only path to authentic multi-frame pixel animation, but the frames must be
  *drawn* (by an artist / AI / procedurally) — they can't be derived from one
  image. Build the anim system, but be honest that you can't auto-generate frames
  that match a specific supplied character.

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

## SVG / vector art craft (the DEFAULT mode — see §0a of phaser-new-game)

Most games here use **SVG vector art** (smooth), pixel only on request. Craft rules
for vector sprites/icons/covers that read well, especially at small card/sprite size:

- **`viewBox`, never hardcoded width/height** — resolution-independent; the sprite
  scales to any display size. Put the critical detail in the **center**.
- **Solid fills > thin strokes for sub-32px art.** Thin strokes vanish when scaled
  down; build the silhouette from filled shapes. Use `stroke-linecap="round"` and a
  **high stroke-width relative to the viewBox** only where a line is essential.
- **Cheap outline / cell-shade for "pop":** duplicate a shape, scale it slightly
  larger, set it to a darker "outline" colour, drop it *below* the original. A second
  lighter shape on the light side = two-tone cell shading (depth without gradients).
- **Gradients** (when smoothness helps — covers, glows): `<linearGradient>` along a
  direction, `<radialGradient>` from a focal point, multi-stop for ramps. A radial
  white→transparent stop = a soft glow/highlight. Keep them few — flat reads cleaner
  at small size and stays light.
- **Filters for fx:** `feGaussianBlur` (soft glow/shadow), `feDropShadow`, chained
  primitives = Photoshop-ish effects without rasterizing. Use sparingly (cost + can
  muddy at small size).
- **Readable silhouette first** (same gate as pixel): the shape must be clear in solid
  black before adding colour/detail. **Verify at the TARGET size** (sprite scale, or
  86% of a 190px hub card) with Playwright — a cover fine in isolation can read as a
  blob on a card (a real miss we hit on survivor/gold-miner). Show old-vs-new when
  redrawing.
- **Baking in this repo:** game sprites either `load.svg(key, url, {scale})` (rasterize
  once at load) or are built with `Graphics.generateTexture` (the frog/dungeon-pets
  art). Hub covers are inline `cover.svg`. Either way, **research the genre's icon
  style first** (§0 below / phaser-new-game §0a), then draw, then verify.

## Advanced pixel techniques (pixel mode)

- **Dithering** — alternate two palette colours in a pattern to fake a third / a
  gradient without adding colours. Good for skies, metal, retro texture; **avoid on
  small objects, faces, and anything needing readability** (it muddies them).
- **Manual anti-aliasing** — pixel art is normally AA-off (crisp), but you can *hand*-
  place 1–2 intermediate-value pixels on a hard diagonal/curve to smooth it. Use
  intentionally and sparingly; never a blanket blur.
- **Selout (selective outline)** — outline in the local ramp's darkest tone, not flat
  `#000` everywhere, so the outline has hue/value variety (already in the craft gates).
- **Colour-cycling animation** — animate by *cycling an indexed palette* (not redrawing
  pixels): flowing water, lava, blinking lights, sparkles — near-zero data. In Phaser,
  swap a few palette entries on a timer or re-tint.

## Anti-patterns to refuse
- Fractional scale or non-integer sprite positions on a pixel canvas.
- Re-baking a texture every frame (bake once, cache by key).
- Flat-black pillow outlines / shading with no light direction.
- Unbounded ad-hoc palette instead of Sweetie-16 ramps.
- Loading a PNG when a small char-grid would do (heavier, less cohesive).
- `antialias: true` on a pixel game.

## Adding a game cover / thumbnail (for the hub)

**Research the web first (§0)** — study how this game's genre is drawn as an
app-icon/cover before drawing, then **preview + Playwright-verify on a real card
background** before committing (a cover that looks fine in isolation can read as
an abstract blob at 86% of a 190px card).

Cover artwork priority (per game), resolved by `scripts/build-all.mjs`:
1. committed **`games/<name>/cover.svg`** — inlined into the card (**default for
   SVG/vector games**; smooth, scales perfectly). This is what the 4 current games
   use.
2. `games/<name>/cover.png` — data-URI'd (raster; opts into crisp scaling).
3. `game.json` `"thumb": { grid, map }` (a `PixelGrid`) — rendered as **inline
   SVG** at build time (one `<rect>` per cell, `gridToSvg`), NOT a Phaser bake.
   Use for pixel games. Sweetie-16 hexes, equal-length rows.
4. none → default cabinet glyph.

**Hub CSS note:** `.card-art` no longer force-pixelates; vector `cover.svg` stays
smooth, while pixel thumbs / PNGs opt back into crisp scaling via a
`svg.card-art[shape-rendering="crispEdges"]` / `img.card-art` selector. Keep the
live `scripts/hub-template.mjs` and `templates/root/scripts/hub-template.mjs` in
sync.

**Verify recipe (covers):** write the candidate SVG(s), build a tiny preview HTML
that places each on its real pastel card (same 86% sizing), serve it, screenshot
via Playwright, and judge readability at card size. Show an **old-vs-new** pair
when redrawing. Only commit once the silhouette + signature props read clearly.

See also: `phaser-new-game` (scaffolds games that import this helper),
`phaser-smoketest` (verifies the rendered result), and `sources.md`.
