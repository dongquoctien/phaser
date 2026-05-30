---
name: phaser-new-game
description: Scaffold a new Phaser 3.90 + Vite + TypeScript game inside this monorepo, with the project-standard pixel-art config, scene structure, asset pipeline, and object-pooling/atlas conventions baked in. Use when the user wants to "create a new game", "add a game", "scaffold a Phaser game", "tạo game mới", "thêm game".
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
- `pixelArt: true` (sets nearest-neighbor, `roundPixels: true`, disables antialias).
- One **texture atlas per category** (sprites / ui / fx), never loose PNGs.
- **Object pooling** for anything spawned in a loop (bullets, particles, enemies).
- **String-key constants** in `types/` — never raw string literals for scene/asset keys.
- Arcade physics by default (Matter only if polygon collisions are truly needed).
- `physics.arcade.debug` and any FPS overlay are **off** in the production config.

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

## 2b. Pixel-art & hub conventions

The landing page is a **small Phaser pixel-art app** (`hub/`, its own Vite root parallel to `games/`), so the hub matches the games visually. It draws icons + per-game thumbnails with the shared **`src/pixel/`** helper (Sweetie-16 palette, `ramp`/`lit`/`shade`, `bakeSprite`). See the **`pixel-art`** skill for the craft rules. Keep `src/pixel/`, `hub/`, and `scripts/build-all.mjs` in sync between the live repo and `templates/root/`.

- **Drawing art** (sprites, thumbnails): use `src/pixel/` via the `pixel-art` skill — never ad-hoc `graphics.fill*`. Verify rendered art with Playwright (zoom in; readable silhouette first).
- **Card metadata** comes from `games/<name>/game.json` (`title`/`description`/`tags`). Missing or malformed `game.json` never breaks the build — it falls back to the `<title>`.
- **Thumbnail**: a game declares `game.json.thumb = { grid, map }` (a `PixelGrid` of Sweetie-16 hexes, equal-length rows). Omit it → the hub draws `BUILTINS.cabinet`. A committed `games/<name>/cover.png` is also honored.
- **`build-all.mjs`** builds each game into `dist/<game>/`, writes the hub manifest `hub/src/games.generated.ts`, then builds the hub LAST (`emptyOutDir:false` so it keeps `dist/<game>/`), and injects a crawlable `<ul>` + `<noscript>` link fallback (canvas has no DOM — this is the a11y/SEO mitigation).
- A new game appears on the hub automatically (auto-discovery) — no hub edit per game.
- **Windows build**: run `build:all` via PowerShell or set base via env — Git Bash mangles a bare leading `/` (MSYS path conversion). Base comes through `GAME_BASE`/`HUB_BASE` env, never a CLI `--base /`.

## 3. Anti-patterns to refuse

- Loading individual PNGs per sprite → use an atlas (point them to `phaser-optimize-bundle`).
- `new Bullet()` / `.destroy()` in `update()` → use the Pool.
- Importing all of Phaser into shared libs that don't need it (kills tree-shaking).
- Hardcoded canvas dimensions instead of `Scale.FIT` + relative sizing.

After scaffolding, mention the sibling skills: `pixel-art` (draw the game's sprites + hub thumbnail), `phaser-optimize-bundle`, `phaser-perf-audit`, `phaser-review`.
