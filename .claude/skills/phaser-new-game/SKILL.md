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
- **Audio that works on iOS** — if the game has sound, ship `.m4a` AND `.ogg` for every
  clip and load `[m4a, ogg]` (iOS can't decode Ogg → silent iPhone). See `phaser-audio`.

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
  **Before drawing, ASK the user the sprite resolution** (see "Pixel resolution"
  below) — it sets the detail ceiling and the art budget.
- **UI panels** that stretch → use the v4 `this.add.nineslice(...)` instead of a
  hand-rolled 9-patch.

### Pixel resolution — ASK before drawing pixel art (8 / 16 / 32 / 64)
The **grid size** (how many cells the sprite is, e.g. 16×16) — NOT the bake `px`
or the on-screen scale — is what sets how detailed the art can be. Each step up
**quadruples** the pixel count and the drawing time, so confirm it with the user
via `AskUserQuestion` before you start. (`px` in `bakeSprite` only enlarges the
source texture; on-screen size comes from integer `setScale` + nearest-neighbor.)

| Grid | Pixels | What it can show | Art time | Use for |
|------|--------|------------------|----------|---------|
| **8×8** | 64 | only a **silhouette** | fastest | tiny icons, particles, UI bits |
| **16×16** | 256 | the **category** ("bird/cat/skeleton"), bold + cohesive, retro NES charm | fast | **the repo default** — most game sprites today (frog/hero/enemy ~10–16) |
| **32×32** | 1,024 | **facial expressions**, shading, cloth/wood/grass texture | ~4× a 16×16 | hero/boss you want expressive; the "pro sweet spot" |
| **64×64** | 4,096 | **equipment, fine texture, anti-aliased edges**, realistic proportions | very high (a 64×64 8-frame walk ≈ a full day for a pro) | showcase characters only |

Guidance to give the user:
- **More pixels ≠ automatically better.** Low-res *forces* bold, consistent shapes
  and has its own charm; it's also far faster and stays cohesive with this repo's
  existing 16-ish sprites. Mixing 16×16 and 64×64 in one game looks inconsistent —
  **pick one tier and keep the whole game on it.**
- Recommend **16×16** by default (matches what's already shipped, fast, reads
  clearly at small size), **32×32** if they specifically want expressive
  characters, and only go 64×64 for a single showcase hero.
- Whatever tier: still follow the craft gates (Sweetie-16, ramps, one light dir,
  readable silhouette first) and Playwright-verify — see `pixel-art`.

> Full v4 API surface, breaking changes, and gotchas: **`.claude/skills/PHASER4.md`**.
> This project is on **Phaser 4.1.0** — the Canvas renderer is deprecated (use
> `Phaser.AUTO`), `Group#children` is a Set (use `getChildren()`), and
> `Textures.generate` is gone (use `Graphics.generateTexture`).

### Before drawing ANY art — research the web first, draw last
**Mandatory. Especially when the user did NOT provide a reference image — if they
gave no art, you MUST search the web before drawing, never invent from memory.**

> **This is a hard gate with a visible receipt — do it, don't just intend to.**
> Your FIRST action in the art step must be an actual `WebSearch`/`WebFetch` call.
> Before you draw a single grid, post a one-line **research receipt** to the user:
> the queries you ran, the candidate asset(s) + their license, and the
> style references you studied. If that receipt is missing, you skipped the gate —
> stop and do the research. "I know what a tower/frog/tank looks like" is exactly
> the from-memory shortcut this rule forbids; the point is to match what players
> expect and to reuse a verified free asset when one exists.

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
6. **Verify (Playwright) — the real "it works" gate, not optional.** Run the
   **`phaser-smoketest`** skill against the new game and report its full pass/fail
   table. A green run REQUIRES all of:
   - boots + canvas renders + console clean + FPS ≥ 55, **and**
   - **UI layout sound** — run its overlap/reachability probe on *every* scene and
     *every* overlay state (menu, gameplay, shop/build menu open, upgrade panel,
     pause, game-over/win): zero overlapping interactive controls, nothing
     off-screen, every visible button reachable. (This is the gate that catches a
     buy-shop covering the play/start button — boot+FPS alone will not.)
   - **Core gameplay loop proven** — drive the one-sentence loop end to end and
     assert the state changes (score/money/lives/health/wave). Add a dev-only hook
     if needed to do it deterministically.
   - **Every screenshot eyeballed** — `Read` each PNG back and judge it (overlap,
     occlusion, clipping, readability), not just save it.
   - **iOS-safe audio (if the game has sound)** — every clip has an `.m4a` next to its
     `.ogg`, `PreloadScene` loads `[m4a, ogg]` (m4a first), and the context resumes on
     gesture. MCP can't run Safari, but Ogg-only ships a silent iPhone — verify the
     files + load order exist. See `phaser-audio`.

   Do not report "it works" off a boot-only run. If the smoke-test surfaces an
   overlap/occlusion or a loop that doesn't advance, **fix it and re-verify** before
   calling the game done. Do not leave the dev server running unless asked.

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

After scaffolding, mention the sibling skills: `game-design` (the core loop, juice & feel — read it when planning the game so it isn't "flat"), `pixel-art` (draw the game's sprites + hub thumbnail), `phaser-audio` (add CC0 sound + the throttled Audio helper), `phaser-optimize-bundle`, `phaser-perf-audit`, `phaser-review`.

> **Design before mechanics.** Before building gameplay, name the **core loop** in
> one sentence and decide where the **juice** goes (feedback per action) — see
> `game-design`. A technically-correct game with no loop/juice reads as "nhạt /
> flat / không có chiều sâu".
