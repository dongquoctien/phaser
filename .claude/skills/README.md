# Phaser Monorepo Skills

A set of project skills for building **Phaser 4.1.0 + Vite + TypeScript** pixel-art
games in this monorepo — "most standard, most pro, most lightweight". Claude invokes
these automatically when your request matches, or call them with `/<name>`.

| Skill | When to use |
|-------|-------------|
| **phaser-new-game** | Create/scaffold a new Phaser game to standard (scenes Boot→Preload→Menu→Game, pixelArt config, atlas pipeline, object pool). Bootstraps root tooling if missing. |
| **phaser-optimize-bundle** | Make the lightest build: pack atlas, compress PNG/audio, Vite/Rollup tree-shaking + split the Phaser chunk, terser. Measure before/after. |
| **phaser-perf-audit** | Smoothest runtime (FPS/stutter): object pooling, kill allocations in the game loop, batch draw calls, Arcade physics, cull off-screen. |
| **phaser-review** | Review game code against pro conventions: scene structure, key constants, pooling, listener cleanup on shutdown, TS strict. |
| **phaser-smoketest** | Autotest with **Playwright MCP**: boot the game in a real browser, check canvas render + clean console + measure FPS + screenshot each scene. The final verify step that new-game/optimize/perf-audit call into. |
| **pixel-art** | Draw procedural pixel-art in Phaser (game + hub): Sweetie-16 palette, value ramp + hue-shift, single light direction, selout outline, integer scale, nearest-neighbor. Use the `src/pixel/` helpers (`bakeSprite`, `ramp`, `lit`/`shade`). Trigger: "draw pixel/sprite", "make a pixel icon", art "looks off / blurry". |
| **phaser-audio** | Add sound: research CC0 SFX/music (Kenney/freesound) first → load → `Audio` helper (per-key throttle, mute persisted in registry, WebAudio autoplay-unlock + cache guard before decode). Trigger: "sound", "audio", "SFX", "background music", "no sound". Two mandatory bug boxes: iOS Ogg-silence (ship `.m4a`), and **sound stacking/blasting on tab return** (`pauseOnBlur=false` + a `pageHidden` flag). |
| **phaser-ui-ux** | Correct, bug-free in-game UI/UX: modals that actually block input underneath (a scene-handler guard flag, not just an interactive dim), scrollable lists (tween radius ≠ scale, header occluded by add-order, scroll-arrows, drag-vs-tap), pre-select the last pick (not random) + reset per-run, ground-plane perspective (rotate inside a scaleY container), text entry via a hidden DOM input, depth/draw-order. Trigger: add/fix any popup/picker/menu/leaderboard/tutorial, or UI that "lets clicks through", "scrolls wrong", "header disappears", "input won't type", "effect looks tilted", "picks random". |
| **game-design** | Design the **feel** of a game (not the tech): core loop & pacing, juice (screen shake, hit-stop, squash/stretch, particles, color flash, damage numbers), 12 animation principles + frame timing, **VFX/effect anatomy** (additive vs alpha blend, explosion/spell by phase), sound feedback, enemy telegraph/readability, onboarding, **reading/reverse-engineering a game from a reference image** (deconstruct screenshot → mechanics), **inferring story/theme from genre**. Trigger: game "flat / bland / shallow / lacks feel", building combat/feedback/effects, planning a new game loop, or analyzing a reference image. Has `sources.md` (Juice-it-or-lose-it, 12 principles, GDC telegraphing, sound-design, VFX, sprite-animation timing, image-reverse-engineering, narrative/lore). |

## Stack conventions
- **Phaser 4.1.0** (upgraded from 3.90; new v4 renderer. Note: v4 dropped `Textures.generate`+Create Palettes, `roundPixels` default `false` → we set explicit `roundPixels: true`).
- **Vite 5 + TypeScript 5 (strict)**, npm workspaces.
- Monorepo structure: `games/<name>/` is self-contained; the root shares `vite.config.shared.mjs` + `tsconfig.base.json`.

## Templates
`phaser-new-game/templates/` holds real ready-to-copy code:
- `root/` — package.json (workspaces), tsconfig.base.json, vite.config.shared.mjs (tuned for production), **scripts/build-all.mjs + scripts/hub-template.mjs** (generate the static hub HTML), **src/pixel/** (pixel-art helpers).
- `game/` — index.html, vite.config.mjs, game.json (+thumb), full src/ (config, scenes, systems/Pool.ts, objects/PooledSprite.ts, types/keys.ts).

All build/perf policy lives in the root's shared files → fix one place, every game benefits.

## Deploy (many games → one hub)
`npm run build:all` builds every game in `games/*` then **auto-generates the hub page**
`dist/index.html` (a grid to pick a game) linking to each game at a sub-URL. Structure:
```
dist/
├─ index.html        ← hub (landing page, lists every game)
├─ flappy-bird/      ← /<repo>/flappy-bird/
└─ <game>/           ← /<repo>/<game>/
```
- **GitHub Pages**: `.github/workflows/deploy.yml` auto-builds + publishes on push to `main`. Base path = `/<repo>/` (taken automatically from the repo name via `BASE_PATH`). URL: `https://<user>.github.io/<repo>/`.
- **Other host / root domain**: `BASE_PATH=/ npm run build:all`.
- A new game **appears automatically** on the hub — build-all scans `games/*`, no manual edit.
- **Windows**: run `build:all` via PowerShell (Git Bash mangles `/` → MSYS path). Pass the base via the env `GAME_BASE`, not the CLI `--base /`.

**Hub design** (`scripts/hub-template.mjs`): **static HTML/CSS** (not Phaser) — a pastel "COLLECTION"-style card grid on a dark background, one card per game (responsive auto 1→6 columns, rotating colors). A "PHASER ARCADE" pill header. The card artwork = pixel `thumb` rendered as **inline SVG** (preferring a hand-made `cover.svg`/`cover.png` if present). The card is a real `<a>` → crawlable, **zero JS**, focus-visible, no emoji.
