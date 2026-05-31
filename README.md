# Phaser Arcade

A **monorepo of pixel-art games** built with **Phaser 4.1.0 + Vite + TypeScript**,
served behind a single pixel-art landing hub. Each game is self-contained; the
whole collection deploys to GitHub Pages as one site.

> Live: **https://dongquoctien.github.io/phaser/** (after Pages is enabled)

---

## What's inside

```
phaser/
├─ games/<name>/         # one self-contained game per folder (Vite root)
│  └─ flappy-bird/       #   the first game
├─ src/pixel/            # shared pixel-art helper (palette, ramps, bakeSprite)
├─ scripts/
│  ├─ build-all.mjs      #   builds every game + generates the hub into dist/
│  └─ hub-template.mjs   #   static-HTML hub generator (renderHub + gridToSvg)
├─ vite.config.shared.mjs, tsconfig.base.json   # shared tooling
└─ .claude/skills/       # authoring skills (see below)
```

The **hub** (`dist/index.html`) is a **static HTML/CSS page** generated at build time
— a dark "COLLECTION"-style grid of pastel trading cards, one per game (responsive,
colors cycle automatically). Each card's artwork is the game's pixel `thumb` rendered
as inline SVG, overridable by a committed `games/<name>/cover.svg` / `cover.png`. It
auto-discovers every game in `games/*`; the cards are real `<a>` links (crawlable, no
JS needed).

## Quick start

```bash
npm install

# develop a single game (fixed port avoids collisions)
npm run dev:flappy-bird          # → http://localhost:5180

# build everything (games + hub) into dist/
npm run build:all

# type-check
npm run typecheck
```

> **Windows note:** run `build:all` from PowerShell (or set the base via env). Git
> Bash rewrites a leading `/` in the base path (MSYS), which breaks asset URLs.

## Adding a game

A game lives in `games/<name>/` with its own `vite.config.mjs`, `index.html`,
`game.json`, and `src/` (scenes, objects, systems). It appears on the hub
automatically — no hub edit needed.

`game.json` drives the hub card:

```json
{
  "title": "Flappy Bird",
  "description": "Tap to flap through the gaps.",
  "tags": ["arcade", "reflex", "endless"],
  "thumb": { "grid": ["..."], "map": { "y": "#ffcd75", ".": null } }
}
```

`thumb` is an optional pixel-grid baked into the card thumbnail; omit it for a
default arcade-cabinet glyph.

## Conventions

- **Pixel art**: `pixelArt: true`, integer scaling, nearest-neighbor; draw sprites
  procedurally with the `src/pixel/` helper (Sweetie-16 palette, value ramps,
  hue-shifting). Never ad-hoc colors.
- **Object pooling** for anything spawned in a loop (pipes, bullets, particles).
- **String-key constants** in `types/` — no raw scene/texture-key literals.
- **Arcade physics** by default; `physics.debug` and FPS overlays are dev-only
  (tree-shaken from production via the `__DEV__` define).
- Each game has a **fixed dev/preview port** so the monorepo never collides
  (flappy-bird `5180`/`4180`, hub `5170`/`4170`).

## Deploy

`npm run build:all` outputs `dist/` (hub `index.html` + each game under
`dist/<game>/`). `.github/workflows/deploy.yml` builds and publishes to **GitHub
Pages** on push to `main` with base path `/<repo>/`.

One-time setup: **Settings → Pages → Source = GitHub Actions**.

For other hosts / a root domain: `BASE_PATH=/ npm run build:all`.

## Authoring skills (`.claude/skills/`)

Project skills for [Claude Code](https://claude.com/claude-code):

| Skill | Purpose |
|-------|---------|
| `phaser-new-game` | Scaffold a new game from the standard template |
| `pixel-art` | Draw crisp procedural pixel-art (palette, ramps, bake) |
| `phaser-optimize-bundle` | Shrink the production build |
| `phaser-perf-audit` | Fix runtime FPS / GC stutter |
| `phaser-review` | Review a game against project conventions |
| `phaser-smoketest` | Headless Playwright boot/console/FPS check |

## Tech

Phaser 4.1.0 · Vite 5 · TypeScript 5 (strict) · npm workspaces · GitHub Pages.
