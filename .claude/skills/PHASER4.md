# Phaser 4.1.0 — Reference (v3→v4)

Shared reference for all `phaser-*` and `pixel-art` skills in this monorepo. The
project is on **Phaser 4.1.0**. Read the relevant section before writing v4 code or
porting v3 snippets. Distilled from the official v3→v4 migration guide + v4.1.0 docs.

## 1. Breaking changes checklist (each breaks v3 code; replacement inline)

- **`render.roundPixels` defaults to `false`** (was effectively true). Pixel games must
  set `pixelArt: true` (→ `antialias:false` + `roundPixels:true`) or `roundPixels:true`
  explicitly. roundPixels now only acts on axis-aligned, **unscaled** objects.
- **`setTintFill()` / `tintFill` REMOVED** → `setTint(c).setTintMode(Phaser.TintModes.FILL)`.
  `setTint()` no longer disables fill mode for you.
- **`Group#children` is a native `Set<GameObject>`** (not `Phaser.Structs.Set`).
  `group.children.entries` is `undefined` → use **`group.getChildren()`** (still
  `GameObject[]`) or `group.children.forEach(...)` / `for..of`.
- **`Phaser.Struct.Set` / `Phaser.Struct.Map` removed** → native JS `Set`/`Map`. Helpers
  gone (`iterateLocal`, `contains`, `setAll`, `getArray`). *(`scene.children` DisplayList
  still has `.list` + `getChildren()` — only Groups changed.)*
- **`Math.TAU` changed value**: was `PI/2`, now `PI*2`. `Math.PI2` removed. Old `PI/2`
  value → **`Math.PI_OVER_2`**. Silent 4× breakage in angle math.
- **`Geom.Point` + all Point functions REMOVED** → `Math.Vector2`. Geom getters
  (`getPoint`, `getRandomPoint`…) return `Vector2`. `instanceof Geom.Point` always false.
- **`TextureManager.generate()` + `Create.GenerateTexture` + Create Palettes REMOVED.**
  v3 pixel-grid-string baking gone → **`Graphics.generateTexture(key,w,h)`** (kept,
  unchanged, synchronous, both renderers), or `createCanvas`/`addCanvas`+draw, or
  `addBase64`.
