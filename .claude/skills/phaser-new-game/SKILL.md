---
name: phaser-new-game
description: Scaffold a new Phaser 4.1.0 + Vite + TypeScript game inside this monorepo, with the project-standard pixel-art config, scene structure, asset pipeline, and object-pooling/atlas conventions baked in. Use when the user wants to "create a new game", "add a game", "scaffold a Phaser game", "tạo game mới", "thêm game".
---

# Phaser — New Game Scaffold

Create a new, production-grade Phaser pixel-art game in this monorepo. Every game shares the same toolchain (Vite + TypeScript), so only per-game source is generated — the root tooling stays shared.

## 0. Conventions of this monorepo

```
phaser/
├─ package.json              # root: shared deps (phaser, vite, typescript), workspace scripts
├─ tsconfig.base.json        # shared TS config
├─ vite.config.shared.mjs    # shared Vite build config (see phaser-optimize-bundle)
└─ games/
   └─ <game-name>/           # one folder per game — self-contained
      ├─ index.html
      ├─ vite.config.mjs     # extends the shared config, sets base + outDir
      ├─ public/
      │  └─ assets/          # atlases (.png + .json), audio, tilemaps — served as-is
      └─ src/
         ├─ main.ts          # bootstrap: new Phaser.Game(config)
         ├─ config.ts        # the GameConfig object (one source of truth)
         ├─ scenes/
         │  ├─ BootScene.ts      # set scale, load the loading-bar atlas only
         │  ├─ PreloadScene.ts   # load ALL atlases/audio with a progress bar
         │  ├─ MenuScene.ts
         │  └─ GameScene.ts
         ├─ objects/         # GameObject subclasses (Player, Enemy, Bullet…)
         ├─ systems/         # pools, spawners, score — framework-agnostic logic
         └─ types/           # shared TS types/enums (SceneKeys, AssetKeys)
```

**Non-negotiables for "chuẩn / pro / nhẹ":**
- One **texture atlas per category** (sprites / ui / fx), never loose PNGs.
- **Object pooling** for anything spawned in a loop (bullets, particles, enemies).
- **String-key constants** in `types/` — never raw string literals for scene/asset keys.
- Arcade physics by default (Matter only if polygon collisions are truly needed).
- `physics.arcade.debug` and any FPS overlay are **off** in the production config.

## 0a. Art strategy — SVG by default, pixel ONLY when asked

The default visual style for a NEW game is **SVG vector art** (smooth, scalable,
crisp at any resolution). Use **pixel-art ONLY when the user explicitly says
"pixel"** (or the game is clearly retro/8-bit by request).

- **SVG default** → do NOT set `pixelArt: true`; load art with `this.load.svg(key,
  url, { scale } | { width, height })`. SVG **rasterizes once at load** — bake at the
  largest on-screen size (`{ scale: window.devicePixelRatio }` for HiDPI); upscaling
  past the baked size at runtime blurs. Keep `antialias` on (default) for smooth vectors.
- **Pixel mode** (only on request) → `pixelArt: true` + `render.roundPixels: true`
  (Phaser 4 defaults roundPixels to false), draw via the `src/pixel/` helper.
- **UI panels** that stretch → use the v4 `this.add.nineslice(...)` instead of a
  hand-rolled 9-patch.

> Full v4 API surface, breaking changes, and gotchas: **`.claude/skills/PHASER4.md`**.
> This project is on **Phaser 4.1.0** — the Canvas renderer is deprecated (use
> `Phaser.AUTO`), `Group#children` is a Set (use `getChildren()`), and
> `Textures.generate` is gone (use `Graphics.generateTexture`).

### Before drawing ANY art — research the web first, draw last
**Mandatory. Especially when the user did NOT provide a reference image — if they
gave no art, you MUST search the web before drawing, never invent from memory.**
Research has two purposes (do both):
1. **Reusable asset hunt** — a fitting **CC0/free** asset that already works:
   CC0/free game art (**Kenney.nl**, **OpenGameArt**, itch.io "free"), or SVG icon
   sets (**game-icons.net** for game props, **lucide** / **tabler** for UI).
2. **Style/convention study** — search how this subject is normally drawn (e.g.
   "crossy-road frog top-down sprite", "survivor.io app icon") so your shapes match
   what players expect at small size, even when you hand-draw.