- **DynamicTexture / RenderTexture draws are BUFFERED** — must call **`.render()`** to
  flush. Draw-then-read renders nothing, no error. (#1 silent footgun.)
- **v3 pipeline system removed** → `RenderNode` architecture. `WebGLPipeline` and friends
  gone; custom pipelines rewritten as render nodes.
- **`sprite.setPipeline('Light2D')` removed** → **`sprite.setLighting(true)`**.
- **FX (pre/post) + Masks unified into one Filter system**: `obj.filters.internal`
  (object) / `obj.filters.external` (fullscreen). `new BitmapMask(...)` →
  `obj.filters.internal.addMask(maskObj)`. Some FX → `Phaser.Actions.AddEffectBloom/
  AddEffectShine/AddMaskShape`; `ColorMatrix` methods under `filter.colorMatrix.*`.
- **`Mesh`, `Plane`, `Camera3D`, `Layer3D` removed** (3D later) — no drop-in.
- **`Camera#matrix` no longer includes position** → `matrixExternal` (position),
  `matrixCombined`. `GetCalcMatrix()` takes an `ignoreCameraPosition` arg.
- **`TransformMatrix#setQuad` lost its `roundPixels` param** → per-object
  `GameObject#vertexRoundMode`.
- **`TileSprite` rewritten** (no crop, new wrap shader, adds `tileRotation`).
- **`Shader` ctor takes a `ShaderQuadConfig` object**; Shadertoy resolution/time uniforms
  not auto-set (use `setUniform`); `setTextures()` REPLACES the array (was append).
- **Textures use GL orientation (Y=0 bottom).** PNG/JPG auto-handled; **compressed
  KTX/PVR/Basis render upside-down unless re-exported flip-Y**; custom shaders use GL UVs.
- **Canvas renderer DEPRECATED** — use `Phaser.AUTO`/`WEBGL`, don't force `CANVAS`.
- Removed: Facebook Instant Games plugin, `phaser-ie9.js`, legacy polyfills.

## 2. v4 APIs to prefer

- **Tint**: `setTint(color).setTintMode(mode)` — `Phaser.TintModes`:
  `MULTIPLY | FILL | ADD | SCREEN | OVERLAY | HARD_LIGHT`.
- **Per-object rounding**: `GameObject#vertexRoundMode` = `'off' | 'safe' | 'safeAuto'`
  (default) `| 'full' | 'fullAuto'`.
- **Filters**: `obj.filters.internal` / `.external`, `.addMask(maskObj)`; `ImageLight`.
- **DynamicTexture**: `.render()` (flush — required), `.preserve()` (keep buffer),
  `.callback()`, `.capture`. `RenderTexture.renderMode`: `'render' | 'redraw' | 'all'`.
- **Lighting**: `sprite.setLighting(true)`; lights have a `z` height; self-shadowing.
- **Procedural textures** (Textures.generate is gone — use these):
  - `Graphics.generateTexture(key, [w], [h])` — KEPT, synchronous, Canvas+WebGL.
    **Primary path.** What our `src/pixel` `bakeSprite` uses.
  - `TextureManager.addBase64(key, data)` — Canvas+WebGL, **async** (wait for ADD event).
  - `TextureManager.createCanvas(key, [w=256], [h=256])` → CanvasTexture to draw to;
    `addCanvas(key, source, [skipCache])`. Both renderers.
  - `TextureManager.addFlatColor(key, w, h, [color], [alpha])` — NEW, **WebGL-only**.
  - `TextureManager.addUint8Array(key, data, w, h)` — NEW, raw RGBA, **WebGL-only**.
- **SVG loader**: `this.load.svg(key, [url], [svgConfig], [xhrSettings])` — see §4.
- **GameObjectFactory additions**: `nineslice()` (stretchable UI panels — use instead of
  manual 9-patch), `layer()`, `captureFrame(key)`, `extern()`; WebGL-only: `gradient()`,
  noise generators. Unchanged: `image/sprite/graphics`.
- **Render config**: `pathDetailThreshold`, `renderNodes`, `selfShadow`,
  `skipUnreadyShaders`, `maxTextures` (`-1`=all), `maxLights`, `batchSize`,
  `autoMobileTextures`, `mipmapFilter`, `mipmapRegeneration` (new 4.1.0), `antialiasGL`.
- **Math**: `Math.PI_OVER_2` (old TAU); `Vector2.setLength/.length`.
- **Tweens**: `scene.tweens.chain({ targets, tweens:[...] })` for sequences. Timeline
  still exists.
- **Atlas**: new **PCT (Phaser Compact Texture)** format ~90–95% smaller than JSON atlas
  — prefer as a packing target.
- **High-throughput**: `SpriteGPULayer`, `TilemapGPULayer` for huge quad counts.

## 3. Pixel-crisp on v4

- `roundPixels` defaults **false** — crisp is NOT automatic.
- **`pixelArt: true`** is the switch → forces `antialias:false` + `roundPixels:true` +
  nearest-neighbor. Don't set a manual filter; use `pixelArt`.
- roundPixels only rounds **axis-aligned, unscaled** objects; rotated/scaled still sub-pixel.
- **`smoothPixelArt: true`** (NEW, WebGL-only): `antialias:true` + `pixelArt:false`; keeps
  blocky texels but smooths edges when scaled — for games that rotate/scale pixel sprites.
- `pixelArt` and `smoothPixelArt` are **mutually exclusive**.
- `GameObject#vertexRoundMode` (default `'safeAuto'`) for per-object rounding of
  transforming pixel sprites.

## 4. SVG in Phaser 4 (this is the DEFAULT art path for new games)

- **`this.load.svg(key, [url], [svgConfig], [xhrSettings])`**. `svgConfig` =
  `Phaser.Types.Loader.FileTypes.SVGSizeConfig` `{ width?, height?, scale? }`.
  - `load.svg(key, url)` → SVG intrinsic size.
  - `load.svg(key, url, { width, height })` → explicit output pixels.
  - `load.svg(key, url, { scale })` → multiplies native size. **`scale` overrides
    `width`/`height`** if both given.
- **SVG rasterizes ONCE to a bitmap at load time** — not retained as live vector. The
  baked resolution is fixed.
- **Scaling the GameObject up past the baked size at runtime = BLUR.** Bake at the
  **largest** on-screen display size (account for HiDPI: `{ scale: DPR }`), not via
  `sprite.setScale()`.
- **Choosing an art path**:
  - **SVG** (default): clean vector — UI, icons, logos, smooth shapes. Bake at max size.
  - **Raster/atlas (PCT)**: photographic/painted, many frames, animation.
  - **Procedural** (`Graphics.generateTexture`/`createCanvas`): generated, placeholders,
    pixel-art baking.

## 5. Gotchas / silent traps

- DynamicTexture/RenderTexture draws are **buffered** — forgetting `.render()` shows
  NOTHING, no error.
- `roundPixels` default false → pixel art shimmers unless `pixelArt:true`.
- **`group.children.entries` is `undefined`** — use `getChildren()` / `children.forEach`.
- `setTint()` no longer flips on fill — add `.setTintMode(FILL)`.
- `Math.TAU` silently `PI*2` (was `PI/2`).
- Geom getters return `Vector2` not `Point`.
- `this.textures.generate(...)` throws "not a function" — migrate (see §2).
- `addFlatColor` / `addUint8Array` are **WebGL-only** → null under Canvas fallback. Guard
  by renderer type or use `addCanvas`/`generateTexture`.
- `addBase64` is **async** — wait for the ADD event; `generateTexture` is synchronous
  (safer for bake-at-boot).
- `createCanvas` defaults to **256×256** if dims omitted — pass explicit dims.
- SVG over-`setScale()` past baked size = blur.
- Compressed textures render upside-down unless flip-Y.
- **`Phaser` is NOT a runtime global** (module-only) — don't use `Phaser.VERSION`/
  `Phaser.WEBGL` in page-eval scripts; read off the game instance.
- Lighting/filters/shaders **break draw-call batching** — use sparingly (perf).

## 6. UNCHANGED / safe (don't over-warn)

- **Scene lifecycle** `init/preload/create/update(time,delta)` + plugin accessors
  (`this.add/physics/tweens/input/time/cameras/load/scene/events`) — unchanged.
- **ScenePlugin** `start/switch/launch/pause/resume/sleep/wake/stop/restart` — unchanged.
- **`scene.children`** still `.list` + `getChildren()`. Only `Group#children` is a Set.
- **`Graphics.generateTexture`** — kept, synchronous, both renderers.
- **Arcade Physics surface** unchanged: `body.setSize/setOffset/setVelocity/...`,
  `physics.add.enable/group/collider/overlap`, `group.getChildren()`.
- **Tweens basics** + **Timeline** — unchanged.
- **Input**: `pointerdown/up/move`, `keyboard.createCursorKeys()/addKey()`,
  `setInteractive({draggable})` + drag events — unchanged.
- Factory signatures `image/sprite/graphics` — unchanged.