3. **Verify the LICENSE** — only CC0 / clearly-permissive / your-own. Never use art
   of unknown license (e.g. media in Phaser's own example repos is unlicensed).
4. **Verify it fits with Playwright**: drop the candidate into the game (or a tiny
   preview page), render it, screenshot, and judge — right silhouette, readable at
   game size, matches the other art's style/palette.
5. **Only if nothing fits → draw it** (SVG for default games via the `pixel-art`
   skill's craft rules, or a pixel grid if in pixel mode). Re-verify the drawn art
   the same way (zoom in; readable silhouette first).

> The hub **cover.svg** follows the same protocol — research the genre's icon
> style, draw, then Playwright-verify on a real card. See `pixel-art` §0 and
> "Adding a game cover / thumbnail".

## 1. Steps

1. **Ask the game name** (kebab-case) if not given. Path becomes `games/<name>/`.
2. **Ensure root tooling exists.** If `games/` or root `package.json` is missing, create the shared root from `templates/root/` (see below) first — this is a one-time bootstrap.
3. **Copy `templates/game/`** into `games/<name>/`, substituting:
   - `__GAME_NAME__` → the kebab name,
   - `__GAME_TITLE__` → a Title Case version (in `index.html` `<title>` **and** `game.json`),
   - `__DEV_PORT__` / `__PREVIEW_PORT__` → a unique port pair not used by another game (start at 5180/4180 and increment per game). Each game gets a **fixed `strictPort`** so dev servers in the monorepo never collide.
   - In `game.json`, optionally fill `description` and `tags` — the hub shows them on the game's card. Both are optional; an empty description/tags falls back to a title-only card.
4. **Wire the workspace**: add `games/<name>` to the root `package.json` `workspaces` array (if using npm workspaces) and add `dev:<name>` / `build:<name>` / `preview:<name>` scripts. No hub edit needed — `scripts/build-all.mjs` auto-discovers every `games/*` with a `vite.config.mjs` and regenerates the hub (`dist/index.html`) + deploys it, so a new game appears on the landing page automatically.
5. **Install** (`npm install` at root) only if deps changed.
6. **Autotest (Playwright)**: run the **`phaser-smoketest`** skill against the new game — it boots the game in a real browser and asserts canvas renders, console is clean, FPS ≥ 55, and screenshots each scene. This is the real "it works" gate; report its pass/fail table. Do not leave the dev server running unless asked.

## 2. Template files

The ready-to-copy templates live next to this skill under `templates/`. Read them, substitute placeholders, and write them into the new game folder. Key files and the *why*:

- **`config.ts`** — the single GameConfig. Pixel-art + Arcade + Scale.FIT + `render.powerPreference: 'high-performance'`. Scene list references `SceneKeys`.
- **`scenes/BootScene.ts`** — sets `this.scale` mode, loads only the loading-bar texture, then `start(PreloadScene)`.
- **`scenes/PreloadScene.ts`** — loads every atlas/audio, draws a progress bar off `this.load.on('progress')`, then `start(MenuScene)`.
- **`systems/Pool.ts`** — generic typed object pool wrapper around `Phaser.GameObjects.Group` with `spawn()`/`despawn()`. Re-used by every game.
- **`objects/PooledSprite.ts`** — base class that knows how to reset itself for the pool.
- **`game.json`** — hub card metadata: `{ title, description?, tags?[], thumb? }`. All optional except title; consumed by the hub.

## 2b. Hub conventions (static-HTML "COLLECTION" card grid)

The landing page is a **static HTML/CSS page** generated at build time by
`scripts/build-all.mjs` via `scripts/hub-template.mjs` (`renderHub`). It is NOT a
Phaser app — it's a dark "COLLECTION"-style grid of **pastel trading cards**, one per
game (responsive `auto-fill`, ~190px min, 1→6 cols; colors cycle through a pastel
palette so a new game auto-gets a color). Zero JS, no network font. Keep `src/pixel/`
(games) and `scripts/{build-all,hub-template}.mjs` in sync between the live repo and
`templates/root/`.

- **Game art** follows §0a (SVG by default; pixel only on request; research a verified free asset before drawing).
- **Card artwork** priority (per game): committed `games/<name>/cover.svg` (inlined) →
  `cover.png` (data-URI) → the pixel `game.json.thumb` rendered as **inline SVG** (via
  `gridToSvg`) → a default cabinet glyph. `thumb` is a `PixelGrid { grid, map }`
  (equal-length rows, hex/`null` map) — still authored with the `pixel-art` skill.
- **Card text** comes from `games/<name>/game.json` (`title`/`tags`; `description` →
  `aria-label`). Missing/malformed `game.json` never breaks the build — falls back to `<title>`.
- **`build-all.mjs`** builds each game (Vite) into `dist/<game>/`, resolves each card's
  artwork, then writes `dist/index.html` (the cards ARE the crawlable `<a>` content — no
  separate fallback needed) + `dist/.nojekyll`. A new game appears automatically.
- **Windows build**: run `build:all` via PowerShell or set base via env — Git Bash
  mangles a bare leading `/` (MSYS). Base comes through the `GAME_BASE` env, never `--base /`.

## 3. Anti-patterns to refuse

- Loading individual PNGs per sprite → use an atlas (point them to `phaser-optimize-bundle`).
- `new Bullet()` / `.destroy()` in `update()` → use the Pool.
- Importing all of Phaser into shared libs that don't need it (kills tree-shaking).
- Hardcoded canvas dimensions instead of `Scale.FIT` + relative sizing.
- **Virtual joystick that reads direction inside `pointermove`** → feels laggy on
  phones (move events fire less often than the frame loop and stop when the finger
  is held). Recompute `dx/dy` every frame in `sample()`/`update()` from the owning
  pointer, call `input.setPollAlways()`, and keep `touch-action: none` (already in
  the template `index.html`). Full checklist + Playwright verify in `phaser-perf-audit` §6a.

After scaffolding, mention the sibling skills: `pixel-art` (draw the game's sprites + hub thumbnail), `phaser-audio` (add CC0 sound + the throttled Audio helper), `phaser-optimize-bundle`, `phaser-perf-audit`, `phaser-review`.
